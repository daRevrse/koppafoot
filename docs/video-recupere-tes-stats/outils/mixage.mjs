// Pose le son sur l'image : video-muette.mp4 → ../Suivre-son-match-KoppaFoot.mp4.
//
//   node mixage.mjs     (rendu.mjs l'appelle à la fin)
//
// Trois couches, aucune musique :
//  - le son d'origine des plans réels (montage.mjs) : « plein » quand on voit
//    le terrain, « lointain » (étouffé, plus bas) quand on n'y est pas ;
//  - le coup de sifflet de la faute, qui fait passer au noir ;
//  - les bruitages de l'interface (bulles, toucher, notifications,
//    vibration), synthétisés ici par ffmpeg, aux temps que la page a notés
//    (sons.json, écrit par rendu.mjs).
// Puis le tout est ramené à -14 LUFS, le niveau des plateformes vidéo.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PLANS, SONS_DE_PLAN, DUREE } from "./montage.mjs";

const ICI = import.meta.dirname;
const MUETTE = path.join(ICI, "video-muette.mp4");
const SORTIE = process.env.SORTIE ?? path.resolve(ICI, "../Suivre-son-match-KoppaFoot.mp4");
const PLANS_DIR = path.resolve(ICI, "../source/plans");

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
  // Une bulle reçue : un « pop » bref qui monte.
  pop: { d: 0.14, f: "0.55*sin(2*PI*(650+4200*t)*t)*exp(-t*38)" },
  // Un message envoyé : plus aigu, plus court.
  envoi: { d: 0.14, f: "0.45*sin(2*PI*(1300+3500*t)*t)*exp(-t*34)" },
  // Le doigt sur l'écran.
  toucher: { d: 0.07, f: "0.4*sin(2*PI*1900*t)*exp(-t*85)" },
  // Une notification : deux notes claires.
  notif: { d: 1.0, f: "0.24*(sin(2*PI*1318.5*t)+0.4*sin(2*PI*2637*t))*exp(-t*7)"
    + "+gte(t,0.12)*0.24*(sin(2*PI*1975.5*(t-0.12))+0.4*sin(2*PI*3951*(t-0.12)))*exp(-(t-0.12)*5)" },
  // Le téléphone vibre (un but) : deux impulsions sourdes.
  vibre: { d: 0.5, f: "0.5*sin(2*PI*165*t)*(0.65+0.35*sin(2*PI*28*t))*(lt(t,0.17)+between(t,0.25,0.42))" },
  // Le téléphone qui glisse : un souffle.
  glisse: { d: 0.45, bruit: true },
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
const entrees = [];
const branches = [];
const ajoute = (fichier, filtre) => {
  const k = branches.length;
  entrees.push("-i", fichier);
  branches.push(`[${k}:a]${filtre}[a${k}]`);
};
const retard = (t) => `adelay=delays=${Math.round(t * 1000)}:all=1`;

/** La couleur d'un son de plan : plein, ou lointain (étouffé, plus bas). */
const couleur = (son, gain = 1) => (son === "lointain"
  ? `lowpass=f=750,volume=${(0.55 * gain).toFixed(2)}`
  : `volume=${(2.2 * gain).toFixed(2)}`);

for (const p of PLANS) {
  if (p.son === "aucun") continue;
  const d = +(p.a - p.de).toFixed(3);      // le son reste à vitesse normale, même sous un ralenti
  // Des fondus très courts : pas de clic aux coupes.
  ajoute(path.join(PLANS_DIR, `${p.id}.mp4`),
    `aresample=48000,aformat=channel_layouts=stereo,atrim=0:${d},asetpts=N/SR/TB,${couleur(p.son)},`
    + `afade=t=in:d=0.04,afade=t=out:st=${Math.max(0, d - 0.06).toFixed(3)}:d=0.06,${retard(p.t)}`);
}
// Le son seul : le coup de sifflet, le match au loin.
SONS_DE_PLAN.forEach((s, i) => {
  const d = +(s.a - s.de).toFixed(3);
  const f = s.fondu ?? 0.1;
  ajoute(path.join(PLANS_DIR, `son-${i + 1}.m4a`),
    `aresample=48000,aformat=channel_layouts=stereo,${couleur(s.son, s.gain)},`
    + `afade=t=in:d=${f},afade=t=out:st=${(d - f).toFixed(3)}:d=${f},${retard(s.t)}`);
});
const sons = JSON.parse(fs.readFileSync(path.join(ICI, "sons.json"), "utf8"));
for (const { t, son } of sons) {
  ajoute(path.join(tmp, `${son}.wav`), `aformat=channel_layouts=stereo,${retard(t)}`);
}

const n = branches.length;
const graphe = branches.join(";")
  + ";" + branches.map((_, k) => `[a${k}]`).join("")
  + `amix=inputs=${n}:normalize=0:duration=longest,apad=whole_dur=${DUREE},atrim=0:${DUREE},`
  + `afade=t=out:st=${DUREE - 2.2}:d=2.2[mix]`;

// Premier passage : mesurer. Second : ramener à -14 LUFS, crête à -1,5 dB.
const mix = path.join(tmp, "mix.wav");
ff([...entrees, "-filter_complex", graphe, "-map", "[mix]", "-ar", "48000", mix]);
// loudnorm écrit sa mesure sur la sortie d'erreur.
const brut = spawnSync(FF, ["-hide_banner", "-i", mix, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
  .stderr.toString();
const j = JSON.parse(brut.slice(brut.lastIndexOf("{"), brut.lastIndexOf("}") + 1));
const norme = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}`
  + `:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;

ff(["-i", MUETTE, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
  "-af", `${norme},aresample=48000`, "-c:a", "aac", "-b:a", "192k",
  "-map_metadata", "-1", "-movflags", "+faststart", "-shortest", SORTIE]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log("vidéo :", SORTIE, `(${(fs.statSync(SORTIE).size / 1e6).toFixed(1)} Mo, son à ${j.input_i} → -14 LUFS)`);
