// Pose le son sur l'image : video-muette.mp4 → ../Tes-buts-t-attendent-KoppaFoot.mp4.
//
//   node mixage.mjs     (rendu.mjs l'appelle à la fin)
//
// Ni musique ni voix : seulement les bruitages de l'interface et du terrain
// (toucher, frappe au clavier, notification, vibration, coup de sifflet,
// compteurs qui montent, déclic de l'affiche), synthétisés ici par ffmpeg,
// aux temps que la page a notés (sons.json, écrit par rendu.mjs). Puis le
// tout est ramené vers -14 LUFS, le niveau des plateformes vidéo, crêtes
// tenues sous -1,5 dB.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ICI = import.meta.dirname;
const MUETTE = path.join(ICI, "video-muette.mp4");
const SORTIE = process.env.SORTIE ?? path.resolve(ICI, "../Tes-buts-t-attendent-KoppaFoot.mp4");

function ffmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return execFileSync("python3", ["-c", "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())"]).toString().trim();
  } catch {
    return "ffmpeg";
  }
}
const FF = ffmpeg();
const ff = (args, opts = {}) => execFileSync(FF, ["-hide_banner", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"], ...opts });

// ── Les bruitages ────────────────────────────────────────────
const BRUITAGES = {
  // Le doigt sur l'écran.
  toucher: { d: 0.07, f: "0.4*sin(2*PI*1900*t)*exp(-t*85)" },
  // Une touche du clavier : un clic bref, un peu de bruit.
  frappe: { d: 0.05, f: "0.32*sin(2*PI*2600*t)*exp(-t*140)+0.12*(random(0)*2-1)*exp(-t*220)" },
  // Une notification : deux notes claires.
  notif: { d: 1.0, f: "0.24*(sin(2*PI*1318.5*t)+0.4*sin(2*PI*2637*t))*exp(-t*7)"
    + "+gte(t,0.12)*0.24*(sin(2*PI*1975.5*(t-0.12))+0.4*sin(2*PI*3951*(t-0.12)))*exp(-(t-0.12)*5)" },
  // Le téléphone vibre (un but) : deux impulsions sourdes.
  vibre: { d: 0.5, f: "0.5*sin(2*PI*165*t)*(0.65+0.35*sin(2*PI*28*t))*(lt(t,0.17)+between(t,0.25,0.42))" },
  // Le téléphone qui glisse : un souffle.
  glisse: { d: 0.45, bruit: true },
  // Le coup de sifflet de l'arbitre : une note aiguë qui roule, deux fois.
  sifflet: { d: 0.95, f: "0.36*sin(2*PI*(2950+70*sin(2*PI*31*t))*t)*(between(t,0.01,0.3)+between(t,0.42,0.9))*(1-exp(-t*60))" },
  // Une étape franchie : trois notes qui montent.
  succes: { d: 0.6, f: "0.22*sin(2*PI*1046.5*t)*lt(t,0.12)+0.22*sin(2*PI*1318.5*t)*between(t,0.12,0.24)+0.24*sin(2*PI*1568*t)*gte(t,0.24)*exp(-(t-0.24)*6)" },
  // Un compteur qui monte : un « ding » court.
  compteur: { d: 0.35, f: "0.3*(sin(2*PI*1760*t)+0.3*sin(2*PI*3520*t))*exp(-t*14)" },
  // L'affiche qui se pose : un déclic d'appareil photo.
  declic: { d: 0.18, f: "0.5*(random(0)*2-1)*exp(-t*60)*lt(t,0.05)+0.35*(random(0)*2-1)*exp(-(t-0.09)*70)*gte(t,0.09)" },
  // Rien ne s'ouvre : une note grave, sèche.
  refus: { d: 0.22, f: "0.34*sin(2*PI*196*t)*exp(-t*16)+0.2*sin(2*PI*185*t)*exp(-t*16)" },
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kf-mixage-"));
for (const [nom, b] of Object.entries(BRUITAGES)) {
  const f = path.join(tmp, `${nom}.wav`);
  if (b.bruit) {
    ff(["-f", "lavfi", "-i", `anoisesrc=d=${b.d}:c=pink:a=0.6:r=48000`, "-af",
      `highpass=f=700,lowpass=f=6000,afade=t=in:d=0.18,afade=t=out:st=0.18:d=${b.d - 0.18},volume=0.7`, "-ac", "2", f]);
  } else {
    ff(["-f", "lavfi", "-i", `aevalsrc='${b.f}':d=${b.d}:s=48000`, "-ac", "2", f]);
  }
}

// ── Le graphe de mixage ──────────────────────────────────────
const { duree: DUREE, sons } = JSON.parse(fs.readFileSync(path.join(ICI, "sons.json"), "utf8"));
const entrees = [];
const branches = [];
// Un silence de toute la durée : la piste couvre la vidéo même sans bruitage à la fin.
entrees.push("-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${DUREE}`);
branches.push("[0:a]anull[a0]");
for (const { t, son } of sons) {
  if (!BRUITAGES[son]) { console.warn("bruitage inconnu :", son); continue; }
  const k = branches.length;
  entrees.push("-i", path.join(tmp, `${son}.wav`));
  branches.push(`[${k}:a]aformat=channel_layouts=stereo,adelay=delays=${Math.round(t * 1000)}:all=1[a${k}]`);
}
const n = branches.length;
const graphe = branches.join(";")
  + ";" + branches.map((_, k) => `[a${k}]`).join("")
  + `amix=inputs=${n}:normalize=0:duration=longest,apad=whole_dur=${DUREE},atrim=0:${DUREE},`
  + `afade=t=out:st=${DUREE - 1.5}:d=1.5[mix]`;

// Mesurer, puis ramener à -14 LUFS par un gain simple, et tenir les crêtes
// sous -1,5 dB par un limiteur. Pas de loudnorm en second passage : sur des
// bruitages brefs et clairsemés, sans fond sonore, il s'emballait (la crête
// passait au-dessus de 0 dB).
const mix = path.join(tmp, "mix.wav");
ff([...entrees, "-filter_complex", graphe, "-map", "[mix]", "-ar", "48000", mix]);
const mesurer = (f) => {
  const brut = spawnSync(FF, ["-hide_banner", "-i", f, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"]).stderr.toString();
  return JSON.parse(brut.slice(brut.lastIndexOf("{"), brut.lastIndexOf("}") + 1));
};
const avant = mesurer(mix);
const gain = (-14 - Number(avant.input_i)).toFixed(2);
const pose = path.join(tmp, "pose.wav");
ff(["-i", mix, "-af", `volume=${gain}dB,alimiter=limit=0.84:attack=1:release=50:level=false`, "-ar", "48000", pose]);
const j = mesurer(pose);

ff(["-i", MUETTE, "-i", pose, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
  "-c:a", "aac", "-b:a", "192k",
  "-map_metadata", "-1", "-movflags", "+faststart", "-shortest", SORTIE]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log("vidéo :", SORTIE, `(${(fs.statSync(SORTIE).size / 1e6).toFixed(1)} Mo, son : ${avant.input_i} → ${j.input_i} LUFS, crête ${j.input_tp} dB)`);
