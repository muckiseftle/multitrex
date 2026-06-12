# -*- coding: utf-8 -*-
"""
Stille Observation — Observatoriumskarte des Sonnensystems.

Erzeugt das Marken-Artwork (PNG, 2x supersampled) und daraus das
Social-Preview-Bild public/og-default.jpg (1200x630).
Aufruf: python scripts/make-og-art.py
"""
import math
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS = r"scripts"  # JetBrains Mono (OFL) — aus dem Canvas-Design-Plugin kopiert

# 2x Supersampling für gestochen scharfe Linien
SS = 2
W, H = 1200 * SS * 2 // 2, 630 * SS * 2 // 2          # Basis 1200x630
W, H = 2400, 1260                                     # = 1200x630 * SS
random.seed(471030)  # 47.10°N 10.30°O — deterministisch

SPACE = (5, 7, 15)
SPACE_LINE = (27, 37, 64)
STAR = (232, 237, 247)
CYAN = (111, 227, 255)
AMBER = (255, 180, 92)

PLANETS = [
    # (name, radiusEarths, tint)
    ("MERKUR", 0.383, (156, 142, 130)),
    ("VENUS", 0.949, (230, 200, 156)),
    ("ERDE", 1.000, (79, 143, 209)),
    ("MARS", 0.532, (193, 98, 59)),
    ("JUPITER", 10.97, (205, 167, 124)),
    ("SATURN", 9.14, (217, 192, 143)),
    ("URANUS", 3.98, (159, 214, 221)),
    ("NEPTUN", 3.86, (63, 102, 212)),
]

# ---------------------------------------------------------------- Hintergrund
def background():
    """Blauschwarz mit sanftem vertikalem Hauch + Sonnenglühen links, gedithert."""
    y, x = np.mgrid[0:H, 0:W].astype(np.float64)

    base = np.zeros((H, W, 3))
    for i, c in enumerate(SPACE):
        base[..., i] = c

    # minimaler vertikaler Verlauf (oben einen Hauch heller — Atmosphäre)
    vert = (1.0 - y / H) * 6.0
    base[..., 0] += vert * 0.6
    base[..., 1] += vert * 0.8
    base[..., 2] += vert * 1.6

    # Sonnenglühen: Quelle links außerhalb der Karte
    sx, sy = -W * 0.18, H * 0.52
    d = np.sqrt((x - sx) ** 2 + (y - sy) ** 2)
    glow = np.exp(-d / (W * 0.26))
    base[..., 0] += glow * 105
    base[..., 1] += glow * 62
    base[..., 2] += glow * 22
    glow2 = np.exp(-d / (W * 0.10))
    base[..., 0] += glow2 * 165
    base[..., 1] += glow2 * 108
    base[..., 2] += glow2 * 42
    # Sonnenrand: hell glimmende Kante der Scheibe am linken Bildrand
    limb = np.exp(-np.abs(d - W * 0.205) / (W * 0.012))
    base[..., 0] += limb * 150
    base[..., 1] += limb * 105
    base[..., 2] += limb * 55

    # Dithering gegen Banding
    base += np.random.uniform(-1.2, 1.2, base.shape)
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB")


img = background()
draw = ImageDraw.Draw(img, "RGBA")

# ---------------------------------------------------------------- Sternfeld
for _ in range(420):
    px, py = random.uniform(0, W), random.uniform(0, H)
    r = random.choice([0.7, 0.9, 1.1, 1.4, 1.4, 1.9, 2.6])
    a = int(random.uniform(28, 150) * (0.75 if r < 1.2 else 1.0))
    draw.ellipse([px - r, py - r, px + r, py + r], fill=STAR + (a,))
# wenige helle Sterne mit feinem Kreuz-Spike (Newton-Zitat)
for _ in range(7):
    px, py = random.uniform(W * 0.25, W * 0.97), random.uniform(H * 0.06, H * 0.94)
    s = random.uniform(7, 12)
    draw.line([px - s, py, px + s, py], fill=STAR + (60,), width=1)
    draw.line([px, py - s, px, py + s], fill=STAR + (60,), width=1)
    draw.ellipse([px - 2.2, py - 2.2, px + 2.2, py + 2.2], fill=STAR + (210,))

# ---------------------------------------------------------------- Orbitbögen
SUNX, SUNY = -W * 0.18, H * 0.52
ORBIT_R = [W * (0.27 + 0.095 * i) for i in range(8)]
# Planeten-Winkel (Grad, 0 = nach rechts), bewusst ruhig gestreut
ANGLES = [8.5, -11.4, 2.3, 6.3, -4.9, 7.6, -9.6, 1.7]

def polar(r, deg):
    a = math.radians(deg)
    return SUNX + r * math.cos(a), SUNY + r * math.sin(a)

for i, r in enumerate(ORBIT_R):
    bbox = [SUNX - r, SUNY - r, SUNX + r, SUNY + r]
    draw.arc(bbox, start=-30, end=30, fill=(38, 52, 88, 255), width=SS)

# Mess-Ticks entlang des äußersten Bogens — der geduldige Puls der Skala
r_t = ORBIT_R[-1] + W * 0.024
for deg in range(-28, 29):
    inner = polar(r_t, deg)
    outer = polar(r_t + (W * 0.008 if deg % 4 == 0 else W * 0.004), deg)
    draw.line([inner, outer], fill=SPACE_LINE + (235,), width=SS)

# ---------------------------------------------------------------- Planeten
def planet_px(re):
    return (6.0 + 9.0 * (re ** 0.38)) * SS

fonts = {}
def font(name, size):
    key = (name, size)
    if key not in fonts:
        fonts[key] = ImageFont.truetype(f"{FONTS}\\{name}.ttf", size)
    return fonts[key]

f_label = font("JetBrainsMono-Regular", int(10.5 * SS))
f_tiny = font("JetBrainsMono-Regular", int(8.5 * SS))
f_name = font("JetBrainsMono-Bold", int(30 * SS))
f_sub = font("JetBrainsMono-Regular", int(11 * SS))

def spaced(s, n=1):
    return (" " * n).join(list(s))

for i, ((name, re, tint), r, deg) in enumerate(zip(PLANETS, ORBIT_R, ANGLES)):
    px, py = polar(r, deg)
    pr = planet_px(re)

    # Glühen + Scheibe mit Tag/Nacht-Schattierung (Licht von links, der Sonne zu)
    glow_im = Image.new("RGBA", (int(pr * 8), int(pr * 8)), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_im)
    gd.ellipse([pr * 3, pr * 3, pr * 5, pr * 5], fill=tint + (70,))
    glow_im = glow_im.filter(ImageFilter.GaussianBlur(pr * 0.9))
    img.paste(glow_im, (int(px - pr * 4), int(py - pr * 4)), glow_im)

    draw.ellipse([px - pr, py - pr, px + pr, py + pr], fill=tint + (255,))
    # Nachtseite: Scheibe minus nach links versetzte Scheibe = Schattensichel rechts
    size = int(pr * 2) + 4
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([2, 2, pr * 2 + 2, pr * 2 + 2], fill=140)
    md.ellipse([2 - pr * 0.75, 2, pr * 1.25 + 2, pr * 2 + 2], fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(pr * 0.12))
    dark = Image.new("RGBA", (size, size), SPACE + (255,))
    dark.putalpha(mask)
    img.paste(dark, (int(px - pr) - 2, int(py - pr) - 2), dark)

    # Saturn: feiner Ring
    if name == "SATURN":
        ring = Image.new("RGBA", (int(pr * 6), int(pr * 6)), (0, 0, 0, 0))
        rd = ImageDraw.Draw(ring)
        rd.ellipse([pr * 0.7, pr * 2.45, pr * 5.3, pr * 3.55], outline=(217, 192, 143, 200), width=SS)
        rd.ellipse([pr * 1.0, pr * 2.6, pr * 5.0, pr * 3.4], outline=(217, 192, 143, 120), width=SS)
        ring = ring.rotate(-18, resample=Image.BICUBIC)
        img.paste(ring, (int(px - pr * 3), int(py - pr * 3)), ring)

    # Beschriftung: gesperrte Mono-Versalien unterhalb
    label = spaced(name)
    tb = draw.textbbox((0, 0), label, font=f_label)
    lw = tb[2] - tb[0]
    ly = py + pr + (26 if name != "SATURN" else 40) * SS / 2
    draw.text((px - lw / 2, ly), label, font=f_label, fill=STAR + (165,))

    # Erde: Fadenkreuz-Ecken + Leitlinie — der Beobachtungspunkt
    if name == "ERDE":
        c = pr + 9 * SS
        for dx in (-1, 1):
            for dy in (-1, 1):
                x0, y0 = px + dx * c, py + dy * c
                draw.line([x0, y0, x0 - dx * 7 * SS, y0], fill=CYAN + (255,), width=SS)
                draw.line([x0, y0, x0, y0 - dy * 7 * SS], fill=CYAN + (255,), width=SS)
        ex, ey = px - c, py - c
        draw.line([ex, ey, ex - 26 * SS, ey - 14 * SS], fill=CYAN + (140,), width=SS)
        t1 = spaced("BEOBACHTUNGSPUNKT")
        t2 = "47.7° N · 10.3° O · 730 M"
        w1 = draw.textbbox((0, 0), t1, font=f_tiny)[2]
        w2 = draw.textbbox((0, 0), t2, font=f_tiny)[2]
        draw.text((ex - 30 * SS - w1, ey - 26 * SS), t1, font=f_tiny, fill=CYAN + (220,))
        draw.text((ex - 30 * SS - w2, ey - 13 * SS), t2, font=f_tiny, fill=STAR + (130,))

# ---------------------------------------------------------------- Typografie
# Wortmarke unten links — der einzige laute Moment
wx, wy = W * 0.055, H * 0.80
draw.text((wx, wy), spaced("MULTITREX", 2), font=f_name, fill=STAR + (245,))
draw.text((wx + 2 * SS, wy + 42 * SS), spaced("ASTROFOTOGRAFIE · ALLGÄU", 1),
          font=f_sub, fill=STAR + (140,))
# feine Linie über der Wortmarke
draw.line([wx + 1 * SS, wy - 14 * SS, wx + 240 * SS, wy - 14 * SS], fill=CYAN + (110,), width=SS)
draw.text((wx + 1 * SS, wy - 30 * SS), spaced("EINE REISE DURCH UNSER SONNENSYSTEM"),
          font=f_tiny, fill=CYAN + (200,))

# Karten-Metadaten oben rechts — Artefakt eines imaginären Observatoriums
mx = W * 0.945
for j, line in enumerate(["TAFEL 01 / 01", "MASSSTAB ≠ 1:1", "EPOCHE J2026.4"]):
    tb = draw.textbbox((0, 0), line, font=f_tiny)
    draw.text((mx - (tb[2] - tb[0]), H * 0.055 + j * 15 * SS), line,
              font=f_tiny, fill=STAR + (110,))

# ---------------------------------------------------------------- Ausgabe
img = img.resize((1200, 630), Image.LANCZOS)
img.save("docs/og-artwork.png")
img.convert("RGB").save("public/og-default.jpg", quality=88)
print("ok: docs/og-artwork.png + public/og-default.jpg")
