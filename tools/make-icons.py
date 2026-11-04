# 產生擴充功能圖示：紅色圓角底 + 白色播放鍵 + 進度條（一半）
# 用法：python tools/make-icons.py
from pathlib import Path

from PIL import Image, ImageDraw

S = 1024
SS = 4  # 先畫 4 倍再縮，邊緣比較順
W = S * SS

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "extension" / "icons"


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


top = (255, 45, 85)
bottom = (178, 12, 52)

grad = Image.new("RGB", (W, W))
gd = ImageDraw.Draw(grad)
for y in range(W):
    gd.line([(0, y), (W, y)], fill=lerp(top, bottom, y / (W - 1)))

mask = Image.new("L", (W, W), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, W - 1, W - 1], radius=int(W * 0.22), fill=255)

icon = Image.new("RGBA", (W, W), (0, 0, 0, 0))
icon.paste(grad, (0, 0), mask)

d = ImageDraw.Draw(icon)

# 播放鍵（白）
tri = [
    (int(W * 0.375), int(W * 0.285)),
    (int(W * 0.375), int(W * 0.575)),
    (int(W * 0.655), int(W * 0.430)),
]
d.polygon(tri, fill=(255, 255, 255, 255))

# 進度條：左半實心白（已播到中段）、右半淡白，中間留一個缺口標出「中點」
bar_l, bar_r = int(W * 0.235), int(W * 0.765)
bar_t, bar_b = int(W * 0.700), int(W * 0.772)
radius = (bar_b - bar_t) // 2
mid = (bar_l + bar_r) // 2
gap = int(W * 0.014)
d.rounded_rectangle([bar_l, bar_t, mid - gap, bar_b], radius=radius, fill=(255, 255, 255, 255))
d.rounded_rectangle([mid + gap, bar_t, bar_r, bar_b], radius=radius, fill=(255, 255, 255, 90))

icon = icon.resize((S, S), Image.LANCZOS)

OUT.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 48, 128):
    path = OUT / f"icon{size}.png"
    icon.resize((size, size), Image.LANCZOS).save(path, optimize=True)
    print("wrote", path.relative_to(ROOT))
