# Le minutage de la voix off, mot par mot : ../voix/*.mp3 → ../source/voix.js.
# Il sert à caler l'image sur la voix (animation.html lit window.VOIX).
#
#   python3 -m venv stt && stt/bin/pip install faster-whisper imageio-ffmpeg
#   stt/bin/python -I transcrire.py
#
# Le modèle « small » (environ 500 Mo) se télécharge au premier lancement.
import glob, json, os, re, subprocess
import imageio_ffmpeg
from faster_whisper import WhisperModel

ICI = os.path.dirname(os.path.abspath(__file__))
VOIX = os.path.join(ICI, "..", "voix")
SORTIE = os.path.join(ICI, "..", "source", "voix.js")
INDICE = "KoppaFoot, Avenir d'Adakpamé, Olympique de Tokoin, Bè, Kafui, Edem, Komi, Elikem, Kossi, Afi, Tribune, Actus."

modele = WhisperModel("small", device="cpu", compute_type="int8")
voix = {}
for f in sorted(glob.glob(os.path.join(VOIX, "*.mp3"))):
    segments, _ = modele.transcribe(f, language="fr", word_timestamps=True, beam_size=5, initial_prompt=INDICE)
    mots = [[round(w.start, 2), round(w.end, 2), w.word.strip()] for s in segments for w in s.words]
    sortie = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-i", f], capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", sortie).groups()
    voix[os.path.basename(f)[:-4]] = {"duree": round(int(h) * 3600 + int(m) * 60 + float(s), 2), "mots": mots}
    print(os.path.basename(f), " ".join(w[2] for w in mots))
with open(SORTIE, "w") as o:
    o.write("// Le minutage de la voix off, mot par mot (outils/transcrire.py, faster-whisper).\n"
            "// Les mots sont ceux qu'a entendus la transcription : ils servent à caler\n"
            "// l'image sur la voix, pas à être affichés.\n")
    o.write("window.VOIX = " + json.dumps(voix, ensure_ascii=False) + ";\n")
