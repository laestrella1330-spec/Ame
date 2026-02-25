"""Generate Ame app icons for all Android mipmap densities."""
from PIL import Image, ImageDraw, ImageFont
import os, math

RES = "app/src/main/res"
BG = (124, 58, 237)          # #7C3AED — matches values/ic_launcher_background.xml

# density → (legacy launcher size, adaptive foreground size)
DENSITIES = {
    "mdpi":    (48,  108),
    "hdpi":    (72,  162),
    "xhdpi":   (96,  216),
    "xxhdpi":  (144, 324),
    "xxxhdpi": (192, 432),
}

# Arial Bold ships with every Windows install
FONT_PATH = "C:/Windows/Fonts/arialbd.ttf"
if not os.path.exists(FONT_PATH):
    FONT_PATH = "C:/Windows/Fonts/arial.ttf"

def best_font_size(draw, text, max_w, max_h):
    """Binary-search for the largest font size where text fits in max_w × max_h."""
    lo, hi = 8, 1000
    while lo < hi - 1:
        mid = (lo + hi) // 2
        font = ImageFont.truetype(FONT_PATH, mid)
        bb = draw.textbbox((0, 0), text, font=font)
        w, h = bb[2] - bb[0], bb[3] - bb[1]
        if w <= max_w and h <= max_h:
            lo = mid
        else:
            hi = mid
    return lo

def draw_centered_text(img, text, fill):
    """Draw text perfectly centred in img."""
    draw = ImageDraw.Draw(img)
    w, h = img.size
    # Leave 15 % padding on each side
    max_w = int(w * 0.70)
    max_h = int(h * 0.60)
    size = best_font_size(draw, text, max_w, max_h)
    font = ImageFont.truetype(FONT_PATH, size)
    bb = draw.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    x = (w - tw) // 2 - bb[0]
    y = (h - th) // 2 - bb[1]
    draw.text((x, y), text, font=font, fill=fill)

for density, (launcher_px, fg_px) in DENSITIES.items():
    out_dir = os.path.join(RES, f"mipmap-{density}")
    os.makedirs(out_dir, exist_ok=True)

    # ── 1. Adaptive foreground (transparent bg, white "Ame") ──────────────────
    fg = Image.new("RGBA", (fg_px, fg_px), (0, 0, 0, 0))
    draw_centered_text(fg, "Ame", (255, 255, 255, 255))
    fg.save(os.path.join(out_dir, "ic_launcher_foreground.png"))

    # ── 2. Legacy launcher icon (purple bg + white "Ame") ─────────────────────
    icon = Image.new("RGB", (launcher_px, launcher_px), BG)
    draw_centered_text(icon, "Ame", (255, 255, 255))
    icon.save(os.path.join(out_dir, "ic_launcher.png"))

    # ── 3. Round icon (same design, circular crop) ────────────────────────────
    base = Image.new("RGB", (launcher_px, launcher_px), BG)
    draw_centered_text(base, "Ame", (255, 255, 255))
    mask = Image.new("L", (launcher_px, launcher_px), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, launcher_px, launcher_px), fill=255)
    result = Image.new("RGBA", (launcher_px, launcher_px), (0, 0, 0, 0))
    result.paste(base, mask=mask)
    result.save(os.path.join(out_dir, "ic_launcher_round.png"))

    print(f"[{density}] launcher={launcher_px}px  foreground={fg_px}px  OK")

print("Done.")
