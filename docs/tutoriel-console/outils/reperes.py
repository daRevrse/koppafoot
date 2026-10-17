"""Des images quadrillées des instants clés, pour lire les coordonnées des boutons.

Chaque image est l'image source (redressée pour la console) réduite, avec un
quadrillage tous les 100 pixels SOURCE et ses graduations.
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ICI = Path(__file__).resolve().parent
SOURCES = ICI.parent / "sources"
SORTIE = ICI / "reperes"
SORTIE.mkdir(exist_ok=True)
POLICE = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 13)


def image(n: str, t: float, couche: bool) -> Image.Image:
    tmp = SORTIE / "_tmp.png"
    vf = "transpose=2" if couche else "null"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(SOURCES / f"{n}.MP4"),
                    "-frames:v", "1", "-vf", vf, "-update", "1", str(tmp)], check=True)
    return Image.open(tmp).convert("RGB")


def quadrille(im: Image.Image, echelle: float) -> Image.Image:
    petit = im.resize((int(im.width * echelle), int(im.height * echelle)))
    d = ImageDraw.Draw(petit)
    for x in range(0, im.width, 100):
        X = x * echelle
        d.line([(X, 0), (X, petit.height)], fill=(255, 0, 255) if x % 500 == 0 else (255, 120, 255), width=1)
        d.text((X + 2, 2), str(x), fill=(255, 0, 255), font=POLICE)
    for y in range(0, im.height, 100):
        Y = y * echelle
        d.line([(0, Y), (petit.width, Y)], fill=(0, 200, 255) if y % 500 == 0 else (120, 220, 255), width=1)
        d.text((2, Y + 2), str(y), fill=(0, 160, 255), font=POLICE)
    return petit


if __name__ == "__main__":
    # n t couche [echelle] [x0 y0 x1 y1]
    n, t, couche = sys.argv[1], float(sys.argv[2]), sys.argv[3] == "couche"
    echelle = float(sys.argv[4]) if len(sys.argv) > 4 else 0.4
    im = image(n, t, couche)
    if len(sys.argv) > 8:
        x0, y0, x1, y1 = map(int, sys.argv[5:9])
        # Recadrage en gardant les graduations SOURCE : on décale la grille.
        im2 = im.crop((x0, y0, x1, y1))
        petit = im2.resize((int(im2.width * echelle), int(im2.height * echelle)))
        d = ImageDraw.Draw(petit)
        for x in range((x0 // 50 + 1) * 50, x1, 50):
            X = (x - x0) * echelle
            d.line([(X, 0), (X, petit.height)], fill=(255, 0, 255), width=1)
            d.text((X + 2, 2), str(x), fill=(255, 0, 255), font=POLICE)
        for y in range((y0 // 50 + 1) * 50, y1, 50):
            Y = (y - y0) * echelle
            d.line([(0, Y), (petit.width, Y)], fill=(0, 200, 255), width=1)
            d.text((2, Y + 2), str(y), fill=(0, 160, 255), font=POLICE)
    else:
        petit = quadrille(im, echelle)
    nom = f"{n}_{t:05.1f}{'_c' if couche else ''}.png"
    petit.save(SORTIE / nom)
    print(nom, im.size)
