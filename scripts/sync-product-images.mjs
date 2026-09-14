import {readFile,writeFile} from "node:fs/promises";

const raw=JSON.parse(await readFile(new URL("../data/signalchain.json",import.meta.url),"utf8"));
const outputUrl=new URL("../data/product-images.generated.json",import.meta.url);
const reportUrl=new URL("../data/product-images-report.json",import.meta.url);

let previous={};
try{previous=JSON.parse(await readFile(outputUrl,"utf8"));}catch{}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const normalize=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"");
const parseAttrs=tag=>Object.fromEntries([...tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map(m=>[m[1].toLowerCase(),m[3]]));
const resolveUrl=(value,base)=>{try{return new URL(value,base).href}catch{return null}};

function extractCandidates(html,pageUrl,product){
  const candidates=[];
  const pname=normalize(product.name);
  const pslug=normalize(product.slug);

  for(const m of html.matchAll(/<meta\b[^>]*>/gi)){
    const a=parseAttrs(m[0]);
    const key=(a.property||a.name||"").toLowerCase();
    if(!["og:image","og:image:url","twitter:image","twitter:image:src"].includes(key)||!a.content) continue;
    const url=resolveUrl(a.content,pageUrl); if(!url) continue;
    let score=key.startsWith("og:")?55:45;
    const nu=normalize(url);
    if(pname&&nu.includes(pname)) score+=35;
    if(pslug&&nu.includes(pslug)) score+=25;
    if(/\/products?\//i.test(url)) score+=10;
    if(/logo|icon|sprite|avatar/i.test(url)) score-=60;
    if(/thumb|thumbnail/i.test(url)) score-=20;
    if(/assets\/images\/products\/main/i.test(url)) score-=18;
    candidates.push({url,score,kind:key});
  }

  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
    const a=parseAttrs(m[0]);
    const rawSrc=a.src||a["data-src"]||a["data-lazy-src"]||a["data-original"]||a.srcset?.split(",").pop()?.trim().split(/\s+/)[0];
    if(!rawSrc) continue;
    const url=resolveUrl(rawSrc,pageUrl); if(!url) continue;
    const alt=a.alt||"";
    const hay=normalize(`${alt} ${url}`);
    let score=8;
    if(pname&&hay.includes(pname)) score+=55;
    const nameTokens=String(product.name).toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>=2);
    score+=nameTokens.filter(t=>String(alt).toLowerCase().includes(t)||String(url).toLowerCase().includes(t)).length*8;
    if(pslug&&normalize(url).includes(pslug)) score+=25;
    if(/hero|feature|product/i.test(url)) score+=15;
    if(/\/products?\//i.test(url)) score+=10;
    if(/logo|icon|sprite|avatar|badge/i.test(url)) score-=70;
    if(/thumb|thumbnail/i.test(url)) score-=20;
    if(/assets\/images\/products\/main/i.test(url)) score-=18;
    const w=Number(a.width||0),h=Number(a.height||0);
    if(w>=800||h>=800) score+=12;
    candidates.push({url,score,kind:"img"});
  }

  const seen=new Set();
  return candidates.sort((a,b)=>b.score-a.score).filter(x=>!seen.has(x.url)&&seen.add(x.url));
}

async function validImage(url){
  try{
    const res=await fetch(url,{redirect:"follow",headers:{"User-Agent":"SignalChainDB image metadata sync/1.0","Accept":"image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8","Range":"bytes=0-4095"},signal:AbortSignal.timeout(12000)});
    const type=(res.headers.get("content-type")||"").toLowerCase();
    const finalUrl=res.url;
    await res.body?.cancel();
    if(!res.ok||!type.startsWith("image/")) return null;
    return finalUrl;
  }catch{return null}
}

async function discover(product){
  const pageUrl=product.manufacturer_url;
  if(!pageUrl) return {ok:false,reason:"no manufacturer_url"};
  try{
    const res=await fetch(pageUrl,{redirect:"follow",headers:{"User-Agent":"Mozilla/5.0 (compatible; SignalChainDB/1.0; +https://github.com/doubledoyle/signalchaindb)","Accept":"text/html,application/xhtml+xml"},signal:AbortSignal.timeout(15000)});
    if(!res.ok) return {ok:false,reason:`page ${res.status}`};
    const html=await res.text();
    const finalPage=res.url||pageUrl;
    const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").replace(/<[^>]+>/g," ").trim();
    const candidates=extractCandidates(html,finalPage,product);
    for(const c of candidates.slice(0,10)){
      const checked=await validImage(c.url);
      if(checked){
        return {ok:true,meta:{image_url:checked,image_source:finalPage,image_credit:product.brand},debug:{title,candidate_kind:c.kind,score:c.score}};
      }
    }
    return {ok:false,reason:"no valid image candidate",title,candidate_count:candidates.length};
  }catch(err){return {ok:false,reason:String(err?.message||err)}}
}

const products=raw.products||[];
const generated={...previous};
const report={generated_at:new Date().toISOString(),total_products:products.length,found:0,kept_previous:0,failed:0,results:[]};
let cursor=0;
const concurrency=5;

async function worker(){
  while(true){
    const i=cursor++;
    if(i>=products.length) return;
    const product=products[i];
    const result=await discover(product);
    if(result.ok){
      generated[product.slug]=result.meta;
      report.found++;
      report.results.push({slug:product.slug,name:product.name,brand:product.brand,status:"found",...result.debug,image_url:result.meta.image_url,image_source:result.meta.image_source});
      console.log(`✓ ${product.brand} ${product.name}`);
    }else if(previous[product.slug]?.image_url){
      generated[product.slug]=previous[product.slug];
      report.kept_previous++;
      report.results.push({slug:product.slug,name:product.name,brand:product.brand,status:"kept_previous",reason:result.reason});
      console.log(`↺ ${product.brand} ${product.name} (${result.reason})`);
    }else{
      delete generated[product.slug];
      report.failed++;
      report.results.push({slug:product.slug,name:product.name,brand:product.brand,status:"failed",reason:result.reason,title:result.title||null,candidate_count:result.candidate_count??null});
      console.log(`✗ ${product.brand} ${product.name}: ${result.reason}`);
    }
    await sleep(120);
  }
}

await Promise.all(Array.from({length:concurrency},()=>worker()));

const ordered={};
for(const p of products) if(generated[p.slug]) ordered[p.slug]=generated[p.slug];
await writeFile(outputUrl,JSON.stringify(ordered,null,2)+"\n");
report.results.sort((a,b)=>a.brand.localeCompare(b.brand)||a.name.localeCompare(b.name));
await writeFile(reportUrl,JSON.stringify(report,null,2)+"\n");
console.log(`\nFound ${report.found}/${report.total_products}; kept ${report.kept_previous}; failed ${report.failed}.`);
