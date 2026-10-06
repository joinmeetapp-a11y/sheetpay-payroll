"use node";
import { action } from './_generated/server';
import { internal as generatedInternal } from './_generated/api';
import { v, ConvexError } from 'convex/values';
import { reasonWithTools, TOOL_ACTIONS, diagnostics, failureCode, publicFailure } from './lib/caylaReasoning';
import { contextValidator } from './caylaAgentSchema';
const internal = generatedInternal as any;

export const request = action({
  args: { message: v.string(), businessId: v.id('businesses'), requestKey: v.string(), timezone: v.string(), context: v.optional(contextValidator), source: v.union(v.literal('text'), v.literal('voice')) },
  handler: async (ctx, args): Promise<any> => {
    const trace=args.requestKey;
    let begun:any=null;
    let stage='CONTEXT_LOADING';
    try {
      diagnostics(trace,stage,{inputType:args.source});
      if (!args.message.trim() || args.message.length > 2000) throw new Error('Invalid instruction');
      begun = await ctx.runMutation(internal.caylaAgent.beginRequest, { businessId: args.businessId, requestKey: args.requestKey, source: args.source, timezone: args.timezone, ...(args.context ? { context: args.context } : {}) });
      if (begun.duplicate) return begun;
      const context = await ctx.runQuery(internal.caylaAgent.agentTool, { commandId:begun.commandId, tool:'get_workspace_context' });
      diagnostics(trace,stage,{actorId:context.actorId,workspaceId:context.workspaceId});
      stage='AI_REASONING';
      const result=await reasonWithTools(context,args.message,async(name,parameters)=>{
        if(name==='ask_clarification') return {final:true,intent:{action:'help',scope:'current',clientIds:[],clarification:parameters.question}};
        if(name==='present_readonly_result')return {final:true,intent:{action:'help',scope:'current',clientIds:[]},reply:parameters.message};
        if(name==='review_pending_payroll'){
          const resolved=await ctx.runQuery(internal.caylaAgent.resolveProposal,{commandId:begun.commandId,proposal:{},action:'review',followup:true});
          return resolved.commandId?{final:true,commandId:resolved.commandId}:{final:true,intent:{action:'help',scope:'current',clientIds:[],clarification:resolved.clarification}};
        }
        if(TOOL_ACTIONS[name]) {
          const resolved=await ctx.runQuery(internal.caylaAgent.resolveProposal,{commandId:begun.commandId,proposal:parameters,action:TOOL_ACTIONS[name],followup:name==='amend_pending_payroll'||parameters.useActivePayroll===true});
          if(resolved.clarification)return {final:true,intent:{action:'help',scope:'current',clientIds:[],clarification:resolved.clarification}};
          return {final:true,intent:resolved.intent};
        }
        const output=await ctx.runQuery(internal.caylaAgent.agentTool,{commandId:begun.commandId,tool:name,...(parameters.clientId?{clientId:parameters.clientId}:{}),...(parameters.search?{search:parameters.search}:{}),...(parameters.scope?{scope:parameters.scope}:{}),...(parameters.periodStart?{periodStart:parameters.periodStart}:{}),...(parameters.periodEnd?{periodEnd:parameters.periodEnd}:{})});
        return {data:output};
      },trace);
      stage='REVIEW_CREATED';
      if(result.commandId){
        await ctx.runMutation(internal.caylaAgent.savePlan,{commandId:begun.commandId,intent:{action:'help',scope:'current',clientIds:[],clarification:'Your active payroll review is ready. Use the approval button after reviewing all changes.'}});
        return {commandId:result.commandId,duplicate:false,requestId:trace};
      }
      const saved=await ctx.runMutation(internal.caylaAgent.savePlan,{commandId:begun.commandId,intent:result.intent});
      await ctx.runMutation(internal.caylaAgent.rememberSession,{commandId:begun.commandId,...(result.reply?{reply:result.reply}:{})});
      diagnostics(trace,stage,{action:result.intent.action,approvalStatus:'not_executed'});
      return {...begun,requestId:trace,needsPreparation:saved.status==='planned'};
    } catch(error) {
      diagnostics(trace,'ERROR',{failedStage:stage,code:failureCode(error)});
      if(begun?.commandId)try {await ctx.runMutation(internal.caylaAgent.requestFailure,{commandId:begun.commandId});}catch(failure){diagnostics(trace,'ERROR',{failedStage:'FAILURE_RECORDING',code:failureCode(failure)});}
      throw new ConvexError({...publicFailure(error),requestId:trace});
    }
  },
});
export const prepare = action({ args: { commandId: v.id('caylaCommands') }, handler: async (ctx, args): Promise<any> => {
  const token = crypto.randomUUID();
  try {
    diagnostics(String(args.commandId),'TOOL_EXECUTION',{tool:'prepare_payroll',status:'started'});
    const started = await ctx.runMutation(internal.caylaAgent.startPreparation, { ...args, token });
    if (started.done) return { commandId: args.commandId };
    // Each committed batch is real work. The reactive command query reports actual counts.
    for (let i = 0; i < 250; i++) {
      const result = await ctx.runMutation(internal.caylaAgent.prepareBatch, { ...args, token });
      if (result.done) return { commandId: args.commandId };
    }
    await ctx.runMutation(internal.caylaAgent.preparationFailure, { ...args, token });
    return { commandId: args.commandId, resumable: true };
  } catch (error) {
    try {await ctx.runMutation(internal.caylaAgent.preparationFailure, { ...args, token });} catch {}
    diagnostics(String(args.commandId),'ERROR',{failedStage:'PAYROLL_CALCULATION',code:failureCode(error)});
    throw new ConvexError({...publicFailure(error),requestId:String(args.commandId)});
  }
} });
export const speak = action({args:{commandId:v.id('caylaCommands')},handler:async(ctx,args):Promise<any>=>{
  const trace=String(args.commandId);let started:any;let generatedStorageId:any=null;
  try{
    started=await ctx.runMutation(internal.caylaAgent.startVoice,args);
    if(started.disabled||started.busy)return {available:false};
    let audio:Blob;
    if(started.storageId){const cached=await ctx.storage.get(started.storageId);if(!cached)throw new Error('Voice cache expired');audio=cached;}
    else {
      diagnostics(trace,'VOICE_RESPONSE',{status:'started'});
      const key=process.env.OPENAI_API_KEY;if(!key)throw new Error('MODEL_CONFIGURATION');
      const response=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify({model:process.env.CAYLA_VOICE_MODEL||'gpt-4o-mini-tts',voice:process.env.CAYLA_VOICE||'marin',input:started.text,response_format:'mp3',instructions:'Use a warm, clear, confident professional American English female voice, with a youthful adult character. Speak naturally at a moderately fast pace. Avoid excessive enthusiasm. This is a synthetic character, not an imitation of any real person.'})});
      if(!response.ok)throw new Error('MODEL_HTTP');
      audio=await response.blob();if(audio.size>800000)throw new Error('Voice response too large');
      const storageId=await ctx.storage.store(audio);generatedStorageId=storageId;
      await ctx.runMutation(internal.caylaAgent.finishVoice,{...args,key:started.key,storageId});generatedStorageId=null;
    }
    diagnostics(trace,'VOICE_RESPONSE',{status:'complete'});
    return {available:true,audioBase64:Buffer.from(await audio.arrayBuffer()).toString('base64'),mimeType:'audio/mpeg'};
  }catch(error){if(generatedStorageId)await ctx.storage.delete(generatedStorageId);diagnostics(trace,'ERROR',{failedStage:'VOICE_RESPONSE',code:failureCode(error)});if(started?.key)try{await ctx.runMutation(internal.caylaAgent.finishVoice,{...args,key:started.key});}catch{}return {available:false,error:'Voice playback is unavailable. Your written result is still available.'};}
}});
