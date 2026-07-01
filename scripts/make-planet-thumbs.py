# -*- coding: utf-8 -*-
"""
Hochauflösende Planeten-Porträts (runde Scheiben) aus equirektangularen
Texturen: orthografische Projektion der Vorderhalbkugel + Lambert-Licht.
Saturn bekommt einen sauberen, geneigten Ring (hinten hinter, vorn vor dem
Planeten).

Quelle: public/textures/4k/<id>.webp (Solar System Scope, CC BY 4.0)
Ausgabe: public/planets/<id>.webp  (transparent umrandet)
"""
import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageChops

SRC = "public/textures/4k"
OUT = "public/planets"
os.makedirs(OUT, exist_ok=True)

SS = 4
FINAL = 320
N = FINAL * SS
C = N / 2

ROT = {"merkur": 0.6, "venus": 0.0, "mars": 2.7, "jupiter": 0.4, "saturn": 0.3}
L = np.array([-0.45, -0.5, 0.78]); L = L / np.linalg.norm(L)


def render_disc(tex, rot_y, disc=0.6):
    """disc = Planetenradius als Bruchteil der halben Bildkante."""
    H, W, _ = tex.shape
    lin = (np.arange(N) + 0.5) / C - 1.0            # -1..1 über die Bildkante
    gx, gy = np.meshgrid(lin, lin)
    x, y = gx / disc, gy / disc                     # auf Einheitskugel skalieren
    r2 = x * x + y * y
    inside = r2 <= 1.0
    z = np.sqrt(np.clip(1.0 - r2, 0.0, 1.0))

    xr = x * math.cos(rot_y) + z * math.sin(rot_y)
    zr = -x * math.sin(rot_y) + z * math.cos(rot_y)
    lon = np.arctan2(xr, zr)
    lat = np.arcsin(np.clip(-y, -1, 1))
    u = (lon / (2 * math.pi) + 0.5) % 1.0
    v = np.clip(0.5 - lat / math.pi, 0, 1)
    px = np.clip((u * (W - 1)).astype(np.int32), 0, W - 1)
    py = np.clip((v * (H - 1)).astype(np.int32), 0, H - 1)
    col = tex[py, px].astype(np.float32)

    lam = np.clip(x * L[0] + y * L[1] + z * L[2], 0, 1)
    col = np.clip(col * (0.10 + 0.90 * lam)[..., None], 0, 255)

    rr = np.sqrt(r2)
    alpha = np.where(inside, 1.0, 0.0)
    rgba = np.zeros((N, N, 4), np.float32)
    rgba[..., :3] = col
    rgba[..., 3] = alpha * 255
    return Image.fromarray(rgba.astype(np.uint8), "RGBA")


def saturn_ring_layer(outer, inner_ratio, tilt_deg):
    """Glatter, geneigter Ring als RGBA-Ebene (N×N)."""
    layer = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ory = outer * 0.32                       # vertikale Stauchung (Neigung)
    bands = [
        (1.00, (223, 201, 162, 235)),
        (0.90, (205, 182, 140, 165)),
        (0.80, (223, 201, 162, 205)),
    ]
    for scale, col in bands:
        ox, oy = outer * scale, ory * scale
        ix, iy = ox * inner_ratio, oy * inner_ratio
        d.ellipse([C - ox, C - oy, C + ox, C + oy], fill=col)
        d.ellipse([C - ix, C - iy, C + ix, C + iy], fill=(0, 0, 0, 0))
    return layer.rotate(tilt_deg, resample=Image.BICUBIC, center=(C, C))


def compose_saturn(tex):
    planet = render_disc(tex, ROT["saturn"], disc=0.6)
    ring = saturn_ring_layer(outer=C * 0.97, inner_ratio=0.62, tilt_deg=-16)

    a = ring.split()[3]
    top = Image.new("L", (N, N), 0)
    ImageDraw.Draw(top).rectangle([0, 0, N, int(C)], fill=255)
    bot = Image.new("L", (N, N), 0)
    ImageDraw.Draw(bot).rectangle([0, int(C), N, N], fill=255)
    far = ring.copy(); far.putalpha(ImageChops.multiply(a, top))    # oben = hinten
    near = ring.copy(); near.putalpha(ImageChops.multiply(a, bot))  # unten = vorn

    out = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    out.alpha_composite(far)
    out.alpha_composite(planet)
    out.alpha_composite(near)
    return out


PLANETS = ["merkur", "venus", "mars", "jupiter", "saturn"]
for pid in PLANETS:
    tex = np.asarray(Image.open(os.path.join(SRC, f"{pid}.webp")).convert("RGB"))
    img = compose_saturn(tex) if pid == "saturn" else render_disc(tex, ROT.get(pid, 0.0))
    img = img.resize((FINAL, FINAL), Image.LANCZOS)
    img.save(os.path.join(OUT, f"{pid}.webp"), quality=90, method=6)
    print("ok", pid, os.path.getsize(os.path.join(OUT, f"{pid}.webp")) // 1024, "kB")
