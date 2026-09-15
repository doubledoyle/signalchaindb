from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "jhs-enriched.generated.json"
BASE = "https://jhspedals.info"
HEADERS = {"User-Agent": "SignalChainDB catalog research/1.0 (+https://github.com/doubledoyle/signalchaindb)"}

COLLECTIONS = [
    "/collections/3-series",
    "/collections/overdrive",
    "/collections/fuzz-distortion",
    "/collections/modulation",
    "/collections/reverb",
    "/collections/boost",
    "/collections/compression",
    "/collections/delay",
    "/collections/preamp",
    "/collections/utilities",
]

SKIP_TITLE_TERMS = [
    "bundle", "collection", "amp pack", "shirt", "hat", "sticker", "book",
    "gift card", "poster", "patch", "mug", "socks", "strap", "download",
]


def get(url: str) -> requests.Response:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r


def norm(s: str) -> str:
    s = s.lower().replace("®", "").replace("™", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def discover_products() -> dict[str, dict]:
    found: dict[str, dict] = {}
    for path in COLLECTIONS:
        url = urljoin(BASE, path)
        try:
            soup = BeautifulSoup(get(url).text, "html.parser")
        except Exception as exc:
            print("collection-skip", url, exc)
            continue
        category = path.rsplit("/", 1)[-1]
        for a in soup.find_all("a", href=True):
            href = a.get("href") or ""
            if "/products/" not in href:
                continue
            purl = urljoin(BASE, href.split("?")[0])
            if urlparse(purl).netloc != urlparse(BASE).netloc:
                continue
            handle = purl.rstrip("/").rsplit("/", 1)[-1]
            if not handle:
                continue
            title = a.get_text(" ", strip=True)
            rec = found.setdefault(handle, {"url": purl, "categories": set(), "title_hint": title})
            rec["categories"].add(category)
    return found


def parse_money(text: str) -> float | None:
    m = re.search(r"\$\s*([0-9]+(?:\.[0-9]{1,2})?)", text)
    return float(m.group(1)) if m else None


def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def first_meta(soup: BeautifulSoup, prop: str) -> str | None:
    tag = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
    if tag and tag.get("content"):
        return clean_text(tag["content"])
    return None


def extract_specs(text: str) -> dict:
    result: dict = {}
    lower = text.lower()
    # Voltage / polarity / connector
    if re.search(r"\b9\s*v(?:olt)?s?\b", lower):
        result["voltage_v"] = 9.0
    if "center negative" in lower or "centre negative" in lower or "negative center" in lower:
        result["polarity"] = "center-negative"
    if re.search(r"2\.1\s*mm", lower):
        result["power_connector"] = "2.1 mm barrel"
    # Current draw
    current_patterns = [
        r"current(?: draw)?\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*ma",
        r"([0-9]+(?:\.[0-9]+)?)\s*ma\s*(?:max|maximum|current)",
    ]
    for pat in current_patterns:
        m = re.search(pat, lower, re.I)
        if m:
            result["current_ma"] = int(float(m.group(1)))
            break
    # Dimensions, common JHS form: 4.8” x 2.6” x 1.6”
    m = re.search(r"([0-9.]+)\s*(?:in|\u2033|\")\s*[x×]\s*([0-9.]+)\s*(?:in|\u2033|\")\s*[x×]\s*([0-9.]+)\s*(?:in|\u2033|\")", text, re.I)
    if m:
        vals = [float(m.group(i)) * 25.4 for i in range(1,4)]
        # Treat common pedal listing as length x width x height.
        result["depth_mm"] = round(vals[0], 1)
        result["width_mm"] = round(vals[1], 1)
        result["height_mm"] = round(vals[2], 1)
    return result


def infer_category(categories: set[str], title: str) -> tuple[str, str]:
    if "utilities" in categories:
        return "Utility", "utility"
    return "Effects Pedal", "effects-pedal"


def extract_controls(soup: BeautifulSoup, product_id: int, start_id: int) -> tuple[list[dict], int]:
    controls: list[dict] = []
    seen: set[str] = set()
    # JHS descriptions often use strong/bold labels followed by explanatory text.
    for tag in soup.find_all(["p", "li"]):
        text = clean_text(tag.get_text(" ", strip=True))
        if len(text) < 4 or len(text) > 700:
            continue
        m = re.match(r"^([A-Za-z0-9 /+&'’.-]{2,35})\s*[:\-–]\s*(.+)$", text)
        if not m:
            strong = tag.find(["strong", "b"])
            if strong:
                name = clean_text(strong.get_text(" ", strip=True)).rstrip(":-–")
                note = clean_text(text[len(strong.get_text(" ", strip=True)):]).lstrip(":-– ")
                if name and note:
                    m = (name, note)
            if not m:
                continue
        if isinstance(m, tuple):
            name, note = m
        else:
            name, note = m.group(1).strip(), m.group(2).strip()
        key = norm(name)
        if not key or key in seen:
            continue
        if any(x in key for x in ["power", "dimensions", "specifications", "warranty", "shipping", "weight"]):
            continue
        if len(name) > 35 or len(note) < 3:
            continue
        # Conservative: only names likely to be physical controls.
        likely = any(word in key for word in [
            "volume","level","gain","drive","tone","bass","mid","treble","mix","blend","time","delay",
            "repeat","feedback","rate","speed","depth","reverb","decay","fuzz","boost","comp","attack",
            "release","sustain","filter","freq","frequency","mode","toggle","switch","bias","presence",
            "body","air","range","verb","mod","octave","pitch","texture","pre","post","master"
        ]) or len(name.split()) <= 3
        if not likely:
            continue
        seen.add(key)
        hay = f"{name} {note}".lower()
        control_type = "toggle" if any(x in hay for x in ["toggle", "switch", "three-way", "3-way", "two-way", "2-way"]) else "knob"
        family = "other"
        if any(x in key for x in ["mix","blend","wet","dry"]): family = "mix"
        elif any(x in key for x in ["time","delay"]): family = "time"
        elif any(x in key for x in ["rate","speed"]): family = "rate"
        elif "depth" in key: family = "depth"
        elif any(x in key for x in ["tone","treble","bass","mid","freq","frequency","filter","presence"]): family = "tone"
        elif any(x in key for x in ["gain","drive","fuzz","distortion"]): family = "gain"
        elif any(x in key for x in ["level","volume","output","master"]): family = "level"
        elif any(x in key for x in ["reverb","verb","decay"]): family = "reverb"
        elif any(x in key for x in ["pitch","octave"]): family = "pitch"
        controls.append({
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
            "notes": note[:600],
            "display_value": None,
        })
        start_id += 1
    return controls, start_id


def main() -> None:
    discovered = discover_products()
    print("discovered", len(discovered), "unique product links")
    products = []
    sources = []
    images = {}
    parameters = []
    param_id = 40000
    next_product_id = 11000

    for handle, rec in sorted(discovered.items()):
        url = rec["url"]
        categories: set[str] = rec["categories"]
        try:
            r = get(url)
            soup = BeautifulSoup(r.text, "html.parser")
            title = first_meta(soup, "og:title") or (soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else handle.replace("-", " ").title())
            title = clean_text(re.sub(r"\s*[–|-]\s*JHS Pedals.*$", "", title, flags=re.I))
            if any(term in title.lower() for term in SKIP_TITLE_TERMS):
                print("skip-non-device", title)
                continue
            desc = first_meta(soup, "og:description") or ""
            all_text = clean_text(soup.get_text(" ", strip=True))
            category, category_slug = infer_category(categories, title)
            slug = f"jhs-{norm(title)}"
            specs = extract_specs(all_text)
            image = first_meta(soup, "og:image") or first_meta(soup, "twitter:image")
            price = parse_money(all_text)
            product_id = next_product_id
            next_product_id += 1
            product = {
                "id": product_id,
                "name": title,
                "slug": slug,
                "product_status": "active",
                "verification_status": "verified" if specs else "catalog_only",
                "manufacturer_url": url,
                "description": desc[:700] if desc else "JHS Pedals device.",
                "msrp_usd": price,
                "verified_at": str(date.today()) if specs else None,
                "brand": "JHS Pedals",
                "brand_slug": "jhs-pedals",
                "category": category,
                "category_slug": category_slug,
                "width_mm": None,
                "depth_mm": None,
                "height_mm": None,
                "weight_g": None,
                "voltage_v": None,
                "current_ma": None,
                "polarity": None,
                "power_connector": None,
                "official_adapter": None,
                "power_notes": None,
                "source_count": 1,
            }
            product.update(specs)
            products.append(product)
            sources.append({
                "product_id": product_id,
                "source_type": "manufacturer",
                "title": f"{title} — JHS Pedals",
                "publisher": "JHS Pedals",
                "url": url,
                "accessed_at": str(date.today()),
                "notes": "Official JHS product page used for catalog status, image, description, controls, and technical specifications where published."
            })
            if image:
                images[slug] = {"image_url": image, "image_source": url, "image_credit": "JHS Pedals"}
            ps, param_id = extract_controls(soup, product_id, param_id)
            parameters.extend(ps)
            print("ok", title, len(ps), "controls", specs)
        except Exception as exc:
            print("skip", url, exc)

    OUT.write_text(json.dumps({
        "generated_at": str(date.today()),
        "products": products,
        "effect_parameters": parameters,
        "sources": sources,
        "images": images,
    }, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {OUT}: {len(products)} products, {len(parameters)} controls, {len(images)} images")

if __name__ == "__main__":
    main()
