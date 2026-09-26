"""Réduit les captures brutes pour le PDF et le dépôt.

    python3 reduire-captures.py [dossier source] [dossier cible]
    (par défaut : captures-brutes -> ../source/captures)

Largeur max 1600 px (bureau, console couchée), 720 px (téléphone debout).
Assez pour une impression nette en A4, bien plus léger que les captures brutes.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw


def cadre_telephone(im):
    """Coins arrondis et contour sombre, dessinés dans l'image elle-même.

    Un contour en CSS déborde d'un liseré sur la page précédente quand le bloc
    est repoussé à la page suivante ; dans les pixels, il ne bouge pas.
    """
    w, h = im.size
    e, r = 7, 34
    fond = Image.new("RGB", (w + 2 * e, h + 2 * e), "white")
    masque = Image.new("L", (w, h), 0)
    ImageDraw.Draw(masque).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255)
    fond.paste(im, (e, e), masque)
    ImageDraw.Draw(fond).rounded_rectangle((e // 2, e // 2, w + e + e // 2, h + e + e // 2), r + e // 2, outline=(31, 41, 55), width=e)
    return fond


src = Path(sys.argv[1] if len(sys.argv) > 1 else "captures-brutes")
dst = Path(sys.argv[2] if len(sys.argv) > 2 else "../source/captures")
dst.mkdir(parents=True, exist_ok=True)
total = 0
for f in sorted(src.glob("*.jpg")):
    im = Image.open(f).convert("RGB")
    w, h = im.size
    debout = h > w * 1.4 and w <= 1200
    maxw = 720 if debout else 1600
    if w > maxw:
        im = im.resize((maxw, round(h * maxw / w)), Image.LANCZOS)
    if debout:
        im = cadre_telephone(im)
    out = dst / f.name
    im.save(out, "JPEG", quality=80, optimize=True, progressive=True)
    total += out.stat().st_size
print(f"{len(list(dst.glob('*.jpg')))} captures, {total / 1e6:.1f} Mo")
