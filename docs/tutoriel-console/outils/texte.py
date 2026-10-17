"""Le texte de chaque chapitre, découpé en sous-titres et calé sur les pauses de la voix.

Un sous-titre = une phrase (coupée en deux si elle est trop longue), sur une
ou deux lignes. Ses frontières tombent sur des pauses de la voix : la voix de
synthèse en marque une à chaque point, et d'autres, plus courtes, aux
virgules. On choisit, dans l'ordre, la pause la plus proche de l'endroit où
la proportion de caractères mettrait la frontière, en préférant les longues
(programmation dynamique : jamais de frontière qui recule).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ICI = Path(__file__).resolve().parent
SOURCES = ICI.parent / "sources"
TEXTE = ICI.parent / "voix-off.md"
MAX_SOUS_TITRE = 96   # au-delà, la phrase se coupe en deux sous-titres
MAX_LIGNE = 50


def voix_off() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    chap, dans_voix = None, False
    for ligne in TEXTE.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^## (\d)\. ", ligne)
        if m:
            chap, dans_voix = f"0{m.group(1)}", False
            out[chap] = []
            continue
        if ligne.strip() == "**Voix off**":
            dans_voix = True
            continue
        if ligne.startswith("---") or ligne.startswith("**À filmer**"):
            dans_voix = False
            continue
        if chap and dans_voix and ligne.strip():
            out[chap].append(ligne.strip())
    return out


def couper_en_deux(ph: str) -> list[str]:
    """Coupe une phrase trop longue à la ponctuation la plus proche du milieu."""
    milieu = len(ph) / 2
    candidats = [m.end() for m in re.finditer(r"[:,]\s", ph)]
    if not candidats:
        return [ph]
    c = min(candidats, key=lambda i: abs(i - milieu))
    return [ph[:c].strip(), ph[c:].strip()]


def insecable(texte: str) -> str:
    """Les espaces de la typographie française ne se coupent pas : « Mi-temps », puis :"""
    nb = chr(0xA0)
    texte = texte.replace(chr(0xAB) + " ", chr(0xAB) + nb)
    for signe in chr(0xBB) + ":?!;":
        texte = texte.replace(" " + signe, nb + signe)
    return texte


def lignes(texte: str) -> str:
    """Une ou deux lignes équilibrées, coupées entre deux mots."""
    texte = insecable(texte)
    if len(texte) <= MAX_LIGNE:
        return texte
    mots = texte.split(" ")
    meilleur, ecart = texte, 10**9
    for i in range(1, len(mots)):
        a, b = " ".join(mots[:i]), " ".join(mots[i:])
        e = abs(len(a) - len(b))
        if e < ecart:
            meilleur, ecart = f"{a}\n{b}", e
    return meilleur


def morceaux(paragraphes: list[str]) -> list[str]:
    res = []
    for p in paragraphes:
        for ph in re.split(r"(?<=[.?!])\s+", p):
            res.extend(couper_en_deux(ph) if len(ph) > MAX_SOUS_TITRE else [ph])
    return res


def pauses(n: str) -> tuple[float, list[tuple[float, float]]]:
    f = SOURCES / f"{n}.mp3"
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(f), "-af",
                        "silencedetect=noise=-38dB:d=0.2", "-f", "null", "-"],
                       capture_output=True, text=True)
    debuts = [float(x) for x in re.findall(r"silence_start: ([0-9.]+)", r.stderr)]
    fins = [float(x) for x in re.findall(r"silence_end: ([0-9.]+)", r.stderr)]
    d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)],
                             capture_output=True, text=True).stdout)
    return d, [((a + b) / 2, b - a) for a, b in zip(debuts, fins)]


def caler(n: str, paragraphes: list[str]) -> dict:
    d, ps = pauses(n)
    ms = morceaux(paragraphes)
    # Le temps prévu d'un morceau : ses caractères, plus les pauses que la voix
    # marque à sa ponctuation. La vitesse se règle pour retomber sur la durée.
    PAUSE = {",": 0.35, ":": 0.4, ";": 0.4, ".": 0.45, "?": 0.45, "!": 0.45}
    car = [len(m) for m in ms]
    pauses_prevues = [sum(PAUSE.get(x, 0) for x in m) for m in ms]
    vitesse = (d - 0.3 - sum(pauses_prevues)) / sum(car)
    cibles, cumul = [], 0.1
    for i in range(len(ms) - 1):
        cumul += car[i] * vitesse + pauses_prevues[i]
        cibles.append(cumul)

    # Programmation dynamique : frontière i sur la pause j, j strictement croissant.
    INF = float("inf")
    nb, np_ = len(cibles), len(ps)
    cout = [[INF] * np_ for _ in range(nb)]
    prec = [[-1] * np_ for _ in range(nb)]
    def c(i, j):
        t, longueur = ps[j]
        return (t - cibles[i]) ** 2 - 6.0 * longueur
    for j in range(np_):
        if nb:
            cout[0][j] = c(0, j)
    for i in range(1, nb):
        meilleur, arg = INF, -1
        for j in range(np_):
            if j > 0 and cout[i - 1][j - 1] < meilleur:
                meilleur, arg = cout[i - 1][j - 1], j - 1
            if meilleur < INF:
                cout[i][j] = meilleur + c(i, j)
                prec[i][j] = arg
    frontieres = list(cibles)
    if nb and np_ >= nb:
        j = min(range(np_), key=lambda k: cout[nb - 1][k])
        for i in range(nb - 1, -1, -1):
            frontieres[i] = ps[j][0]
            j = prec[i][j]
    bornes = [0.0] + frontieres + [d]
    return {
        "duree": round(d, 3),
        "morceaux": [
            {"texte": lignes(m), "debut": round(bornes[i], 2), "fin": round(bornes[i + 1], 2)}
            for i, m in enumerate(ms)
        ],
    }


if __name__ == "__main__":
    tout = {n: caler(n, p) for n, p in voix_off().items()}
    (ICI / "texte.json").write_text(json.dumps(tout, ensure_ascii=False, indent=1), encoding="utf-8")
    for n, ch in tout.items():
        print(f"== {n} ({ch['duree']} s)")
        for m in ch["morceaux"]:
            print(f"  {m['debut']:6.2f}-{m['fin']:6.2f}  {m['texte'].replace(chr(10), ' / ')}")
