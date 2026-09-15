from __future__ import annotations

import html
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "earthquaker-enriched.generated.json"
BASE = "https://www.earthquakerdevices.com"
CATALOG = f"{BASE}/devices"
HEADERS = {"User-Agent": "SignalChainDB catalog research/1.0 (+https://github.com/doubledoyle/signalchaindb)"}

PRODUCTS = [
("A/B Box","earthquaker-a-b-box"),("Acapulco Gold","earthquaker-acapulco-gold"),("Afterneath","earthquaker-afterneath"),("Astral Destiny","earthquaker-astral-destiny"),("Aurelius","earthquaker-aurelius"),("Avalanche Run","earthquaker-avalanche-run"),("Barrows","earthquaker-barrows"),("Bellows Legacy Reissue","earthquaker-bellows-legacy-reissue"),("Bit Commander","earthquaker-bit-commander"),("Blumes","earthquaker-blumes"),("Buffer/Preamp","earthquaker-buffer-preamp"),("Buffer/Splitter","earthquaker-buffer-splitter"),("Chelsea","earthquaker-chelsea"),("Data Corrupter","earthquaker-data-corrupter"),("Disaster Transport Legacy Reissue","earthquaker-disaster-transport-legacy-reissue"),("Dispatch Master","earthquaker-dispatch-master"),("Easy Listening","earthquaker-easy-listening"),("Flexi Loops","earthquaker-flexi-loops"),("Four to One Mixer","earthquaker-four-to-one-mixer"),("Fuzz Master General Legacy Reissue","earthquaker-fuzz-master-general-legacy-reissue"),("Gary","earthquaker-gary"),("Ghost Echo","earthquaker-ghost-echo"),("Grand Orbiter","earthquaker-grand-orbiter"),("Hizumitas","earthquaker-hizumitas"),("Hoof","earthquaker-hoof"),("Hummingbird","earthquaker-hummingbird"),("Ledges","earthquaker-ledges"),("One to Four Splitter","earthquaker-one-to-four-splitter"),("Passive ABY Box","earthquaker-passive-aby-box"),("Plumes","earthquaker-plumes"),("Pyramids","earthquaker-pyramids"),("Rainbow Machine","earthquaker-rainbow-machine"),("Scrolls","earthquaker-scrolls"),("Sea Machine","earthquaker-sea-machine"),("Silos","earthquaker-silos"),("Spatial Delivery","earthquaker-spatial-delivery"),("Special Cranker","earthquaker-special-cranker"),("Stereo Easy Listening","earthquaker-stereo-easy-listening"),("Sunn O))) HalfLife","earthquaker-sunn-o-halflife"),("Sunn O))) Life Pedal","earthquaker-sunn-o-life-pedal"),("Swiss Things","earthquaker-swiss-things"),("Time Shadows","earthquaker-time-shadows"),("Tone Job","earthquaker-tone-job"),("Towers","earthquaker-towers"),("ZEQD-Pre","earthquaker-zeqd-pre"),("Zoar","earthquaker-zoar")
]

ALIASES = {
    "a b box": "/ab-box",
    "disaster transport legacy reissue": "/disaster-transport-reissue",
    "passive aby box": "/passive-aby-box",
    "sunn o halflife": "/half-life",
    "sunn o life pedal": "/life-pedal",
    "zeqd pre": "/zeqd-pre",
}

def norm(s: str) -> str:
    s = html.unescape(s).lower().replace("®", "").replace("™", "")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def compact(s: str) -> str:
    return norm(s).replace(" ", "")

def get(url: str) -> requests.Response:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r

def discover_links() -> dict[str, str]:
    soup = BeautifulSoup(get(CATALOG).text, "html.parser")
    found: dict[str, str] = {}
    for a in soup.find_all("a", href=True):
        href = a.get("href") or ""
        if not href or href.startswith("#"):
            continue
        url = urljoin(BASE, href)
        if urlparse(url).netloc != urlparse(BASE).netloc:
            continue
        text = a.get_text(" ", strip=True)
        key = norm(text)
        if key and url != CATALOG:
            found.setdefault(key, url)
    return found

def page_for(name: str, links: dict[str, str]) -> str:
    key = norm(name)
    if key in ALIASES:
        return urljoin(BASE, ALIASES[key])
    exact = [url for txt, url in links.items() if txt == key]
    if exact:
        return exact[0]
    c = compact(name)
    fuzzy = [(txt, url) for txt, url in links.items() if compact(txt) == c or c in compact(txt)]
    if fuzzy:
        return sorted(fuzzy, key=lambda x: len(x[0]))[0][1]
    slug = re.sub(r"[^a-z0-9]+", "-", key).strip("-")
    slug = slug.replace("-legacy-reissue", "") if "legacy reissue" in key else slug
    return f"{BASE}/{slug}"

def meta_image(soup: BeautifulSoup) -> str | None:
    for attrs in ({"property":"og:image"},{"name":"twitter:image"}):
        tag = soup.find("meta", attrs=attrs)
        if tag and tag.get("content"):
            return urljoin(BASE, tag["content"])
    img = soup.find("img", src=True)
    return urljoin(BASE, img["src"]) if img else None

def section_text(soup: BeautifulSoup, heading_name: str) -> list[str]:
    heading = None
    for h in soup.find_all(re.compile(r"^h[1-6]$")):
        if norm(h.get_text(" ", strip=True)) == norm(heading_name):
            heading = h
            break
    if not heading:
        return []
    out: list[str] = []
    for node in heading.find_all_next():
        if node is heading:
            continue
        if node.name and re.match(r"^h[1-6]$", node.name):
            break
        if node.name in {"li", "p"}:
            t = node.get_text(" ", strip=True)
            if t and t not in out:
                out.append(t)
    return out

def tech(text: str) -> dict:
    result = {}
    m = re.search(r"(?:Dimensions|Measures)\s*:?\s*([0-9.]+)\s*x\s*([0-9.]+)\s*x\s*([0-9.]+)\s*in\.?\s*\(([0-9.]+)\s*x\s*([0-9.]+)\s*x\s*([0-9.]+)\s*mm\)", text, re.I)
    if m:
        result["depth_mm"] = float(m.group(4))
        result["width_mm"] = float(m.group(5))
        result["height_mm"] = float(m.group(6))
    m = re.search(r"Current Draw\s*:?\s*([0-9.]+)\s*mA", text, re.I)
    if m:
        result["current_ma"] = int(float(m.group(1)))
    if re.search(r"standard\s+9\s*volt\s+DC", text, re.I):
        result["voltage_v"] = 9.0
    if re.search(r"negative\s+center", text, re.I):
        result["polarity"] = "center-negative"
    if re.search(r"2\.1\s*mm", text, re.I):
        result["power_connector"] = "2.1 mm barrel"
    if result.get("voltage_v") == 9.0 and result.get("polarity") == "center-negative":
        result["power_notes"] = "Standard 9 V DC power. 2.1 mm center-negative barrel where published by EarthQuaker Devices. Do not run at higher voltages."
    return result

def parse_control_line(t: str):
    m = re.match(r"^(?:\d+[.)]\s*)?([A-Za-z][A-Za-z0-9 /+&'’-]{1,35})(?:\s*\([^)]*\))?\s*[:–-]\s*(.+)$", t)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    m = re.match(r"^(?:The\s+)?([A-Za-z][A-Za-z0-9 /+&'’-]{1,30})(?:\s*\([^)]*\))?\s+(?:control\s+)?(?:sets|controls|adjusts|selects|is|blends|determines)\s+(.+)$", t, re.I)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return None

def control_params(product_id: int, items: list[str], start_id: int) -> tuple[list[dict], int]:
    out = []
    seen = set()
    for t in items:
        t = re.sub(r"\s+", " ", t).strip()
        if len(t) < 4 or len(t) > 650:
            continue
        parsed = parse_control_line(t)
        if not parsed:
            continue
        name, note = parsed
        if norm(name) in {"audio samples","guitar samples","bass samples","synth samples","tech specs","power","dimensions","current draw"}:
            continue
        key = norm(name)
        if key in seen:
            continue
        seen.add(key)
        hay = f"{name} {note}".lower()
        control_type = "toggle" if "toggle" in hay or "switch" in hay or "mode" == key else "knob"
        family = "other"
        if any(x in key for x in ["mix","blend","wet","dry"]): family = "mix"
        elif any(x in key for x in ["time","delay"]): family = "time"
        elif any(x in key for x in ["rate","speed"]): family = "rate"
        elif any(x in key for x in ["depth"]): family = "depth"
        elif any(x in key for x in ["tone","treble","bass","mid","frequency","freq","filter"]): family = "tone"
        elif any(x in key for x in ["gain","drive","fuzz","distortion"]): family = "gain"
        elif any(x in key for x in ["level","volume","output","amplitude","magnitude"]): family = "level"
        elif "reverb" in key or "decay" in key: family = "reverb"
        elif "pitch" in key or "octave" in key: family = "pitch"
        out.append({
            "id": start_id,
            "product_id": product_id,
            "name": name,
            "parameter_family": family,
            "control_type": control_type,
            "value_type": "descriptive",
            "min_value": None,
            "max_value": None,
            "unit": None,
            "midi_cc": None,
            "enum_values": None,
            "quantification_method": "manufacturer_setting",
            "source_type": "manufacturer_page",
            "notes": note,
            "display_value": None,
        })
        start_id += 1
    return out, start_id

def main() -> None:
    links = discover_links()
    products = []
    parameters = []
    sources = []
    images = {}
    param_id = 30000
    fetched = 0
    for idx, (name, slug) in enumerate(PRODUCTS):
        product_id = 10000 + idx
        url = page_for(name, links)
        try:
            r = get(url)
            soup = BeautifulSoup(r.text, "html.parser")
            title = norm(soup.title.get_text(" ", strip=True) if soup.title else "")
            if compact(name).replace("legacyreissue", "")[:8] not in compact(title + " " + soup.get_text(" ", strip=True)):
                raise RuntimeError("page did not appear to match product")
            all_text = soup.get_text(" ", strip=True)
            fields = tech(all_text)
            fields.update({
                "slug": slug,
                "manufacturer_url": url,
                "verified_at": str(date.today()),
                "source_count": 1,
            })
            if any(k in fields for k in ("current_ma","voltage_v","width_mm","height_mm")):
                fields["verification_status"] = "verified"
            products.append(fields)
            img = meta_image(soup)
            if img:
                images[slug] = {"image_url": img, "image_source": url, "image_credit": "EarthQuaker Devices"}
            items = section_text(soup, "Controls")
            ps, param_id = control_params(product_id, items, param_id)
            parameters.extend(ps)
            sources.append({
                "product_id": product_id,
                "source_type": "manufacturer",
                "title": f"{name} — EarthQuaker Devices",
                "publisher": "EarthQuaker Devices",
                "url": url,
                "accessed_at": str(date.today()),
                "notes": "Official manufacturer product page used for image, controls, power, current draw, and dimensions where published."
            })
            fetched += 1
            print("ok", slug, url, len(ps), "controls")
        except Exception as exc:
            print("skip", slug, url, exc)
    OUT.write_text(json.dumps({
        "generated_at": str(date.today()),
        "fetched_products": fetched,
        "products": products,
        "effect_parameters": parameters,
        "sources": sources,
        "images": images,
    }, indent=2) + "\n")
    print(f"wrote {OUT}: {fetched}/{len(PRODUCTS)} products, {len(parameters)} controls, {len(images)} images")

if __name__ == "__main__":
    main()
