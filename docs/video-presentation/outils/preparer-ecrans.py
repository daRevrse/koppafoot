# captures-brutes/*.jpg → ../source/ecrans/*.jpg (deux fois la taille d'affichage)
# cibles.json → ../source/cibles.js (où se trouvaient les boutons touchés, en px CSS)
#   python3 preparer-ecrans.py
import json, os
from PIL import Image

ICI = os.path.dirname(os.path.abspath(__file__))
BRUT = os.path.join(ICI, "captures-brutes")
SORTIE = os.path.join(ICI, "..", "source", "ecrans")
os.makedirs(SORTIE, exist_ok=True)
# L'écran du téléphone fait 414 px de large dans la vidéo : on garde le double,
# pour les zooms.
LARGEUR = 828
tailles = {}
for f in sorted(os.listdir(BRUT)):
    if not f.endswith(".jpg"):
        continue
    im = Image.open(os.path.join(BRUT, f)).convert("RGB")
    w, h = im.size
    if w > h:  # le téléphone couché (la console d'Afi)
        im = im.resize((round(w * LARGEUR / h), LARGEUR), Image.LANCZOS)
    else:
        im = im.resize((LARGEUR, round(h * LARGEUR / w)), Image.LANCZOS)
    im.save(os.path.join(SORTIE, f), quality=86, optimize=True, progressive=True)
    tailles[f[:-4]] = im.size
cibles = {}
try:
    cibles = json.load(open(os.path.join(ICI, "cibles.json")))
except FileNotFoundError:
    pass
# Le geste de la composition : le joueur glissé, d'où à où (p5a-compo).
try:
    cibles["04a-glisse"] = json.load(open(os.path.join(ICI, "glisse.json")))
except FileNotFoundError:
    pass
with open(os.path.join(ICI, "..", "source", "cibles.js"), "w") as o:
    o.write("// Où se trouvaient les éléments touchés à l'écran, au moment de chaque capture\n")
    o.write("// (px CSS d'un téléphone de 390 × 844, ou 844 × 390 couché). Généré par outils/preparer-ecrans.py.\n")
    o.write("window.CIBLES = " + json.dumps(cibles, ensure_ascii=False) + ";\n")
print(len(tailles), "écrans,", len(cibles), "cibles")
