// Prépare les plans réels pour l'animation.
//
//   node preparer-plans.mjs
//
// 1. Avec les plans d'origine (dossier rushes/, ou la variable RUSHES) :
//    chaque morceau de montage.mjs → source/plans/<id>.mp4 (1080 × 1920,
//    60 i/s, son compris, SANS métadonnées : ni date ni position GPS), le
//    coup de sifflet → source/plans/sifflet.m4a, et le fond de l'écran
//    verrouillé → source/images/fond-verrou.jpg. Sans eux, on repart des
//    morceaux déjà dans le dépôt.
// 2. Les images de chaque morceau → source/plans/<id>/0001.jpg… (non
//    versionnées) : la page les affiche une à une, image par image.
// 3. source/plans/plans.js : ce que la page doit en savoir.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PLANS, SONS_DE_PLAN } from "./montage.mjs";

const ICI = import.meta.dirname;
const RUSHES = process.env.RUSHES ?? path.join(ICI, "rushes");
const SORTIE = path.resolve(ICI, "../source/plans");
const IPS = 30;

function ffmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return execFileSync("python3", ["-c", "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())"]).toString().trim();
  } catch {
    return "ffmpeg";
  }
}
const FF = ffmpeg();
const ff = (...args) => execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const rush = (nom) => path.join(RUSHES, `${nom}.mov`);

fs.mkdirSync(SORTIE, { recursive: true });

// 1. Les morceaux, depuis les plans d'origine.
if (fs.existsSync(rush("but")) && fs.existsSync(rush("faute"))) {
  for (const p of PLANS) {
    ff("-ss", String(p.de), "-t", String(p.a - p.de), "-i", rush(p.plan),
      "-map", "0:v:0", "-map", "0:a:0", "-map_metadata", "-1", "-map_chapters", "-1",
      "-vf", "scale=1080:1920:flags=lanczos,fps=60", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
      path.join(SORTIE, `${p.id}.mp4`));
    console.log("morceau", p.id, `${p.plan} ${p.de} → ${p.a} s`);
  }
  SONS_DE_PLAN.forEach((s, i) => {
    ff("-ss", String(s.de), "-t", String(s.a - s.de), "-i", rush(s.plan), "-vn", "-map_metadata", "-1",
      "-c:a", "aac", "-b:a", "160k", path.join(SORTIE, `son-${i + 1}.m4a`));
  });
  // Le fond de l'écran verrouillé : le terrain, de loin.
  ff("-ss", "9.0", "-i", rush("but"), "-frames:v", "1", "-map_metadata", "-1",
    "-vf", "scale=540:-2", "-q:v", "4", path.resolve(ICI, "../source/images/fond-verrou.jpg"));
} else {
  console.log("pas de plans d'origine dans", RUSHES, ": on repart des morceaux du dépôt");
}

// 2. Les images. Un ralenti en demande plus par seconde de plan.
const infos = [];
for (const p of PLANS) {
  const vitesse = p.vitesse ?? 1;
  const ips = IPS / vitesse;
  const dossier = path.join(SORTIE, p.id);
  fs.rmSync(dossier, { recursive: true, force: true });
  fs.mkdirSync(dossier);
  ff("-i", path.join(SORTIE, `${p.id}.mp4`), "-vf", `fps=${ips}`, "-q:v", "3", path.join(dossier, "%04d.jpg"));
  const n = fs.readdirSync(dossier).length;
  infos.push({ id: p.id, t: p.t, duree: (p.a - p.de) / vitesse, ips, n });
  console.log("images", p.id, n);
}

// 3. Pour la page.
fs.writeFileSync(path.join(SORTIE, "plans.js"),
  "// Généré par outils/preparer-plans.mjs : les plans réels, tels que la page les affiche.\n"
  + `window.PLANS = ${JSON.stringify(infos, null, 2)};\n`);
console.log("plans.js :", infos.length, "morceaux");
