"use node";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey(){
  const value=process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  const key=Buffer.from(value||"","base64");
  if(key.length!==32)throw new Error("Configure SOCIAL_TOKEN_ENCRYPTION_KEY as a base64 32-byte key");
  return key;
}
export function encryptToken(value:string,owner:string){
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
  cipher.setAAD(Buffer.from("linkedin:v1:"+owner));
  const ciphertext=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  return [iv,cipher.getAuthTag(),ciphertext].map(x=>x.toString("base64")).join(".");
}
export function decryptToken(value:string,owner:string){
  const [iv,tag,ciphertext]=value.split(".").map(x=>Buffer.from(x,"base64"));
  const cipher=createDecipheriv("aes-256-gcm",encryptionKey(),iv);
  cipher.setAAD(Buffer.from("linkedin:v1:"+owner));cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(ciphertext),cipher.final()]).toString("utf8");
}
export function linkedInHeaders(token:string){
  const version=process.env.LINKEDIN_API_VERSION||"202609";
  if(!/^20\d{4}$/.test(version))throw new Error("Invalid LinkedIn API version");
  return {Authorization:"Bearer "+token,"LinkedIn-Version":version,
    "X-Restli-Protocol-Version":"2.0.0","Content-Type":"application/json"};
}
export async function fetchLinkedIn(url:string,init:RequestInit){
  return fetch(url,{...init,redirect:"error",signal:AbortSignal.timeout(45000)});
}
export function imageUploadUrl(value:string){
  const url=new URL(value);
  if(url.protocol!=="https:"||url.username||url.password||
    !(url.hostname==="linkedin.com"||url.hostname.endsWith(".linkedin.com")||url.hostname.endsWith(".licdn.com")))
    throw new Error("Unexpected LinkedIn image upload destination");
  return url.toString();
}
// LinkedIn commentary uses little-text syntax. Escape literal punctuation so
// first-person writing cannot accidentally create mentions or annotations.
export function escapeCommentary(text:string){
  return text.replace(/[\\|{}@\[\]()<>~_]/g,"\\$&");
}
export function postPayload(author:string,caption:string,imageUrn:string){
  if(!/^urn:li:person:[A-Za-z0-9_-]+$/.test(author)||!/^urn:li:image:[A-Za-z0-9_-]+$/.test(imageUrn))throw new Error("Invalid LinkedIn URN");
  return {author,commentary:escapeCommentary(caption),visibility:"PUBLIC",
    distribution:{feedDistribution:"MAIN_FEED",targetEntities:[],thirdPartyDistributionChannels:[]},
    content:{media:{id:imageUrn,altText:"Kurt Prince: "+caption.split("\n")[0].slice(0,200)}},
    lifecycleState:"PUBLISHED",isReshareDisabledByAuthor:false};
}
