from __future__ import annotations

import io
import re
from collections import deque
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
IMAGE_MAP = ROOT / "data" / "product-images.ts"
OUT_DIR = ROOT / "public" / "products" / "studio"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BLOCK_RE = re.compile(
    r'(?P<prefix>\s*"(?P<slug>[^"]+)":\{\s*\n\s*image_url:")(?P<url>[^"]+)(?P<suffix>",\s*\n\s*image_source:"[^"]+",\s*\n\s*image_credit:"[^"]+"\s*\n\s*\})',
    re.M,
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/152 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
}


def near_white(rgb: tuple[int, int, int], threshold: int = 226, chroma: int = 34) -> bool:
    r, g, b = rgb
    return min(r, g, b) >= threshold and max(r, g, b) - min(r, g, b) <= chroma


def has_white_background(im: Image.Image) -> bool:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    if w < 40 or h < 40 or rgba.getchannel("A").getextrema()[0] < 245:
        return False
    rgb = rgba.convert("RGB")
    band = max(2, int(min(w, h) * 0.045))
    step = max(1, min(w, h) // 180)
    sample = []
    for y in range(0, h, step):
        for x in range(0, w, step):
            if x < band or x >= w - band or y < band or y >= h - band:
                sample.append(rgb.getpixel((x, y)))
    if not sample:
        return False
    white_ratio = sum(near_white(p) for p in sample) / len(sample)
    pts = [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3), (w // 2, 2), (w // 2, h - 3), (2, h // 2), (w - 3, h // 2)]
    edge_ratio = sum(near_white(rgb.getpixel(p)) for p in pts) / len(pts)
    return white_ratio >= 0.68 and edge_ratio >= 0.75


def remove_edge_white(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    rgb = rgba.convert("RGB")
    w, h = rgba.size
    bg = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def candidate(x: int, y: int) -> bool:
        return near_white(rgb.getpixel((x, y)), threshold=218, chroma=42)

    def seed(x: int, y: int) -> None:
        i = y * w + x
        if not bg[i] and candidate(x, y):
            bg[i] = 1
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not bg[i] and candidate(nx, ny):
                    bg[i] = 1
                    q.append((nx, ny))

    mask = Image.frombytes("L", (w, h), bytes(255 if v else 0 for v in bg)).filter(ImageFilter.GaussianBlur(1.0))
    alpha = Image.eval(mask, lambda p: 255 - p)
    rgba.putalpha(alpha)
    bbox = alpha.getbbox()
    if bbox:
        l, t, r, b = bbox
        pad = max(10, int(min(w, h) * 0.025))
        rgba = rgba.crop((max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad)))
    return rgba


def studio_background(size: tuple[int, int]) -> Image.Image:
    w, h = size
    bg = Image.new("RGBA", size, (12, 15, 18, 255))
    grad = Image.new("RGBA", size)
    gd = ImageDraw.Draw(grad)
    for y in range(h):
        p = y / max(1, h - 1)
        c = int(31 - 15 * p)
        gd.line((0, y, w, y), fill=(c, c + 3, c + 6, 255))
    bg = Image.alpha_composite(bg, grad)

    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    cx, cy = w // 2, int(h * 0.43)
    rw, rh = int(w * 0.42), int(h * 0.36)
    g.ellipse((cx - rw, cy - rh, cx + rw, cy + rh), fill=(112, 136, 154, 72))
    glow = glow.filter(ImageFilter.GaussianBlur(int(w * 0.095)))
    bg = Image.alpha_composite(bg, glow)

    accent = Image.new("RGBA", size, (0, 0, 0, 0))
    a = ImageDraw.Draw(accent)
    a.ellipse((-int(w * .14), -int(h * .18), int(w * .52), int(h * .62)), fill=(126, 63, 190, 28))
    accent = accent.filter(ImageFilter.GaussianBlur(int(w * .10)))
    return Image.alpha_composite(bg, accent)


def compose_studio(product: Image.Image) -> Image.Image:
    canvas = (1400, 1050)
    bg = studio_background(canvas)
    w, h = product.size
    scale = min(1050 / w, 720 / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    product = product.resize((nw, nh), Image.Resampling.LANCZOS)

    shadow = Image.new("RGBA", canvas, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sx, sy = 700, 835
    sw, sh = int(nw * .46), max(24, int(nh * .055))
    sd.ellipse((sx - sw, sy - sh, sx + sw, sy + sh), fill=(0, 0, 0, 145))
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    bg = Image.alpha_composite(bg, shadow)

    x = (1400 - nw) // 2
    y = max(65, int((900 - nh) / 2))
    bg.alpha_composite(product, (x, y))
    return bg.convert("RGB")


def download(url: str) -> Image.Image:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return Image.open(io.BytesIO(r.content))


def main() -> None:
    text = IMAGE_MAP.read_text()
    replacements: dict[str, str] = {}

    for m in BLOCK_RE.finditer(text):
        slug, url = m.group("slug"), m.group("url")
        if not url.startswith("http"):
            continue
        try:
            im = download(url)
            if not has_white_background(im):
                continue
            studio = compose_studio(remove_edge_white(im))
            rel = f"/products/studio/{slug}.webp"
            out = ROOT / rel.lstrip("/")
            out.parent.mkdir(parents=True, exist_ok=True)
            studio.save(out, "WEBP", quality=92, method=6)
            replacements[slug] = rel
            print("studio", slug)
        except Exception as exc:
            print("skip", slug, exc)

    def repl(m: re.Match[str]) -> str:
        slug = m.group("slug")
        if slug not in replacements:
            return m.group(0)
        return f'{m.group("prefix")}{replacements[slug]}{m.group("suffix")}'

    IMAGE_MAP.write_text(BLOCK_RE.sub(repl, text))
    print(f"processed {len(replacements)} white-background images")


if __name__ == "__main__":
    main()
