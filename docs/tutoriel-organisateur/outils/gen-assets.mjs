// Visuels fictifs de la compétition d'exemple : logo, bannière, écussons.
//   node gen-assets.mjs [dossier]   (par défaut ./actifs)
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2] ?? "actifs";
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await b.newPage();
async function render(name, w, h, html) {
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<html><body style="margin:0">${html}</body></html>`);
  await p.screenshot({ path: `${OUT}/${name}.png`, omitBackground: true });
}
// Logo compétition
await render("logo-coupe", 512, 512, `<div style="width:512px;height:512px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#10b981,#065f46);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:system-ui;box-sizing:border-box;border:18px solid #fbbf24">
 <div style="font-size:150px;line-height:1">🏆</div>
 <div style="font-weight:900;font-size:62px;letter-spacing:4px;margin-top:10px">CDQ</div>
 <div style="font-weight:700;font-size:40px;opacity:.9">2026</div></div>`);
// Bannière
await render("banniere-coupe", 1600, 600, `<div style="width:1600px;height:600px;background:linear-gradient(120deg,#064e3b 0%,#047857 55%,#f59e0b 140%);position:relative;overflow:hidden;font-family:system-ui;color:#fff">
 <div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 120px,rgba(255,255,255,0) 120px 240px)"></div>
 <div style="position:absolute;left:-150px;top:150px;width:600px;height:600px;border:10px solid rgba(255,255,255,.15);border-radius:50%"></div>
 <div style="position:absolute;left:110px;bottom:120px">
  <div style="font-size:34px;font-weight:700;letter-spacing:8px;opacity:.85">LOMÉ · DÉCEMBRE 2026</div>
  <div style="font-size:120px;font-weight:900;line-height:1;margin-top:14px">COUPE DES<br>QUARTIERS</div></div>
 <div style="position:absolute;right:120px;top:130px;font-size:300px">⚽</div></div>`);
// Écussons d'équipes
const teams = [
  ["as-be","ASB","#dc2626","#fff"],["fc-tokoin","FCT","#2563eb","#fff"],["etoile-adidogome","EDA","#f59e0b","#111"],
  ["racing-agoe","RAG","#16a34a","#fff"],["espoir-nyekonakpoe","ENY","#7c3aed","#fff"],["jeunesse-hedzranawoe","JHE","#0891b2","#fff"],
  ["union-kodjoviakope","UKO","#111827","#fbbf24"],["olympique-baguida","OBA","#ea580c","#fff"],
];
for (const [slug, abbr, bg, fg] of teams) {
  await render("equipe-" + slug, 256, 256, `<svg width="256" height="256" viewBox="0 0 256 256"><path d="M128 12 L228 44 V128 C228 190 180 228 128 246 C76 228 28 190 28 128 V44 Z" fill="${bg}" stroke="${fg}" stroke-width="10"/><path d="M128 40 L200 62 V92 H56 V62 Z" fill="${fg}" opacity=".18"/><text x="128" y="160" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="64" fill="${fg}">${abbr}</text></svg>`);
}
await b.close();
