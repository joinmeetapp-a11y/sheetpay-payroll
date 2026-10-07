import { httpAction } from "./_generated/server";
import { anyApi } from "convex/server";
function headers(request:Request){const origin=request.headers.get("Origin"),allowed=process.env.SOCIAL_APP_ORIGIN||"https://sheetpay.app";const h=new Headers({"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Vary":"Origin"});if(origin===allowed){h.set("Access-Control-Allow-Origin",allowed);h.set("Access-Control-Allow-Methods","GET, OPTIONS");h.set("Access-Control-Allow-Headers","Authorization, Range");h.set("Access-Control-Expose-Headers","Content-Length, Content-Range");}return h;}
export const preflight=httpAction(async(_ctx,r)=>new Response(null,{status:204,headers:headers(r)}));
export const media=httpAction(async(ctx,r)=>{const h=headers(r);try{
  if(!r.headers.get("Authorization"))return new Response("Unauthorized",{status:401,headers:h});
  const id=new URL(r.url).searchParams.get("id");if(!id)return new Response("Not found",{status:404,headers:h});
  const verified=await ctx.runQuery(anyApi.ugc.asset,{id}),blob=await ctx.storage.get(verified);if(!blob)return new Response("Not found",{status:404,headers:h});
  h.set("Content-Type",blob.type);h.set("Accept-Ranges","bytes");
  const range=r.headers.get("Range");if(range){const m=/^bytes=(\d+)-(\d*)$/.exec(range);if(!m)return new Response(null,{status:416,headers:h});const start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),blob.size-1):blob.size-1;if(start> end||start>=blob.size)return new Response(null,{status:416,headers:h});h.set("Content-Range",`bytes ${start}-${end}/${blob.size}`);return new Response(blob.slice(start,end+1),{status:206,headers:h});}
  return new Response(blob,{headers:h});
}catch{return new Response("Forbidden",{status:403,headers:h});}});
