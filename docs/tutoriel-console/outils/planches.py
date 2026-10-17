"""Une planche contact par enregistrement : une vignette toutes les `pas` secondes."""
import math
import subprocess
import sys
from pathlib import Path

SOURCES = Path(__file__).resolve().parent.parent / "sources"
SORTIE = Path(__file__).resolve().parent / "planches"
SORTIE.mkdir(exist_ok=True)
POLICE = "C\\:/Windows/Fonts/arial.ttf"


def duree(f: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def planche(n: str, pas: float = 2.0, debut: float = 0.0, fin: float | None = None, nom: str | None = None,
            largeur: int = 236, colonnes: int = 8, couche: bool = False):
    f = SOURCES / f"{n}.MP4"
    d = (fin if fin is not None else duree(f)) - debut
    k = max(1, math.ceil(d / pas))
    lignes = math.ceil(k / colonnes)
    vf = (f"fps=1/{pas},{'transpose=2,' if couche else ''}scale={largeur}:-2,"
          f"drawtext=text='%{{pts\\:hms}}':x=4:y=4:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.6:fontfile='{POLICE}',"
          f"tile={colonnes}x{lignes}:padding=4:color=white")
    sortie = SORTIE / f"{nom or n}.png"
    args = ["ffmpeg", "-v", "error", "-y", "-ss", str(debut), "-t", str(d), "-copyts", "-i", str(f),
            "-vf", vf, "-frames:v", "1", "-update", "1", str(sortie)]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode:
        print(r.stderr[-800:])
    print(sortie.name, k, "vignettes")


if __name__ == "__main__":
    if len(sys.argv) > 2:
        planche(sys.argv[1], pas=float(sys.argv[2]), debut=float(sys.argv[3]), fin=float(sys.argv[4]),
                nom=sys.argv[5], largeur=int(sys.argv[6]) if len(sys.argv) > 6 else 236,
                colonnes=int(sys.argv[7]) if len(sys.argv) > 7 else 8,
                couche=len(sys.argv) > 8 and sys.argv[8] == "couche")
    else:
        for n in ["01", "02", "03", "04", "05", "06", "07", "08"]:
            planche(n)
