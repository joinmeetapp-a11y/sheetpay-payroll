import React from "react";
import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { create } from "fontkit";
import { regularBase64, boldBase64 } from "../socialAssets/fonts";
import { validateImageText } from "./socialContent";

const regular = Buffer.from(regularBase64,"base64");
const bold = Buffer.from(boldBase64,"base64");
const loadedFace = create(regular);
if (!("layout" in loadedFace)) throw new Error("The bundled regular font must be a single font");
const face = loadedFace;
let initialized: Promise<void> | undefined;
export function initializeRenderer(wasm: WebAssembly.Module | Uint8Array) {
  initialized ||= initWasm(wasm);
  return initialized;
}
function width(text:string,size:number) {
  return face.layout(text).positions.reduce((sum,position)=>sum+position.xAdvance,0)*size/face.unitsPerEm;
}
export function cardLayout(text:string) {
  validateImageText(text);
  for(let size=58;size>=38;size-=2){
    const paragraphs:string[][]=[];
    let valid=true;
    for(const paragraph of text.trim().split(/\n\s*\n/)){
      const lines:string[]=[];let line="";
      for(const word of paragraph.trim().split(/\s+/)){
        if(width(word,size)>1056){valid=false;break;}
        if(width(line?line+" "+word:word,size)>1056){lines.push(line);line=word;}else line=line?line+" "+word:word;
      }
      if(line)lines.push(line);paragraphs.push(lines);
    }
    const height=paragraphs.reduce((h,p)=>h+p.length*size*1.35,0)+(paragraphs.length-1)*30;
    if(valid&&height<=840)return {fontSize:size,lineHeight:size*1.35,paragraphs,height,
      widths:paragraphs.flat().map(line=>width(line,size))};
  }
  throw new Error("Social card text cannot fit safely. Shorten the image text.");
}
export async function renderSocialCard(text:string,portrait:Uint8Array,mime:string) {
  if(!initialized)throw new Error("PNG renderer is not initialized");
  await initialized;
  // Uploaded filenames and declared MIME can be wrong. Identify the original
  // bytes without decoding, transforming or regenerating Kurt's face.
  if(portrait[0]===0xff&&portrait[1]===0xd8&&portrait[2]===0xff)mime="image/jpeg";
  else if(Buffer.from(portrait.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime="image/png";
  else throw new Error("Portrait must contain genuine PNG/JPEG bytes");
  const layout=cardLayout(text);
  const e=React.createElement;
  const svg=await satori(e("div",{style:{display:"flex",flexDirection:"column",width:1200,height:1200,
    backgroundColor:"#08090b",color:"#ffffff",padding:72,fontFamily:"KurtSans"}},
    e("div",{style:{display:"flex",height:128,alignItems:"center",gap:28,flexShrink:0}},
      e("img",{src:"data:"+mime+";base64,"+Buffer.from(portrait).toString("base64"),width:116,height:116,
        style:{borderRadius:58,objectFit:"cover"}}),
      e("div",{style:{display:"flex",flexDirection:"column",gap:8}},
        e("div",{style:{fontSize:42,fontWeight:700}},"Kurt Prince"),
        e("div",{style:{fontSize:26,color:"#9298a3"}},"General Contractor & Founder"),
        e("div",{style:{fontSize:25,color:"#9298a3"}},"@kurtprince"))),
    e("div",{style:{display:"flex",flexDirection:"column",marginTop:80,gap:30}},
      ...layout.paragraphs.map((lines,i)=>e("div",{key:i,style:{display:"flex",flexDirection:"column"}},
        ...lines.map((line,j)=>e("div",{key:j,style:{display:"flex",fontSize:layout.fontSize,
          height:layout.lineHeight,lineHeight:1.35,whiteSpace:"pre",flexShrink:0}},line)))))),
    {width:1200,height:1200,fonts:[{name:"KurtSans",data:regular,weight:400},{name:"KurtSans",data:bold,weight:700}],
      loadAdditionalAsset:async()=>{throw new Error("Unsupported glyph. Use plain text without emojis.");}});
  const renderer=new Resvg(svg);
  for (const href of renderer.imagesToResolve()) {
    if (typeof href !== "string" || !href.startsWith("data:"+mime+";base64,")) {
      renderer.free();throw new Error("Portrait image reference is invalid");
    }
    renderer.resolveImage(href,portrait);
  }
  const rendered=renderer.render();
  try{
    const pixels=rendered.pixels;let portraitPixels=0;
    for(let y=86;y<186;y++)for(let x=80;x<180;x++){
      const at=(y*1200+x)*4;
      if(pixels[at]!==8||pixels[at+1]!==9||pixels[at+2]!==11)portraitPixels++;
    }
    if(portraitPixels<64)throw new Error("Portrait could not be decoded. Upload the original image again.");
    return {png:rendered.asPng(),layout,portraitPixels};
  }finally{rendered.free();renderer.free();}
}
