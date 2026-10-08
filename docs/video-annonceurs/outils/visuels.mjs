// Les visuels des marques FICTIVES de la vidéo : quatre bannières 4:1
// (1200 × 300, le format que l'administration conseille, voir
// lib/partenaires) et l'affiche de la compétition.
//
//   node visuels.mjs   → ../source/images/bannieres/*.jpg
//
// Aucune vraie marque : les noms sont inventés, pour ne prêter à personne une
// campagne qu'il n'a pas achetée.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const DOSSIER = path.resolve(import.meta.dirname, "../source/images/bannieres");
// La page est écrite à côté des polices (../source), le temps du rendu :
// une page sans adresse ne charge pas de police locale.
const PAGE = path.resolve(import.meta.dirname, "../source/.visuel.html");
fs.mkdirSync(DOSSIER, { recursive: true });

const base = `
@font-face { font-family: "Outfit"; src: url(fonts/outfit.woff2) format("woff2"); font-weight: 100 900; }
@font-face { font-family: "DM Sans"; src: url(fonts/dmsans.woff2) format("woff2"); font-weight: 100 1000; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 1200px; height: 300px; overflow: hidden; font-family: "DM Sans"; }
.v { position: relative; width: 1200px; height: 300px; overflow: hidden; display: flex; align-items: center; }
.marque { font-family: "Outfit"; font-weight: 900; letter-spacing: -.02em; line-height: .9; text-transform: uppercase; }
.accroche { font-family: "Outfit"; font-weight: 700; }
.cta { font-family: "Outfit"; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; border-radius: 999px; }
`;

const VISUELS = {
  // La marque héroïne : un jus de fruits.
  "sika-jus": `
<div class="v" style="background: linear-gradient(115deg, #ff8a00 0%, #ffb100 55%, #ffd43b 100%); padding: 0 70px; gap: 46px;">
  <div style="position:absolute; right:-80px; top:-120px; width:520px; height:520px; border-radius:50%; background: radial-gradient(circle, #fff3 0 30%, transparent 31%), repeating-conic-gradient(#ff6a00 0 14deg, #ffa31a 14deg 30deg); opacity:.55;"></div>
  <div style="flex:none; width:190px; height:190px; border-radius:50%; background: radial-gradient(circle at 50% 50%, #fff7e0 0 18%, transparent 19%), repeating-conic-gradient(#ff7a00 0 16deg, #ffc247 16deg 30deg); box-shadow: 0 0 0 14px #fff, 0 18px 40px #b4530055;"></div>
  <div style="position:relative;">
    <div class="marque" style="font-size:120px; color:#3b1d00;">Sika Jus</div>
    <div class="accroche" style="margin-top:14px; font-size:40px; color:#4a2600; white-space:nowrap;">100 % fruits pressés, zéro sucre ajouté.</div>
  </div>
  </div>`,
  "novo-assurances": `
<div class="v" style="background: linear-gradient(120deg, #0b1f4d 0%, #123a8c 60%, #1d5fd1 100%); padding: 0 70px; gap: 40px;">
  <div style="position:absolute; inset:0; background: repeating-linear-gradient(115deg, #ffffff08 0 40px, transparent 40px 80px);"></div>
  <svg width="150" height="170" viewBox="0 0 24 28" style="position:relative; flex:none;"><path d="M12 1 L22 5 V13 C22 20 17.5 25 12 27 C6.5 25 2 20 2 13 V5 Z" fill="#38bdf8"/><path d="M7.5 14 l3 3 l6 -7" stroke="#0b1f4d" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <div style="position:relative;">
    <div class="marque" style="font-size:96px; color:#fff;">Novo <span style="color:#38bdf8">Assurances</span></div>
    <div class="accroche" style="margin-top:14px; font-size:40px; color:#cfe3ff;">Ton équipe assurée, tout le match.</div>
  </div>
</div>`,
  "pharmacie-lagune": `
<div class="v" style="background: #f0fdf4; padding: 0 70px; gap: 44px; border-bottom: 18px solid #16a34a;">
  <div style="flex:none; position:relative; width:170px; height:170px;">
    <div style="position:absolute; left:55px; top:0; width:60px; height:170px; background:#16a34a; border-radius:10px;"></div>
    <div style="position:absolute; left:0; top:55px; width:170px; height:60px; background:#16a34a; border-radius:10px;"></div>
  </div>
  <div>
    <div class="marque" style="font-size:78px; color:#14532d;">Pharmacie<br>de la Lagune</div>
  </div>
  <div style="margin-left:auto; text-align:right;">
    <div class="accroche" style="font-size:46px; color:#14532d; white-space:nowrap;">Ouverte 7 j / 7</div>
    <div style="margin-top:10px; font-size:30px; font-weight:700; color:#15803d; white-space:nowrap;">De garde le dimanche</div>
  </div>
</div>`,
  "mawuli-auto": `
<div class="v" style="background: linear-gradient(120deg, #111 0%, #1f1f1f 60%, #2a0a0a 100%); padding: 0 70px; gap: 44px;">
  <div style="position:absolute; right:0; top:0; bottom:0; width:380px; background:#dc2626; clip-path: polygon(22% 0, 100% 0, 100% 100%, 0 100%);"></div>
  <div style="flex:none; width:170px; height:170px; border-radius:50%; border:26px solid #e5e7eb; box-shadow: inset 0 0 0 14px #111, inset 0 0 0 30px #9ca3af;"></div>
  <div style="position:relative;">
    <div class="marque" style="font-size:110px; color:#fff;">Mawuli <span style="color:#ef4444">Auto</span></div>
    <div class="accroche" style="margin-top:12px; font-size:40px; color:#d1d5db;">Pneus · Vidange · Lavage</div>
  </div>
  <div class="cta" style="position:relative; margin-left:auto; padding:22px 30px; background:#fff; color:#111; font-size:30px;">Agoè</div>
</div>`,
};

// L'affiche de la compétition (16:9, bannière de la page).
const AFFICHE = `
<div class="v" style="width:1600px; height:900px; flex-direction:column; justify-content:center; align-items:center;
  background: radial-gradient(90% 90% at 50% 30%, #0f5132 0%, #06281a 55%, #020c07 100%);">
  <svg viewBox="0 0 1600 900" style="position:absolute; inset:0; opacity:.16"><g fill="none" stroke="#fff" stroke-width="5"><rect x="60" y="60" width="1480" height="780"/><line x1="800" y1="60" x2="800" y2="840"/><circle cx="800" cy="450" r="150"/><rect x="60" y="250" width="220" height="400"/><rect x="1320" y="250" width="220" height="400"/></g></svg>
  <div class="accroche" style="position:relative; font-size:54px; letter-spacing:.3em; color:#4ade80; text-transform:uppercase;">Lomé · 2026</div>
  <div class="marque" style="position:relative; margin-top:24px; font-size:190px; color:#fff; text-align:center;">Coupe des<br>Quartiers</div>
</div>`;

const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await navigateur.newPage({ viewport: { width: 1200, height: 300 }, deviceScaleFactor: 1 });
async function poser(html) {
  fs.writeFileSync(PAGE, `<!doctype html><meta charset="utf-8"><style>${base}</style>${html}`);
  await page.goto("file://" + PAGE, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
}
for (const [nom, html] of Object.entries(VISUELS)) {
  await poser(html);
  await page.screenshot({ path: path.join(DOSSIER, `${nom}.jpg`), type: "jpeg", quality: 88 });
  console.log("visuel", nom);
}
await page.setViewportSize({ width: 1600, height: 900 });
await poser(`<style>body { width:1600px; height:900px; }</style>${AFFICHE}`);
await page.screenshot({ path: path.join(DOSSIER, "affiche-coupe.jpg"), type: "jpeg", quality: 88 });
console.log("visuel affiche-coupe");
await navigateur.close();
fs.rmSync(PAGE);
