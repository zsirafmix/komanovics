"""Eduárd fej kivágása a forrásképből (tools/eduard-source.png).

Kimenetek (public/assets/):
  eduard-head.png      – átlátszó hátterű fej+szakáll (játékbeli fej, ~256px magas)
  eduard-head-128.png  – kisebb változat (menü)
  favicon.png          – 64x64 favicon
  eduard-full.jpg      – teljes kép a felirat nélkül (kezdőképernyő)

Módszer: HSV-alapú színszegmentálás (meleg árnyalatú, telített pixelek = haj,
szakáll, bőr), ovális maszkkal metszve, lyukkitöltés + legnagyobb komponens,
majd elmosott (soft) él. Ha a forráskép változik, a koordinátákat (OVAL_*)
újra kell hangolni.
Futtatás: python tools/crop_head.py  (numpy, scipy, pillow kell)
"""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = "tools/eduard-source.png"
OUT = "public/assets/"
img = Image.open(SRC).convert("RGB")
W, H = img.size
a = np.asarray(img).astype(np.float32) / 255.0
hsv = np.asarray(img.convert("HSV")).astype(np.float32)
h = hsv[..., 0] * 360 / 255
s = hsv[..., 1] / 255
v = hsv[..., 2] / 255

# Meleg (vörös/narancs/rózsaszín) és elég telített pixelek
warm = ((h < 38) | (h > 330)) & (s > 0.30) & (v > 0.18)

# Ovális keret a fej + szakáll körül (a pulóvert és a háttér nagy részét kizárja)
cx, cy, rx, ry = 292, 222, 192, 205
yy, xx = np.mgrid[0:H, 0:W]
oval = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0
m = warm & oval
m = ndimage.binary_closing(m, iterations=4)
m = ndimage.binary_fill_holes(m)
lab, n = ndimage.label(m)
if n > 1:
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    m = lab == (np.argmax(sizes) + 1)
m = ndimage.binary_opening(m, iterations=2)
m = ndimage.binary_fill_holes(m)

alpha = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))
rgba = img.copy()
rgba.putalpha(alpha)
bbox = Image.fromarray((m * 255).astype(np.uint8)).getbbox()
pad = 6
bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(W, bbox[2] + pad), min(H, bbox[3] + pad))
head = rgba.crop(bbox)
print("bbox", bbox, "size", head.size)
r = 256 / head.size[1]
head256 = head.resize((round(head.size[0] * r), 256), Image.LANCZOS)
head256.save(OUT + "eduard-head.png", optimize=True)
r = 128 / head.size[1]
head.resize((round(head.size[0] * r), 128), Image.LANCZOS).save(OUT + "eduard-head-128.png", optimize=True)
# favicon: négyzetes vászonra középre
fav = Image.new("RGBA", (max(head.size),) * 2, (0, 0, 0, 0))
fav.paste(head, ((fav.size[0] - head.size[0]) // 2, (fav.size[1] - head.size[1]) // 2), head)
fav.resize((64, 64), Image.LANCZOS).save(OUT + "favicon.png", optimize=True)
# Teljes kép a felirat nélkül (alsó ~50px a "Eduárd Tanya News" szöveg)
img.crop((0, 0, W, 572)).save(OUT + "eduard-full.jpg", quality=86)
# Ellenőrző kép sötét háttéren
prev = Image.new("RGBA", head.size, (40, 90, 40, 255))
prev.alpha_composite(head)
prev.save("/tmp/head_preview.png")
