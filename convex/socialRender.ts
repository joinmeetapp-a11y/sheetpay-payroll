"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { initializeRenderer, renderSocialCard } from "./lib/socialCard";
import { resvgBase64 } from "./socialAssets/resvgBytes";
export const render = internalAction({args:{id:v.id("socialPosts"),operationId:v.string(),imageText:v.string()},
  handler:async(ctx,a):Promise<{storageId:Id<"_storage">,portraitId:Id<"_storage">}>=>{
    const {settings,post}=await ctx.runQuery(internal.social.workerContext,{id:a.id});
    if(!post||post.operationId!==a.operationId||post.status!=="generating")throw new Error("Generation cancelled");
    if(!settings.portraitId)throw new Error("Portrait is missing");
    const portrait=await ctx.storage.get(settings.portraitId);
    if(!portrait)throw new Error("Portrait is unavailable");
    await initializeRenderer(new Uint8Array(Buffer.from(resvgBase64, "base64")));
    const result=await renderSocialCard(a.imageText,new Uint8Array(await portrait.arrayBuffer()),portrait.type);
    return {storageId:await ctx.storage.store(new Blob([new Uint8Array(result.png)],{type:"image/png"})),portraitId:settings.portraitId};
  }
});
