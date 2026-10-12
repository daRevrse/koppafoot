// Pose le son sur l'image : video-muette.mp4 → ../Presentation-KoppaFoot.mp4.
//
//   node mixage.mjs                       (rendu.mjs l'appelle à la fin)
//   MUSIQUE=fond.mp3 node mixage.mjs      avec une musique, baissée sous la voix
//
// Les couches :
//  - la voix off, un fichier par scène (../voix), à l'instant où sa scène
//    commence (montage.json, écrit par rendu.mjs) ;
//  - les bruitages de l'interface (toucher, notifications, vibration,
//    glissés), le coup de sifflet final et la foule, synthétisés ici par
//    ffmpeg, aux temps que la page a notés (montage.json) ;
//  - en option, une musique : elle s'efface d'elle-même quand la voix parle.
// Puis le tout est ramené à -14 LUFS, le niveau des plateformes vidéo.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ICI = import.meta.dirname;
const MUETTE = path.join(ICI, "video-muette.mp4");
const SORTIE = process.env.SORTIE ?? path.resolve(ICI, "../Presentation-KoppaFoot.mp4");
const VOIX = path.resolve(ICI, "../voix");
const { duree: DUREE, pistes, sons } = JSON.parse(fs.readFileSync(path.join(ICI, "montage.json"), "utf8"));

function ffmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return execFileSync("python3", ["-c", "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())"]).toString().trim();
  } catch {
    return "ffmpeg";
  }
}
const FF = ffmpeg();
const ff = (args) => execFileSync(FF, ["-hide_banner", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });

// ── Les bruitages ────────────────────────────────────────────
const BRUITAGES = {
  // Le doigt sur l'écran.
  toucher: { d: 0.07, f: "0.35*sin(2*PI*1900*t)*exp(-t*85)" },
  // Une notification : deux notes claires.
  notif: { d: 1.0, f: "0.2*(sin(2*PI*1318.5*t)+0.4*sin(2*PI*2637*t))*exp(-t*7)"
    + "+gte(t,0.12)*0.2*(sin(2*PI*1975.5*(t-0.12))+0.4*sin(2*PI*3951*(t-0.12)))*exp(-(t-0.12)*5)" },
  // Le téléphone vibre : deux impulsions sourdes.
  vibre: { d: 0.5, f: "0.45*sin(2*PI*165*t)*(0.65+0.35*sin(2*PI*28*t))*(lt(t,0.17)+between(t,0.25,0.42))" },
  // Le coup de sifflet final : trois coups, le dernier long, une note qui roule.
  // Chaque coup s'ouvre et se ferme en 12 ms : coupé net, un son pur aussi
  // aigu déborde à l'encodage AAC.
  sifflet: { d: 2.3, f: "0.15*sin(2*PI*(2850+90*sin(2*PI*42*t))*t)*("
    + [[0, 0.28], [0.42, 0.7], [0.85, 2.2]].map(([a, b]) => `max(0,min(1,min((t-${a})*80,(${b}-t)*80)))`).join("+")
    + ")*(1-0.4*gte(t,2.0))" },
  // Un trait de lumière (le logo).
  eclat: { d: 1.2, f: "0.18*sin(2*PI*(220+440*t)*t)*exp(-t*3)+0.12*sin(2*PI*880*t)*exp(-t*5)" },
  // Le glissé d'un téléphone, d'une carte : un souffle.
  glisse: { d: 0.45, bruit: "pink", filtre: "highpass=f=700,lowpass=f=6000,afade=t=in:d=0.18,afade=t=out:st=0.18:d=0.27,volume=0.45" },
  // La foule d'un stade, au loin.
  foule: { d: 2.6, bruit: "brown", filtre: "bandpass=f=900:w=1400,afade=t=in:d=0.6,afade=t=out:st=1.4:d=1.2,volume=1.6" },
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kf-presentation-"));
for (const [nom, b] of Object.entries(BRUITAGES)) {
  const f = path.join(tmp, `${nom}.wav`);
  if (b.bruit) ff(["-f", "lavfi", "-i", `anoisesrc=d=${b.d}:c=${b.bruit}:a=0.6:r=48000`, "-af", b.filtre, "-ac", "2", f]);
  else ff(["-f", "lavfi", "-i", `aevalsrc='${b.f}':d=${b.d}:s=48000`, "-ac", "2", f]);
}

// ── Le graphe de mixage ──────────────────────────────────────
const entrees = [];
const branches = [];
const ajoute = (fichier, filtre) => {
  const k = branches.length;
  entrees.push("-i", fichier);
  branches.push(`[${k}:a]${filtre}`);
  return k;
};
const retard = (t) => `adelay=delays=${Math.round(t * 1000)}:all=1`;
const fmt = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";

const voix = pistes.map((p) => ajoute(path.join(VOIX, p.fichier), `${fmt},volume=1.0,${retard(p.t)}[v${p.fichier.slice(0, 2)}]`));
const nomsVoix = pistes.map((p) => `[v${p.fichier.slice(0, 2)}]`);
const effets = sons.map((s, i) => { ajoute(path.join(tmp, `${s.son}.wav`), `${fmt},volume=0.55,${retard(s.t)}[e${i}]`); return `[e${i}]`; });

// Un silence de la durée exacte de la vidéo porte le reste : le mélange
// s'arrête avec lui (duration=first). Un `apad` en bout de graphe ferait
// échouer ffmpeg 7.0 (« Assertion best_input >= 0 failed »).
const silence = branches.length;
entrees.push("-f", "lavfi", "-t", String(DUREE), "-i", "anullsrc=r=48000:cl=stereo");
branches.push(`[${silence}:a]${fmt}[silence]`);

let graphe = branches.join(";") + ";";
graphe += `${nomsVoix.join("")}amix=inputs=${nomsVoix.length}:normalize=0[voix];`;
graphe += `${effets.join("")}amix=inputs=${effets.length}:normalize=0[effets];`;
let couches = "[silence][voixa][effets]";
if (process.env.MUSIQUE) {
  const k = silence + 1;
  entrees.push("-stream_loop", "-1", "-i", path.resolve(process.env.MUSIQUE));
  graphe += "[voix]asplit=2[voixa][voixb];";
  graphe += `[${k}:a]${fmt},volume=0.35,atrim=0:${DUREE}[mus];[mus][voixb]sidechaincompress=threshold=0.02:ratio=8:attack=40:release=600[musique];`;
  couches += "[musique]";
} else {
  graphe += "[voix]anull[voixa];";
}
const n = couches.split("][").length;
graphe += `${couches}amix=inputs=${n}:normalize=0:duration=first,afade=t=out:st=${DUREE - 2}:d=2[mix]`;

// Premier passage : mesurer. Second : ramener à -14 LUFS, puis limiter les crêtes.
const mix = path.join(tmp, "mix.wav");
ff([...entrees, "-filter_complex", graphe, "-map", "[mix]", "-ar", "48000", mix]);
const brut = spawnSync(FF, ["-hide_banner", "-i", mix, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"]).stderr.toString();
const j = JSON.parse(brut.slice(brut.lastIndexOf("{"), brut.lastIndexOf("}") + 1));
// Visé un peu au-dessus de -14 : le limiteur qui suit en reprend environ 0,7 LU.
const norme = `loudnorm=I=-13.3:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}`
  + `:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
// Le gain peut porter les crêtes au-delà de 0 dB : un limiteur les tient à
// -3 dBFS, la marge que l'AAC et les crêtes entre échantillons consomment.
const limite = "alimiter=limit=0.708:attack=5:release=60:level=disabled";
ff(["-i", MUETTE, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
  "-af", `${norme},aresample=192000,${limite},aresample=48000`, "-c:a", "aac", "-b:a", "192k",
  "-map_metadata", "-1", "-movflags", "+faststart", "-shortest", SORTIE]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log("vidéo :", SORTIE, `(${(fs.statSync(SORTIE).size / 1e6).toFixed(1)} Mo, son mesuré à ${j.input_i} LUFS avant normalisation)`);
