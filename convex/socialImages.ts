import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

function headers(request:Request){
  const origin=request.headers.get("Origin"),allowed=process.env.SOCIAL_APP_ORIGIN||"https://sheetpay.app";
  const h=new Headers({"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Vary":"Origin"});
  if(origin===allowed){h.set("Access-Control-Allow-Origin",allowed);h.set("Access-Control-Allow-Methods","GET, OPTIONS");h.set("Access-Control-Allow-Headers","Authorization");}
  return h;
}
export const preflight=httpAction(async(_ctx,request)=>new Response(null,{status:204,headers:headers(request)}));
export const image=httpAction(async(ctx,request)=>{
  const h=headers(request);
  try{
    const storageId=new URL(request.url).searchParams.get("id");
    if(!storageId||!request.headers.get("Authorization"))return new Response("Unauthorized",{status:401,headers:h});
    const authorizedId=await ctx.runQuery(api.social.asset,{id:storageId as Id<"_storage">});
    const blob=await ctx.storage.get(authorizedId);
    if(!blob)return new Response("Not found",{status:404,headers:h});
    h.set("Content-Type",blob.type);return new Response(blob,{headers:h});
  }catch{return new Response("Forbidden",{status:403,headers:h});}
});
