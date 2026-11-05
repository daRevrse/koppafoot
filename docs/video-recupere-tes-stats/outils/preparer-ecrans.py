"""Prépare les écrans filmés pour l'animation.

    python3 preparer-ecrans.py
    captures-brutes/*.jpg -> ../source/ecrans/*.jpg (900 px de large)
    cibles.json           -> ../source/cibles.js   (lu par animation.html)

Les écrans de téléphone sont filmés à 1170 px de large (390 × 3). La vidéo
les affiche à 560 px : 900 px laissent de la marge aux zooms, pour un poids
raisonnable dans le dépôt.
"""
import json
from pathlib import Path

from PIL import Image

src, dst = Path("captures-brutes"), Path("../source/ecrans")
dst.mkdir(parents=True, exist_ok=True)
for ancien in dst.glob("*.jpg"):
    ancien.unlink()
n = 0
for f in sorted(src.glob("*.jpg")):
    im = Image.open(f).convert("RGB")
    w, h = im.size
    if w > 900:
        im = im.resize((900, round(h * 900 / w)), Image.LANCZOS)
    im.save(dst / f.name, quality=90, optimize=True)
    n += 1
cibles = json.loads(Path("cibles.json").read_text()) if Path("cibles.json").exists() else {}
Path("../source/cibles.js").write_text(
    "// Généré par outils/preparer-ecrans.py : où se trouvaient les boutons touchés.\n"
    f"window.CIBLES = {json.dumps(cibles, indent=2, ensure_ascii=False)};\n"
)
print(f"{n} écrans, {len(cibles)} cibles")
