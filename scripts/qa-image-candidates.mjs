import {writeFile} from "node:fs/promises";

const targets=[
  ["quad-cortex-mini","Quad Cortex mini","Neural DSP","https://neuraldsp.com/quad-cortex-mini"],
  ["nano-cortex","Nano Cortex","Neural DSP","https://neuraldsp.com/nano-cortex"],
  ["ml10x","ML10X","Morningstar Engineering","https://www.morningstar.io/ml10x"],
  ["ml5","ML5","Morningstar Engineering","https://shop.morningstar.io/products/ML5-p125258809"],
  ["mc6-pro","MC6 PRO","Morningstar Engineering","https://shop.morningstar.io/products/MC6-PRO-p531932004"],
  ["mc8","MC8","Morningstar Engineering","https://shop.morningstar.io/products/MC8-p161734004"],
  ["dl4-mkii","DL4 MkII","Line 6","https://line6.com/effects-pedals/dl4-mkii/"],
  ["line6-ex2","EX2","Line 6","https://line6.com/helix-stadium/"],
  ["expand-d10","Expand D10","Line 6","https://line6.com/helix-stadium/"],
  ["line-6-helix-floor","Helix Floor","Line 6","https://line6.com/helix/"],
  ["line-6-helix-lt","Helix LT","Line 6","https://line6.com/helix/helix-lt.html"],
  ["helix-stadium-floor","Helix Stadium Floor","Line 6","https://line6.com/helix-stadium/"],
  ["helix-stadium-xl-floor","Helix Stadium XL Floor","Line 6","https://line6.com/helix-stadium/"],
  ["line-6-hx-effects","HX Effects","Line 6","https://line6.com/hx-effects/"],
  ["line-6-hx-one","HX One","Line 6","https://line6.com/hx-one/"],
  ["line-6-hx-stomp","HX Stomp","Line 6","https://line6.com/hx-stomp/"],
  ["line-6-hx-stomp-xl","HX Stomp XL","Line 6","https://line6.com/hx-stomp-xl/"],
  ["pod-express-bass","POD Express Bass","Line 6","https://line6.com/podexpress/bass-effects/"],
  ["pod-express-black","POD Express Black","Line 6","https://line6.com/podexpress/guitar-effects-black"],
  ["pod-express-guitar","POD Express Guitar","Line 6","https://line6.com/podexpress/guitar-effects/"],
  ["line-6-pod-go","POD Go","Line 6","https://line6.com/podgo/"],
  ["line-6-pod-go-wireless","POD Go Wireless","Line 6","https://line6.com/podgo/"],
  ["powercab-112-plus","Powercab 112 Plus","Line 6","https://line6.com/powercab/"],
  ["powercab-212-plus","Powercab 212 Plus","Line 6","https://line6.com/powercab/"],
  ["powercab-cl-112","Powercab CL 112","Line 6","https://line6.com/powercab/"],
  ["powercab-cl-212","Powercab CL 212","Line 6","https://line6.com/powercab/"],
  ["tonex-one","TONEX ONE","IK Multimedia","https://www.ikmultimedia.com/products/tonexone/"],
  ["boss-dd-500","DD-500","BOSS","https://www.boss.info/us/products/dd-500/"]
].map(([slug,name,brand,url])=>({slug,name,brand,url}));

const parseAttrs=tag=>Object.fromEntries([...tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map(m=>[m[1].toLowerCase(),m[3]]));
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const resolve=(v,b)=>{try{return new URL(v,b).href}catch{return null}};
const wixOriginal=url=>url.includes("static.wixstatic.com/media/")?url.split("/v1/")[0]:url;

function candidates(html,page,target){
  const out=[];
  const full=norm(target.name);
  const tokens=full.split(/\s+/).filter(t=>t.length>1 && !["the","plus"].includes(t));
  const add=(url,alt,kind,w=0,h=0)=>{
    if(!url) return;
    url=wixOriginal(url);
    const hay=norm(`${alt} ${url}`);
    let score=0;
    if(hay.includes(full)) score+=120;
    for(const t of tokens) if(hay.includes(t)) score+=18;
    if(/hero|product|top|front|main|storeimage|topdown/i.test(url+" "+alt)) score+=28;
    if(/rear|back\b|side\b|input|output|\bio\b|connection|featurebox|featureboxes|section|movie|banner|lifestyle|headphone|guitar leaning|person|artist/i.test(url+" "+alt)) score-=42;
    if(/logo|icon|sprite|badge|loading|placeholder/i.test(url+" "+alt)) score-=120;
    if(/^data:/i.test(url)||/\.svg(?:\?|$)|\.gif(?:\?|$)/i.test(url)) score-=140;
    if(w>=900||h>=900) score+=18; else if(w&&h&&Math.max(w,h)<350) score-=35;
    if(/blur_/i.test(url)) score-=80;
    out.push({score,kind,alt,width:w||null,height:h||null,url});
  };
  for(const m of html.matchAll(/<meta\b[^>]*>/gi)){
    const a=parseAttrs(m[0]); const k=(a.property||a.name||"").toLowerCase();
    if(["og:image","og:image:url","twitter:image","twitter:image:src"].includes(k)&&a.content) add(resolve(a.content,page),"",k);
  }
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
    const a=parseAttrs(m[0]);
    const vals=[];
    if(a.src) vals.push(a.src); if(a["data-src"]) vals.push(a["data-src"]); if(a["data-lazy-src"]) vals.push(a["data-lazy-src"]); if(a["data-original"]) vals.push(a["data-original"]);
    if(a.srcset) vals.push(...a.srcset.split(",").map(x=>x.trim().split(/\s+/)[0]));
    for(const v of vals) add(resolve(v,page),a.alt||"","img",Number(a.width||0),Number(a.height||0));
  }
  const seen=new Set();
  return out.sort((a,b)=>b.score-a.score).filter(x=>!seen.has(x.url)&&seen.add(x.url)).slice(0,12);
}

const report=[];
for(const t of targets){
  try{
    const r=await fetch(t.url,{redirect:"follow",headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"},signal:AbortSignal.timeout(20000)});
    const html=await r.text();
    report.push({...t,status:r.status,final_url:r.url,candidates:candidates(html,r.url,t)});
    console.log(t.slug,r.status);
  }catch(e){report.push({...t,error:String(e?.message||e),candidates:[]});}
}
await writeFile("data/image-qa-candidates.json",JSON.stringify(report,null,2)+"\n");
