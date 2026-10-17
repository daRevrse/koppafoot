"""Le montage du tutoriel de la console.

ffmpeg extrait chaque plan (coupé, accéléré ou ralenti, redressé) en images
brutes ; Python compose chaque image finale (fond, cadre, cartons de chapitre,
sous-titres, cercles d'appui, zooms, fondus) ; ffmpeg encode, puis on pose la
voix. Aucun fichier intermédiaire lourd : tout passe par des tubes.

    python montage.py            # la vidéo entière
    python montage.py 05         # un seul chapitre, pour regarder vite
"""
import functools
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.stdout.reconfigure(encoding="utf-8")

ICI = Path(__file__).resolve().parent
SOURCES = ICI.parent / "sources"
# Les essais d'un chapitre vont dans rendu/ (hors git) ; la vidéo finale, à la
# racine du dossier, à côté de son README.
SORTIE = ICI.parent / "rendu"
SORTIE.mkdir(exist_ok=True)
FINALE = ICI.parent / "Tutoriel-console-KoppaFoot.mp4"
RACINE = ICI.parents[2]
POLICES = RACINE / "assets" / "fonts"
LOGO = RACINE / "public" / "branding" / "logo_full_name.png"

W, H, FPS = 1920, 1080, 30
VERT = (0, 191, 99)
BLANC = (255, 255, 255)
FOND_HAUT, FOND_BAS = (7, 18, 14), (12, 38, 27)

CARTE = 1.8          # durée du carton de chapitre
QUEUE = 0.5          # silence après la voix, avant le chapitre suivant
INTRO, FIN = 3.0, 3.2


@functools.lru_cache(maxsize=None)
def police(nom: str, taille: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(POLICES / nom), taille)


# ---- Les deux mises en page ------------------------------------------------------
# L : la console couchée, redressée et rognée de la barre d'état du téléphone.
L_CROP = (165, 0, 2370, 1180)          # x, y, l, h dans l'image redressée
L_BOITE = (64, 28, 1792, 892)          # où elle tombe dans l'image finale
# P : un écran vertical, dans un cadre de téléphone, le texte à côté.
P_BOITE = (230, 40, 462, 1000)
P_SRC = (1180, 2556)
P_TEXTE_X, P_TEXTE_L = 820, 1000


def vers_ecran(layout: str, x: float, y: float) -> tuple[float, float]:
    """Coordonnées SOURCE (image redressée pour L) → image finale."""
    if layout == "L":
        bx, by, bl, bh = L_BOITE
        return bx + (x - L_CROP[0]) * bl / L_CROP[2], by + (y - L_CROP[1]) * bh / L_CROP[3]
    bx, by, bl, bh = P_BOITE
    return bx + x * bl / P_SRC[0], by + y * bh / P_SRC[1]


def masque_arrondi(l: int, h: int, r: int) -> Image.Image:
    m = Image.new("L", (l * 2, h * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, l * 2 - 1, h * 2 - 1), r * 2, fill=255)
    return m.resize((l, h), Image.LANCZOS)


def degrade() -> Image.Image:
    a = np.linspace(0, 1, H)[:, None, None]
    haut, bas = np.array(FOND_HAUT, float), np.array(FOND_BAS, float)
    img = (haut * (1 - a) + bas * a) * np.ones((1, W, 1))
    # Une lueur verte, discrète, en haut à droite.
    yy, xx = np.mgrid[0:H, 0:W]
    lueur = np.exp(-(((xx - W * 0.85) / 700) ** 2 + ((yy - H * 0.1) / 500) ** 2))[..., None]
    img = img + lueur * np.array([0, 40, 22])
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


FOND = degrade()
MASQUE_L = masque_arrondi(L_BOITE[2], L_BOITE[3], 22)
MASQUE_P = masque_arrondi(P_BOITE[2], P_BOITE[3], 40)


def fond_p() -> Image.Image:
    """Le fond des écrans verticaux, avec le contour du téléphone."""
    f = FOND.copy()
    d = ImageDraw.Draw(f)
    x, y, l, h = P_BOITE
    d.rounded_rectangle((x - 12, y - 12, x + l + 12, y + h + 12), 52, fill=(2, 6, 5), outline=(40, 70, 55), width=3)
    return f


FOND_P = fond_p()


# ---- Le texte ------------------------------------------------------------------
NB = chr(0xA0)


def mots_colores(texte: str):
    """Les mots, avec leur couleur : ce qui est entre « » est un bouton, en vert."""
    dans = False
    for mot in texte.replace("\n", " ").split(" "):
        if not mot:
            continue
        couleur = VERT if (dans or "«" in mot) else BLANC
        if "«" in mot:
            dans = True
        if "»" in mot:
            dans = False
        yield mot, couleur


def couper_lignes(texte: str, f: ImageFont.FreeTypeFont, largeur: float):
    espace = f.getlength(" ")
    lignes, ligne, l_ligne = [], [], 0.0
    for mot, c in mots_colores(texte):
        lm = f.getlength(mot)
        if ligne and l_ligne + espace + lm > largeur:
            lignes.append((ligne, l_ligne))
            ligne, l_ligne = [], 0.0
        ligne.append((mot, c, lm))
        l_ligne += (espace if len(ligne) > 1 else 0) + lm
    if ligne:
        lignes.append((ligne, l_ligne))
    return lignes


def bloc_texte(texte: str, taille: int, largeur_max: int, centre: bool, interligne: float = 1.25) -> Image.Image:
    f = police("Outfit-Bold.ttf", taille)
    espace = f.getlength(" ")
    lignes = couper_lignes(texte, f, largeur_max)
    # DES LIGNES ÉQUILIBRÉES : la plus petite largeur qui garde le même nombre
    # de lignes. Sans elle, un mot restait seul sur la seconde.
    largeur = largeur_max
    while len(lignes) > 1 and largeur > 200:
        essai = couper_lignes(texte, f, largeur - 20)
        if len(essai) > len(lignes):
            break
        largeur -= 20
    lignes = couper_lignes(texte, f, largeur)
    hl = int(taille * interligne)
    img = Image.new("RGBA", (largeur_max + 40, hl * len(lignes) + 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, (mots, lg) in enumerate(lignes):
        x = 20 + ((largeur_max - lg) / 2 if centre else 0)
        y = 10 + i * hl
        for mot, c, lm in mots:
            # Une ombre légère, pour la lisibilité sur n'importe quel fond.
            d.text((x + 2, y + 3), mot.replace(NB, " "), font=f, fill=(0, 0, 0, 160))
            d.text((x, y), mot.replace(NB, " "), font=f, fill=c + (255,))
            x += lm + espace
    return img


TEXTE = json.loads((ICI / "texte.json").read_text(encoding="utf-8"))

TITRES = {
    "01": ("Ouvrir la console", "OUVRIR"),
    "02": ("Les feuilles de match", "FEUILLES"),
    "03": ("Avant le coup d'envoi", "AVANT-MATCH"),
    "04": ("Le ballon", "LE BALLON"),
    "05": ("Les actions", "ACTIONS"),
    "06": ("Mi-temps et fin du match", "LA FIN"),
    "07": ("Un modérateur", "MODÉRATEUR"),
    "08": ("Avant demain", "ENTRAÎNEMENT"),
}


def carton(n: str, decalage: float = 0.0) -> Image.Image:
    """Le carton d'un chapitre. `decalage` (0→1) fait glisser le titre en place."""
    img = FOND.copy()
    d = ImageDraw.Draw(img)
    titre = TITRES[n][0]
    dx = int(60 * (1 - decalage))
    d.text((180 - dx // 2, 300), n, font=police("Anton-Regular.ttf", 230), fill=VERT)
    d.rectangle((180, 610, 180 + 140, 618), fill=VERT)
    d.text((180 + dx, 650), titre.upper(), font=police("Outfit-Black.ttf", 86), fill=BLANC)
    d.text((182 + dx, 770), "Tutoriel · la console KoppaFoot", font=police("Outfit-Medium.ttf", 34), fill=(150, 190, 170))
    return img


def etiquette(n: str, layout: str) -> tuple[Image.Image, tuple[int, int]]:
    """Le repère du chapitre pendant son contenu."""
    if layout == "L":
        img = Image.new("RGBA", (300, 120), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.text((0, 0), n, font=police("Anton-Regular.ttf", 54), fill=VERT + (255,))
        d.text((2, 74), TITRES[n][1], font=police("Outfit-Bold.ttf", 20), fill=(190, 215, 200, 255))
        return img, (64, 940)
    img = Image.new("RGBA", (1000, 330), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.text((0, 0), n, font=police("Anton-Regular.ttf", 120), fill=VERT + (255,))
    d.text((4, 175), TITRES[n][0].upper(), font=police("Outfit-Black.ttf", 52), fill=BLANC + (255,))
    d.rectangle((4, 262, 124, 268), fill=VERT + (255,))
    return img, (P_TEXTE_X, 90)


def sous_titre(texte: str, layout: str) -> tuple[Image.Image, tuple[int, int]]:
    if layout == "L":
        img = bloc_texte(texte, 40, 1300, centre=True)
        return img, (W // 2 - img.width // 2 + 80, 1000 - img.height // 2)
    img = bloc_texte(texte, 50, P_TEXTE_L, centre=False, interligne=1.3)
    return img, (P_TEXTE_X - 20, 640 - img.height // 2)


def anneaux_sprites() -> list[Image.Image]:
    """Le cercle d'un appui : il s'ouvre et s'efface en 0,8 s."""
    out = []
    n = int(0.8 * FPS)
    for k in range(n):
        p = k / (n - 1)
        e = 1 - (1 - p) ** 3
        taille = 200
        img = Image.new("RGBA", (taille * 2, taille * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        r = (24 + 46 * e) * 2
        a = int(255 * (1 - p) ** 1.2)
        c = taille
        d.ellipse((c - r, c - r, c + r, c + r), outline=(255, 255, 255, a), width=16)
        r2 = r - 10
        d.ellipse((c - r2, c - r2, c + r2, c + r2), outline=VERT + (a,), width=10)
        if p < 0.45:
            ri = 30 * 2
            d.ellipse((c - ri, c - ri, c + ri, c + ri), fill=VERT + (int(170 * (1 - p / 0.45)),))
        out.append(img.resize((taille, taille), Image.LANCZOS))
    return out


ANNEAUX = anneaux_sprites()


# ---- Les plans -------------------------------------------------------------------
def T(n: str, k: int) -> float:
    return TEXTE[n]["morceaux"][k]["debut"]


def FIN_DE(n: str) -> float:
    return TEXTE[n]["duree"] + QUEUE


def plan(src, a, b, debut, fin, layout, mode="etire", zoom=None, anneaux=()):
    return dict(src=src, a=a, b=b, debut=debut, fin=fin, layout=layout, mode=mode, zoom=zoom, anneaux=list(anneaux))


def plans(n: str) -> list[dict]:
    t = lambda k: T(n, k)
    f = FIN_DE(n)
    if n == "01":
        return [
            plan("01", 0.0, 4.4, 0, t(3), "P"),
            plan("01", 4.4, 8.6, t(3), t(5), "P"),
            plan("01", 8.6, 10.6, t(5), t(6), "P", anneaux=[(9.95, 508, 1393)]),
            plan("01", 10.6, 21.0, t(6), f, "P"),
        ]
    if n == "02":
        return [
            plan("02", 4.0, 6.3, 0, t(1), "P"),
            plan("02", 12.6, 16.3, t(1), t(2), "P", anneaux=[(12.95, 560, 1590)]),
            plan("02", 20.1, 21.9, t(2), t(3), "P", anneaux=[(20.65, 983, 813)]),
            plan("02", 18.3, 19.05, t(3), t(4), "P", mode="gel", anneaux=[(18.65, 983, 813)]),
            plan("02", 19.05, 19.9, t(4), t(5), "P", mode="gel", anneaux=[(19.15, 983, 813)]),
            plan("02", 20.2, 22.2, t(5), t(6), "P", zoom=(330, 760, 1.7)),
            plan("02", 38.8, 44.6, t(6), t(7), "P", anneaux=[(39.85, 590, 1920), (43.45, 883, 493)]),
            plan("02", 44.6, 49.0, t(7), t(10), "P", zoom=(590, 1650, 1.5)),
            plan("02", 49.0, 53.85, t(10), f, "P", anneaux=[(53.5, 590, 2367)]),
        ]
    if n == "03":
        return [
            plan("03", 0.0, 2.96, 0, t(1), "L"),
            plan("03", 2.96, 7.18, t(1), t(2), "L", anneaux=[(4.45, 1709, 166), (5.45, 1709, 166)]),
            plan("03", 7.2, 12.0, t(2), t(4), "L", zoom=(1430 - 165, 270, 2.2)),
            plan("04", 1.2, 6.5, t(4), f, "L", anneaux=[(2.45, 2329, 257)]),
        ]
    if n == "04":
        return [
            plan("04", 6.5, 8.4, 0, t(1), "L"),
            plan("04", 8.4, 14.1, t(1), t(3), "L"),
            plan("04", 14.1, 16.0, t(3), t(4), "L"),
            plan("04", 16.0, 21.0, t(4), t(5), "L", zoom=(535, 330, 2.2)),
            plan("04", 21.0, 33.0, t(5), f, "L"),
        ]
    if n == "05":
        return [
            plan("05", 1.6, 4.4, 0, t(1), "L", mode="gel", anneaux=[(2.3, 1429, 594)]),
            plan("05", 13.4, 20.0, t(1), t(2), "L", anneaux=[(13.55, 2109, 529), (15.4, 1566, 740)]),
            plan("05", 4.4, 8.0, t(2), t(3), "L"),
            plan("05", 20.6, 25.0, t(3), t(4), "L", anneaux=[(21.45, 323, 334)]),
            plan("05", 26.6, 33.0, t(4), t(6), "L", anneaux=[(27.45, 1086, 166), (30.6, 1086, 166)]),
            plan("05", 36.0, 47.5, t(6), f, "L", anneaux=[(36.45, 2331, 131), (42.35, 2337, 834)]),
        ]
    if n == "06":
        return [
            plan("06", 2.6, 6.3, 0, t(1), "L", anneaux=[(3.3, 1557, 166)]),
            plan("06", 6.3, 15.0, t(1), t(2), "L", anneaux=[(12.45, 2329, 257)]),
            plan("06", 35.0, 38.0, t(2), t(3), "L", anneaux=[(35.3, 1706, 166)]),
            plan("06", 38.0, 44.6, t(3), t(4), "L"),
            plan("06", 45.9, 49.2, t(4), f, "P"),
        ]
    if n == "07":
        return [
            plan("07", 0.0, 2.4, 0, t(1), "P"),
            plan("07", 2.4, 7.0, t(1), t(2), "P", anneaux=[(2.7, 300, 1010)]),
            # 7,2 → 9,4 coupé : le clavier y propose une adresse personnelle.
            plan("07", 9.6, 22.4, t(2), t(3), "P", anneaux=[(21.85, 590, 2025)]),
            plan("07", 22.4, 27.5, t(3), f, "P"),
        ]
    if n == "08":
        return [
            plan("08", 0.0, 6.0, 0, t(1), "P", anneaux=[(4.6, 550, 1555)]),
            plan("08", 9.0, 13.5, t(1), t(2), "P", anneaux=[(9.6, 550, 1690)]),
            plan("08", 13.5, 15.8, t(2), f, "P"),
        ]
    raise KeyError(n)


# ---- L'extraction --------------------------------------------------------------
def taille_extraite(layout: str, zoom) -> tuple[int, int]:
    if zoom:
        return (L_CROP[2], L_CROP[3]) if layout == "L" else P_SRC
    return (L_BOITE[2], L_BOITE[3]) if layout == "L" else (P_BOITE[2], P_BOITE[3])


def images_du_plan(p: dict):
    """Les images du plan, à 30 i/s, déjà à la vitesse voulue."""
    duree = p["fin"] - p["debut"]
    n = max(1, round(duree * FPS))
    vitesse = 1.0 if p["mode"] == "gel" else (p["b"] - p["a"]) / duree
    l, h = taille_extraite(p["layout"], p["zoom"])
    vf = []
    if p["layout"] == "L":
        cx, cy, cl, ch = L_CROP
        vf += ["transpose=2", f"crop={cl}:{ch}:{cx}:{cy}"]
    vf += [f"setpts=(PTS-STARTPTS)/{vitesse:.6f}", f"fps={FPS}", f"scale={l}:{h}:flags=bicubic", "format=rgb24"]
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{p['a']:.3f}", "-to", f"{p['b']:.3f}",
           "-i", str(SOURCES / f"{p['src']}.MP4"), "-vf", ",".join(vf), "-f", "rawvideo", "-"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    taille = l * h * 3
    derniere = None
    for _ in range(n):
        brut = proc.stdout.read(taille)
        if len(brut) == taille:
            derniere = np.frombuffer(brut, np.uint8).reshape(h, l, 3)
        if derniere is None:
            derniere = np.zeros((h, l, 3), np.uint8)
        yield derniere
    proc.stdout.close()
    proc.kill()


def zoomer(img: np.ndarray, p: dict, t: float) -> Image.Image:
    """Le zoom d'un plan : il s'avance en 0,7 s vers sa cible, puis tient."""
    sl, sh = img.shape[1], img.shape[0]
    cx, cy, z = p["zoom"]
    e = min(1.0, t / 0.7)
    e = e * e * (3 - 2 * e)
    zz = 1 + (z - 1) * e
    mx, my = sl / 2 + (cx - sl / 2) * e, sh / 2 + (cy - sh / 2) * e
    cl, ch = sl / zz, sh / zz
    x0 = min(max(0, mx - cl / 2), sl - cl)
    y0 = min(max(0, my - ch / 2), sh - ch)
    l, h = (L_BOITE[2], L_BOITE[3]) if p["layout"] == "L" else (P_BOITE[2], P_BOITE[3])
    return Image.fromarray(img).resize((l, h), Image.BILINEAR, box=(x0, y0, x0 + cl, y0 + ch))


# ---- La composition --------------------------------------------------------------
class Chapitre:
    def __init__(self, n: str):
        self.n = n
        self.plans = plans(n)
        self.duree = CARTE + FIN_DE(n)
        self.etiquettes = {lay: etiquette(n, lay) for lay in ("L", "P")}
        self.sous_titres = [
            {lay: sous_titre(m["texte"], lay) for lay in ("L", "P")} | {"debut": m["debut"], "fin": m["fin"]}
            for m in TEXTE[n]["morceaux"]
        ]
        self.anneaux = []
        for p in self.plans:
            duree = p["fin"] - p["debut"]
            vitesse = 1.0 if p["mode"] == "gel" else (p["b"] - p["a"]) / duree
            for ts, x, y in p["anneaux"]:
                tc = p["debut"] + (ts - p["a"]) / vitesse
                self.anneaux.append((tc, *vers_ecran(p["layout"], x, y)))

    def images(self, precedente: Image.Image):
        """Les images du chapitre : son carton, puis son contenu."""
        flux = self.contenu()
        premiere = next(flux)
        nc = round(CARTE * FPS)
        for k in range(nc):
            t = k / FPS
            dec = min(1.0, max(0.0, (t - 0.25) / 0.5))
            dec = 1 - (1 - dec) ** 3
            c = carton(self.n, dec)
            if t < 0.35:
                yield Image.blend(precedente, c, t / 0.35)
            elif t > CARTE - 0.35:
                yield Image.blend(c, premiere, (t - (CARTE - 0.35)) / 0.35)
            else:
                yield c
        yield premiere
        yield from flux

    def contenu(self):
        for p in self.plans:
            fond = FOND if p["layout"] == "L" else FOND_P
            bx, by, bl, bh = L_BOITE if p["layout"] == "L" else P_BOITE
            masque = MASQUE_L if p["layout"] == "L" else MASQUE_P
            for k, img in enumerate(images_du_plan(p)):
                t = p["debut"] + k / FPS
                cadre = zoomer(img, p, k / FPS) if p["zoom"] else Image.fromarray(img)
                f = fond.copy()
                f.paste(cadre, (bx, by), masque)
                f = f.convert("RGBA")
                eti, pos = self.etiquettes[p["layout"]]
                f.alpha_composite(eti, pos)
                for s in self.sous_titres:
                    if s["debut"] <= t < s["fin"]:
                        img_s, pos_s = s[p["layout"]]
                        a = min(1.0, (t - s["debut"]) / 0.15, (s["fin"] - t) / 0.12)
                        if a < 1:
                            img_s = img_s.copy()
                            img_s.putalpha(img_s.getchannel("A").point(lambda v, a=a: int(v * a)))
                        f.alpha_composite(img_s, pos_s)
                for (ta, x, y) in self.anneaux:
                    i = int((t - ta) * FPS)
                    if 0 <= i < len(ANNEAUX):
                        sp = ANNEAUX[i]
                        f.alpha_composite(sp, (int(x - sp.width / 2), int(y - sp.height / 2)))
                yield f.convert("RGB")


def intro() -> list[Image.Image]:
    base = FOND.copy()
    logo = Image.open(LOGO).convert("RGBA")
    logo = logo.resize((520, int(520 * logo.height / logo.width)), Image.LANCZOS)
    out = []
    n = round(INTRO * FPS)
    for k in range(n):
        t = k / FPS
        img = base.copy().convert("RGBA")
        a = min(1.0, t / 0.6)
        e = 1 - (1 - a) ** 3
        lg = logo.copy()
        lg.putalpha(lg.getchannel("A").point(lambda v, a=a: int(v * a)))
        img.alpha_composite(lg, (W // 2 - lg.width // 2, 170 + int(20 * (1 - e))))
        d = ImageDraw.Draw(img)
        a2 = min(1.0, max(0.0, (t - 0.4) / 0.6))
        f1 = police("Outfit-Black.ttf", 80)
        f2 = police("Outfit-Medium.ttf", 36)
        t1 = "Tenir la console d'un match"
        t2 = "Le tutoriel de l'organisateur, en huit étapes"
        d.text((W // 2 - f1.getlength(t1) / 2, 560 + int(24 * (1 - a2))), t1, font=f1, fill=BLANC + (int(255 * a2),))
        d.text((W // 2 - f2.getlength(t2) / 2, 680 + int(24 * (1 - a2))), t2, font=f2, fill=VERT + (int(255 * a2),))
        out.append(img.convert("RGB"))
    return out


def fin(precedente: Image.Image) -> list[Image.Image]:
    base = FOND.copy().convert("RGBA")
    logo = Image.open(LOGO).convert("RGBA")
    logo = logo.resize((600, int(600 * logo.height / logo.width)), Image.LANCZOS)
    base.alpha_composite(logo, (W // 2 - logo.width // 2, 260))
    d = ImageDraw.Draw(base)
    f1 = police("Outfit-Bold.ttf", 44)
    t1 = "koppafoot.com"
    d.text((W // 2 - f1.getlength(t1) / 2, 640), t1, font=f1, fill=BLANC)
    base = base.convert("RGB")
    out = []
    n = round(FIN * FPS)
    for k in range(n):
        t = k / FPS
        if t < 0.5:
            out.append(Image.blend(precedente, base, t / 0.5))
        elif t > FIN - 0.6:
            out.append(Image.blend(base, Image.new("RGB", (W, H), FOND_HAUT), (t - (FIN - 0.6)) / 0.6))
        else:
            out.append(base)
    return out


def rendre(chapitres: list[str], nom: str):
    debuts, t = {}, INTRO if chapitres[0] == "01" else 0.0
    for n in chapitres:
        debuts[n] = t
        t += CARTE + FIN_DE(n)
    total = t + (FIN if chapitres[-1] == "08" else 0)
    video = SORTIE / f"{nom}-image.mp4"
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
         "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", str(video)],
        stdin=subprocess.PIPE)
    compte = 0
    derniere = FOND.copy()
    if chapitres[0] == "01":
        for img in intro():
            enc.stdin.write(img.tobytes()); compte += 1
        derniere = img
    for n in chapitres:
        ch = Chapitre(n)
        attendu = round((debuts[n] + ch.duree) * FPS)
        for img in ch.images(derniere):
            if compte >= attendu:
                break
            enc.stdin.write(img.tobytes()); compte += 1
            derniere = img
        while compte < attendu:
            enc.stdin.write(derniere.tobytes()); compte += 1
        print(f"chapitre {n} : {compte} images", flush=True)
    if chapitres[-1] == "08":
        for img in fin(derniere):
            enc.stdin.write(img.tobytes()); compte += 1
    enc.stdin.close()
    enc.wait()

    # La voix : chaque chapitre démarre après son carton.
    entrees, filtres = [], []
    for i, n in enumerate(chapitres):
        entrees += ["-i", str(SOURCES / f"{n}.mp3")]
        ms = int((debuts[n] + CARTE) * 1000)
        filtres.append(f"[{i + 1}:a]aresample=48000,adelay={ms}|{ms}[a{i}]")
    mix = "".join(f"[a{i}]" for i in range(len(chapitres)))
    filtres.append(f"{mix}amix=inputs={len(chapitres)}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,"
                   f"apad,atrim=0:{compte / FPS:.3f}[voix]")
    finale = FINALE if nom == "tutoriel-console" else SORTIE / f"{nom}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), *entrees, "-filter_complex", ";".join(filtres),
                    "-map", "0:v", "-map", "[voix]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
                    "-movflags", "+faststart", str(finale)], check=True)
    video.unlink()
    print("écrit", finale.name, f"{compte / FPS:.1f} s")


if __name__ == "__main__":
    tous = ["01", "02", "03", "04", "05", "06", "07", "08"]
    choisis = sys.argv[1:] or tous
    rendre(choisis, "tutoriel-console" if choisis == tous else "essai-" + "-".join(choisis))
