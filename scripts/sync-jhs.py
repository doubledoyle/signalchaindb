from __future__ import annotations
import json,re,time
from datetime import date
from pathlib import Path
from urllib.parse import urljoin,urlparse
import requests
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data"/"jhs-enriched.generated.json"
BASE="https://jhspedals.info"
HEADERS={"User-Agent":"SignalChainDB catalog research/1.0 (+https://github.com/doubledoyle/signalchaindb)"}
COLLECTIONS=[
 "/collections/3-series","/collections/overdrive-distortions","/collections/fuzz-distortion",
 "/collections/modulation","/collections/reverb","/collections/boost","/collections/compression",
 "/collections/delay","/collections/preamp","/collections/utilities"]
SKIP_TITLE_TERMS=["bundle","collection","amp pack","shirt","hat","sticker","book","gift card","poster","patch","mug","socks","strap","download","made on earth for rising stars","relevator guitar"]

def get(url:str)->requests.Response:
    last=None
    for attempt in range(5):
        r=requests.get(url,headers=HEADERS,timeout=30)
        last=r
        if r.status_code!=429:
            r.raise_for_status();return r
        time.sleep(1.5*(attempt+1))
    assert last is not None
    last.raise_for_status();return last

def norm(s:str)->str:
    return re.sub(r"[^a-z0-9]+","-",s.lower().replace("®","").replace("™","")).strip("-")
def clean(s:str)->str:return re.sub(r"\s+"," ",s).strip()
def meta(soup:BeautifulSoup,key:str):
    t=soup.find("meta",attrs={"property":key}) or soup.find("meta",attrs={"name":key})
    return clean(t.get("content")) if t and t.get("content") else None

def discover():
    found={}
    for path in COLLECTIONS:
        try:soup=BeautifulSoup(get(urljoin(BASE,path)).text,"html.parser")
        except Exception as e:print("collection-skip",path,e);continue
        category=path.rsplit("/",1)[-1]
        for a in soup.find_all("a",href=True):
            href=a.get("href") or ""
            if "/products/" not in href:continue
            purl=urljoin(BASE,href.split("?")[0])
            if urlparse(purl).netloc!=urlparse(BASE).netloc:continue
            handle=purl.rstrip("/").rsplit("/",1)[-1]
            rec=found.setdefault(handle,{"url":purl,"categories":set()});rec["categories"].add(category)
    return found

def money(text):
    m=re.search(r"\$\s*([0-9]+(?:\.[0-9]{1,2})?)",text);return float(m.group(1)) if m else None

def specs(text):
    out={};low=text.lower()
    if re.search(r"\b9\s*v(?:olt)?s?\b",low):out["voltage_v"]=9.0
    if any(x in low for x in ["center negative","centre negative","negative center"]):out["polarity"]="center-negative"
    if re.search(r"2\.1\s*mm",low):out["power_connector"]="2.1 mm barrel"
    for pat in [r"consumes\s*([0-9.]+)\s*ma",r"current(?: draw)?\s*[:\-]?\s*([0-9.]+)\s*ma",r"([0-9.]+)\s*ma\s*(?:max|maximum|current)"]:
        m=re.search(pat,low,re.I)
        if m:out["current_ma"]=int(float(m.group(1)));break
    m=re.search(r"([0-9.]+)\s*(?:in|″|\")\s*[x×]\s*([0-9.]+)\s*(?:in|″|\")\s*[x×]\s*([0-9.]+)\s*(?:in|″|\")",text,re.I)
    if m:
        vals=[float(m.group(i))*25.4 for i in range(1,4)]
        # JHS commonly states width x length/depth x height, e.g. 2.6 x 4.8 x 1.6.
        out.update(width_mm=round(vals[0],1),depth_mm=round(vals[1],1),height_mm=round(vals[2],1))
    return out

def controls(soup,pid,start):
    out=[];seen=set()
    keywords=["volume","level","gain","drive","tone","bass","mid","treble","mix","blend","time","delay","repeat","feedback","rate","speed","depth","reverb","decay","fuzz","boost","comp","attack","release","sustain","filter","freq","frequency","mode","toggle","switch","bias","presence","body","air","range","verb","mod","octave","pitch","texture","master"]
    for tag in soup.find_all(["p","li"]):
        text=clean(tag.get_text(" ",strip=True))
        if not 4<=len(text)<=700:continue
        m=re.match(r"^([A-Za-z0-9 /+&'’.-]{2,35})\s*[:\-–]\s*(.+)$",text)
        if m:name,note=m.group(1).strip(),m.group(2).strip()
        else:
            strong=tag.find(["strong","b"])
            if not strong:continue
            raw=clean(strong.get_text(" ",strip=True));name=raw.rstrip(":-–");note=clean(text[len(raw):]).lstrip(":-– ")
            if not note:continue
        key=norm(name)
        if not key or key in seen or any(x in key for x in ["power","dimensions","specifications","warranty","shipping","weight"]):continue
        if len(name)>35 or len(note)<3:continue
        if not (any(k in key for k in keywords) or len(name.split())<=3):continue
        seen.add(key);hay=(name+" "+note).lower();ctype="toggle" if any(x in hay for x in ["toggle","switch","three-way","3-way","two-way","2-way"]) else "knob"
        family="other"
        if any(x in key for x in ["mix","blend","wet","dry"]):family="mix"
        elif any(x in key for x in ["time","delay"]):family="time"
        elif any(x in key for x in ["rate","speed"]):family="rate"
        elif "depth" in key:family="depth"
        elif any(x in key for x in ["tone","treble","bass","mid","freq","frequency","filter","presence"]):family="tone"
        elif any(x in key for x in ["gain","drive","fuzz","distortion"]):family="gain"
        elif any(x in key for x in ["level","volume","output","master"]):family="level"
        elif any(x in key for x in ["reverb","verb","decay"]):family="reverb"
        elif any(x in key for x in ["pitch","octave"]):family="pitch"
        out.append({"id":start,"product_id":pid,"name":name,"parameter_family":family,"control_type":ctype,"value_type":"descriptive","min_value":None,"max_value":None,"unit":None,"midi_cc":None,"enum_values":None,"quantification_method":"manufacturer_setting","source_type":"manufacturer_page","notes":note[:600],"display_value":None});start+=1
    return out,start

def main():
    found=discover();print("discovered",len(found),"unique product links")
    products=[];sources=[];images={};params=[];param_id=40000;pid=11000
    for handle,rec in sorted(found.items()):
        try:
            time.sleep(.18);url=rec["url"];soup=BeautifulSoup(get(url).text,"html.parser")
            title=meta(soup,"og:title") or (soup.find("h1").get_text(" ",strip=True) if soup.find("h1") else handle.replace("-"," ").title())
            title=clean(re.sub(r"\s*[–|-]\s*JHS Pedals.*$","",title,flags=re.I))
            if any(term in title.lower() for term in SKIP_TITLE_TERMS):print("skip-non-device",title);continue
            desc=meta(soup,"og:description") or "";text=clean(soup.get_text(" ",strip=True));sp=specs(text);slug=f"jhs-{norm(title)}"
            category="Utility" if "utilities" in rec["categories"] else "Effects Pedal";category_slug="utility" if category=="Utility" else "effects-pedal"
            product={"id":pid,"name":title,"slug":slug,"product_status":"active","verification_status":"verified" if sp else "catalog_only","manufacturer_url":url,"description":desc[:700] if desc else "JHS Pedals device.","msrp_usd":money(text),"verified_at":str(date.today()) if sp else None,"brand":"JHS Pedals","brand_slug":"jhs-pedals","category":category,"category_slug":category_slug,"width_mm":None,"depth_mm":None,"height_mm":None,"weight_g":None,"voltage_v":None,"current_ma":None,"polarity":None,"power_connector":None,"official_adapter":None,"power_notes":None,"source_count":1};product.update(sp);products.append(product)
            sources.append({"product_id":pid,"source_type":"manufacturer","title":f"{title} — JHS Pedals","publisher":"JHS Pedals","url":url,"accessed_at":str(date.today()),"notes":"Official JHS product page used for catalog status, image, description, controls, and technical specifications where published."})
            image=meta(soup,"og:image") or meta(soup,"twitter:image")
            if image:images[slug]={"image_url":image,"image_source":url,"image_credit":"JHS Pedals"}
            ps,param_id=controls(soup,pid,param_id);params.extend(ps);print("ok",title,len(ps),"controls",sp);pid+=1
        except Exception as e:print("skip",rec.get("url"),e)
    OUT.write_text(json.dumps({"generated_at":str(date.today()),"products":products,"effect_parameters":params,"sources":sources,"images":images},indent=2,ensure_ascii=False)+"\n")
    print(f"wrote {OUT}: {len(products)} products, {len(params)} controls, {len(images)} images")
if __name__=="__main__":main()
