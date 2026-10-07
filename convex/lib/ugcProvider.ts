import { MODEL_IDS } from "./ugcPolicy";
const BASE="https://api.muapi.ai";
export class ProviderError extends Error { constructor(public code:string,public ambiguous=false){super(code);} }
export function providerMessage(e:unknown){
  if(e instanceof ProviderError){const m:Record<string,string>={CONFIG:"Configure MUAPI_API_KEY in the production Convex deployment.",CREDITS:"MuAPI credits are insufficient. Top up the provider account.",AUTH:"MuAPI rejected the API key. Check its configuration.",PARAMS:"MuAPI rejected these parameters. Refresh models and request a new estimate.",MODEL:"The selected model is unavailable. Choose another model.",QUOTE:"A live cost estimate is unavailable. Refresh and try again.",NETWORK:"The provider could not be reached. Retry the status check.",SUBMIT:"Submission outcome is unknown. Check MuAPI history and reconcile the request before generating again.",FAILED:"MuAPI generation failed. Review the script and model; a new generation requires cost confirmation.",OUTPUT:"The generated video could not be saved. Retry the status check.",SCHEMA:"The provider schema changed. Refresh models or choose another model."};return m[e.code]||"Provider operation failed. Retry the status check.";}
  return "UGC operation could not be completed. Check configuration and try again.";
}
export interface VideoProvider {models():Promise<any[]>;model(id:string):Promise<any>;estimateCost(id:string,payload:any):Promise<number>;generate(id:string,payload:any):Promise<any>;getStatus(id:string):Promise<any>;getResult(id:string):Promise<any>}
async function request(path:string,init:RequestInit={},paid=false){
  if(!/^\/api\/v1\/[a-zA-Z0-9._/-]+$/.test(path))throw new ProviderError("SCHEMA");
  let response:Response;
  try {response=await fetch(BASE+path,{...init,signal:AbortSignal.timeout(paid?90000:25000)});}catch{throw new ProviderError(paid?"SUBMIT":"NETWORK",paid);}
  if(!response.ok){
    const code=response.status===402?"CREDITS":[401,403].includes(response.status)?"AUTH":response.status===404?"MODEL":[400,422].includes(response.status)?"PARAMS":paid?"SUBMIT":"NETWORK";
    throw new ProviderError(code,paid&&response.status>=500);
  }
  try{return await response.json();}catch{throw new ProviderError(paid?"SUBMIT":"SCHEMA",paid);}
}
function headers(){const key=process.env.MUAPI_API_KEY;if(!key)throw new ProviderError("CONFIG");return {"Content-Type":"application/json","x-api-key":key};}
export function schema(m:any){const s=m.input_schema?.schemas?.input_data;if(!s?.properties)throw new ProviderError("SCHEMA");return s;}
export function validatePayload(m:any,payload:Record<string,any>){
  const s=schema(m);
  for(const key of s.required||[])if(payload[key]===undefined)throw new ProviderError("PARAMS");
  for(const [key,value] of Object.entries(payload)){
    const f=s.properties[key];if(!f)throw new ProviderError("SCHEMA");
    if(f.enum&&!f.enum.includes(value))throw new ProviderError("PARAMS");
    if(["int","integer","number"].includes(f.type)&&(!Number.isFinite(value)||(f.type!=="number"&&!Number.isInteger(value))||value<(f.minValue??f.minimum??-Infinity)||value>(f.maxValue??f.maximum??Infinity)))throw new ProviderError("PARAMS");
    if(f.type==="string"&&typeof value!=="string")throw new ProviderError("PARAMS");
    if(f.type==="array"&&(!Array.isArray(value)||value.length>(f.maxItems??Infinity)))throw new ProviderError("PARAMS");
  }
}
export function clipLengths(seconds:number,m:any){
  const d=schema(m).properties.duration;if(!d)throw new ProviderError("SCHEMA");
  const values=d.enum?.map(Number).sort((a:number,b:number)=>a-b);
  const min=values?.[0]??d.minValue??d.minimum,max=values?.at(-1)??d.maxValue??d.maximum;
  if(!Number.isFinite(min)||!Number.isFinite(max)||min<1||max<min||max>120)throw new ProviderError("SCHEMA");
  const result:number[]=[];let left=seconds;
  while(left>0){const length=values?(values.find((n:number)=>n>=Math.min(left,max))??max):Math.max(min,Math.min(max,Math.ceil(left)));result.push(length);left-=length;if(result.length>20)throw new ProviderError("PARAMS");}
  return result;
}
export function payloadFor(m:any,prompt:string,duration:number,resolution:string,reference?:string){
  const p=schema(m).properties,payload:any={prompt,duration};
  if(p.aspect_ratio)payload.aspect_ratio="9:16";
  if(p.resolution)payload.resolution=resolution;
  if(p.mode)payload.mode="normal";
  if(p.images_list||p.image_url){if(!reference)throw new ProviderError("PARAMS");if(p.images_list)payload.images_list=[reference];else payload.image_url=reference;}
  validatePayload(m,payload);return payload;
}
export const muapi:VideoProvider={
  async models(){const b=await request("/api/v1/models");if(!Array.isArray(b.models))throw new ProviderError("SCHEMA");return b.models.filter((m:any)=>MODEL_IDS.includes(m.name)&&m.is_enabled&&!m.is_coming_soon);},
  async model(id){if(!MODEL_IDS.includes(id))throw new ProviderError("MODEL");const m=await request("/api/v1/models/"+id);if(!m.is_enabled||m.is_coming_soon)throw new ProviderError("MODEL");schema(m);return m;},
  async estimateCost(id,payload){const m=await this.model(id);validatePayload(m,payload);if(!m.dynamic_pricing){if(typeof m.cost!=="number"||m.cost_currency!=="USD")throw new ProviderError("QUOTE");return m.cost;}
    if(m.estimate_endpoint!==`/api/v1/models/${id}/estimate-cost`)throw new ProviderError("SCHEMA");
    const b=await request(m.estimate_endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    if(typeof b.cost!=="number"||!Number.isFinite(b.cost)||b.cost<0||b.currency!=="USD")throw new ProviderError("QUOTE");return b.cost;},
  async generate(id,payload){if(!MODEL_IDS.includes(id))throw new ProviderError("MODEL");const h=headers();return request("/api/v1/"+id,{method:"POST",headers:h,body:JSON.stringify(payload)},true);},
  async getStatus(id){if(!/^[a-zA-Z0-9_-]{1,200}$/.test(id))throw new ProviderError("PARAMS");return request(`/api/v1/predictions/${id}/result`,{headers:headers()});},
  async getResult(id){return this.getStatus(id);},
};
