// Rend la vidéo : source/animation.html → ../Tribune-KoppaFoot.mp4
//
//   node rendu.mjs                  la vidéo entière (1080 × 1920, 30 i/s, H.264)
//   node rendu.mjs --apercu 5,9.5   quelques images, en JPEG, pour relire
//
// La page expose `allerA(t)` : on l'avance image par image, on capture, et
// ffmpeg assemble. Pas d'horloge réelle, donc pas d'image sautée : le rendu
// est le même d'une machine à l'autre, quelle que soit sa vitesse.
//
// ffmpeg : celui de la variable FFMPEG, sinon celui d'imageio-ffmpeg
// (pip install imageio-ffmpeg), sinon celui du système.
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const IPS = 30;
const SOURCE = path.resolve(import.meta.dirname, "../source/animation.html");
const SORTIE = process.env.SORTIE ?? path.resolve(import.meta.dirname, "../Tribune-KoppaFoot.mp4");
const APERCU = path.resolve(import.meta.dirname, "apercu");

function ffmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return execFileSync("python3", ["-c", "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())"]).toString().trim();
  } catch {
    return "ffmpeg";
  }
}

const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await navigateur.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") console.log("page:", m.text()); });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto("file://" + SOURCE, { waitUntil: "load" });
await page.evaluate(() => window.pret);
const duree = await page.evaluate(() => window.DUREE);

const i = process.argv.indexOf("--apercu");
if (i > 0) {
  fs.mkdirSync(APERCU, { recursive: true });
  for (const t of process.argv[i + 1].split(",").map(Number)) {
    await page.evaluate((t) => window.allerA(t), t);
    const f = path.join(APERCU, `t${String(t).padStart(5, "0")}.jpg`);
    await page.screenshot({ path: f, type: "jpeg", quality: 85 });
    console.log("aperçu", f);
  }
  await navigateur.close();
  process.exit(0);
}

const images = Math.round(duree * IPS);
const enc = spawn(ffmpeg(), [
  "-y", "-hide_banner", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(IPS), "-c:v", "mjpeg", "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", SORTIE,
], { stdio: ["pipe", "inherit", "inherit"] });
const fini = new Promise((ok, ko) => enc.on("close", (code) => (code === 0 ? ok() : ko(new Error("ffmpeg : code " + code)))));

const debut = Date.now();
for (let n = 0; n < images; n++) {
  await page.evaluate((t) => window.allerA(t), n / IPS);
  const jpeg = await page.screenshot({ type: "jpeg", quality: 94 });
  if (!enc.stdin.write(jpeg)) await new Promise((r) => enc.stdin.once("drain", r));
  if (n % 150 === 0) console.log(`image ${n}/${images} (${Math.round((Date.now() - debut) / 1000)} s)`);
}
enc.stdin.end();
await fini;
await navigateur.close();
console.log("vidéo :", SORTIE, `(${(fs.statSync(SORTIE).size / 1e6).toFixed(1)} Mo, ${Math.round((Date.now() - debut) / 1000)} s de rendu)`);
