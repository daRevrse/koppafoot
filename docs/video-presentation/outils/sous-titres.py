# Les sous-titres de la vidéo : ../Presentation-KoppaFoot.fr.srt, à charger
# dans YouTube Studio.
#
#   python3 sous-titres.py        (après rendu.mjs, qui écrit montage.json)
#
# Le texte est celui du scénario (../scenario.md, section 3), pas celui
# qu'a entendu la transcription : « coup de sifflet » et non « coutiflet ».
# Le minutage vient de la transcription (../source/voix.js) : chaque mot du
# texte est rapproché du mot entendu le plus proche, et les mots que la
# transcription a mal compris prennent le temps de leurs voisins.
import difflib, json, os, re, unicodedata

ICI = os.path.dirname(os.path.abspath(__file__))
SCENARIO = os.path.join(ICI, "..", "scenario.md")
VOIX = os.path.join(ICI, "..", "source", "voix.js")
MONTAGE = os.path.join(ICI, "montage.json")
SORTIE = os.path.join(ICI, "..", "Presentation-KoppaFoot.fr.srt")

# Ce que la voix de synthèse lit en toutes lettres, et qu'un sous-titre écrit comme on l'écrit.
A_L_ECRAN = [("koppa foot point com", "koppafoot.com"), ("Koppa Foot", "KoppaFoot")]
LIGNE = 42          # caractères par ligne, deux lignes au plus
CARTON = 2 * LIGNE


def norme(s):
    s = unicodedata.normalize("NFD", s)
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in s if not unicodedata.combining(c)).lower())


def blocs_du_scenario():
    texte = open(SCENARIO, encoding="utf-8").read()
    section = texte[texte.index("## 3."):texte.index("## 4.")]
    return re.findall(r"\*\*(\d\d) · [^*]+\*\*\s*```\n(.*?)```", section, re.S)


def caler(mots_texte, entendus):
    """Le début et la fin de chaque mot du texte, en secondes dans son fichier audio."""
    # Les apostrophes coupent les mots en deux pour la transcription (« l », « 'arbitre »).
    unites, proprietaire = [], []
    for i, m in enumerate(mots_texte):
        for u in re.split(r"[’']", m):
            if norme(u):
                unites.append(norme(u))
                proprietaire.append(i)
    oui = [norme(w[2]) for w in entendus]
    temps = [None] * len(mots_texte)
    for a, b, n in difflib.SequenceMatcher(None, unites, oui, autojunk=False).get_matching_blocks():
        for k in range(n):
            i, (debut, fin, _) = proprietaire[a + k], entendus[b + k]
            temps[i] = (debut, fin) if temps[i] is None else (min(temps[i][0], debut), max(temps[i][1], fin))
    # Les mots sans correspondance : entre leurs voisins.
    connus = [i for i, t in enumerate(temps) if t]
    for i, t in enumerate(temps):
        if t:
            continue
        avant = max((j for j in connus if j < i), default=None)
        apres = min((j for j in connus if j > i), default=None)
        d = temps[avant][1] if avant is not None else 0.0
        f = temps[apres][0] if apres is not None else d + 0.4
        n = (apres if apres is not None else len(temps)) - (avant if avant is not None else -1)
        k = i - (avant if avant is not None else -1)
        pas = (f - d) / n
        temps[i] = (d + pas * (k - 1), d + pas * k)
    return temps


def couper(texte):
    """Deux lignes équilibrées, coupées sur une espace."""
    if len(texte) <= LIGNE:
        return texte
    milieu = len(texte) // 2
    espaces = [i for i, c in enumerate(texte) if c == " "]
    # Après une virgule si elle tombe assez près du milieu, sinon au plus près du milieu.
    virgules = [e for e in espaces if texte[e - 1] in ",:" and abs(e - milieu) <= 12 and max(e, len(texte) - e) <= LIGNE + 4]
    i = min(virgules or espaces, key=lambda e: abs(e - milieu))
    return texte[:i] + "\n" + texte[i + 1:]


def a_l_ecran(texte):
    for dit, ecrit in A_L_ECRAN:
        texte = texte.replace(dit, ecrit)
    return texte


def horodatage(s):
    ms = int(round(s * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


voix = json.loads(re.search(r"window\.VOIX = (.*);", open(VOIX, encoding="utf-8").read(), re.S).group(1))
pistes = {p["fichier"][:2]: p["t"] for p in json.load(open(MONTAGE, encoding="utf-8"))["pistes"]}

cartons = []
for numero, texte in blocs_du_scenario():
    cle = next(k for k in voix if k.startswith(numero))
    mots = texte.split()
    temps = caler(mots, voix[cle]["mots"])
    debut_piste = pistes[numero]
    courant = []
    for i, m in enumerate(mots):
        courant.append(i)
        long = len(a_l_ecran(" ".join(mots[j] for j in courant)))
        fin_de_phrase = re.search(r"[.!?…:]$", m)
        virgule = m.endswith(",") and long > LIGNE
        suivant = len(a_l_ecran(" ".join(mots[j] for j in courant + [i + 1]))) if i + 1 < len(mots) else 0
        if fin_de_phrase or virgule or suivant > CARTON or i == len(mots) - 1:
            cartons.append([debut_piste + temps[courant[0]][0], debut_piste + temps[courant[-1]][1],
                            a_l_ecran(" ".join(mots[j] for j in courant))])
            courant = []

# Un carton reste affiché jusqu'au suivant (0,1 s d'écart), sans dépasser 1,2 s de silence.
for k, c in enumerate(cartons):
    suite = cartons[k + 1][0] if k + 1 < len(cartons) else c[1] + 1.2
    c[1] = min(max(c[1] + 0.3, c[0] + 1.0), suite - 0.1, c[1] + 1.2)

with open(SORTIE, "w", encoding="utf-8") as o:
    for k, (d, f, t) in enumerate(cartons, 1):
        o.write(f"{k}\n{horodatage(d)} --> {horodatage(f)}\n{couper(t)}\n\n")
print(len(cartons), "sous-titres →", os.path.relpath(SORTIE, ICI))
