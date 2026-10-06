/** Runs only on the existing trusted CI runner. Never prints keys, raw logs or responses. */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {reasonWithTools,TOOL_ACTIONS} from '../convex/lib/caylaReasoning';
let secret:string;
try {secret=execFileSync('npx',['convex','env','get','OPENAI_API_KEY'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{console.log(JSON.stringify({stage:'CONFIGURATION',ready:false,code:'EXISTING_KEY_UNAVAILABLE'}));process.exit(1);}
try{const decoded=JSON.parse(secret);if(typeof decoded==='string')secret=decoded;}catch{}
if(!secret||!secret.startsWith('sk-')){console.log(JSON.stringify({stage:'CONFIGURATION',ready:false,code:'EXISTING_KEY_UNAVAILABLE'}));process.exit(1);}
process.env.OPENAI_API_KEY=secret;
const raw=readFileSync(process.argv[2]||'/tmp/cayla-runtime.jsonl','utf8');
const logs=raw.split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}}).filter(item=>/caylaAgentActions:request/.test(item.identifier||''));
const failures=logs.filter(item=>item.error);
const patterns=['Unauthenticated','Account not found','Workspace not found','Client not found','Forbidden','PLAN_LIMIT_REACHED','Invalid dashboard context','Employee context access denied','Intent interpretation is unavailable','Intent interpretation failed','Unsupported action arguments','Client access denied','Invalid payroll date','Invalid clarification'];
console.log(JSON.stringify({stage:'PRODUCTION_DIAGNOSTICS',requests:logs.length,failures:failures.length,causes:failures.map(item=>patterns.find(p=>String(item.error).includes(p))||'UNKNOWN_CAUSE_REQUIRES_TRACED_REPRODUCTION')}));
async function provider(path:string,body:any){const response=await fetch(`https://api.openai.com/v1/${path}`,{method:'POST',headers:{Authorization:`Bearer ${secret}`,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:JSON.stringify(body),signal:AbortSignal.timeout(40000)});if(!response.ok){console.log(JSON.stringify({stage:'PROVIDER_CHECK',endpoint:path,status:response.status}));throw Error('PROVIDER_UNAVAILABLE');}return response;}
try {
  const instruction='Prepare payroll for Trini Builders.';
  const speech=await provider('audio/speech',{model:'gpt-4o-mini-tts',voice:'marin',input:instruction,response_format:'mp3'});
  const form=new FormData();form.append('file',await speech.blob(),'test-instruction.mp3');form.append('model','gpt-transcribe');form.append('languages[]','en');form.append('keywords[]','Trini Builders');form.append('keywords[]','payroll');form.append('response_format','json');
  const transcript=await(await provider('audio/transcriptions',form)).json();
  const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
  if(normalize(transcript.text||'')!==normalize(instruction))throw Error('TRANSCRIPTION_MISMATCH');
  console.log(JSON.stringify({stage:'TRANSCRIPTION_AND_VOICE',ready:true,syntheticTest:true}));
  const context={today:'2026-10-05',timezone:'America/Port_of_Spain',currentClientId:'synthetic-client',clients:[{id:'synthetic-client',name:'Trini Builders'}],active:null,page:'Dashboard'};
  const reason=await reasonWithTools(context,`${instruction} Use period October 1 to October 7, 2026 and pay date October 9, 2026. Prepare a review only.`,async(name,args)=>{
    if(name==='search_clients'||name==='list_clients')return {data:context.clients};
    if(name==='get_workspace_context')return context;
    if(name==='prepare_payroll')return {final:true,action:TOOL_ACTIONS[name],args};
    if(name==='ask_clarification')return {final:true,action:'clarification',args};
    throw Error('UNEXPECTED_SYNTHETIC_TOOL');
  },'cayla-ci-provider-check');
  if(reason.action!=='prepare'||!reason.args.clientIds.includes('synthetic-client')||reason.args.periodStart!=='2026-10-01'||reason.args.periodEnd!=='2026-10-07'||reason.args.payDate!=='2026-10-09')throw Error('REASONING_MISMATCH');
  console.log(JSON.stringify({stage:'REASONING',ready:true,syntheticTest:true}));
}catch(error:any){console.log(JSON.stringify({stage:'PROVIDER_CHECK',ready:false,code:['TRANSCRIPTION_MISMATCH','REASONING_MISMATCH','UNEXPECTED_SYNTHETIC_TOOL','PROVIDER_UNAVAILABLE'].includes(error.message)?error.message:'PROVIDER_FAILURE'}));process.exit(1);}
