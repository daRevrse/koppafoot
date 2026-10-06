// Écussons et bannière fictifs des clubs du tutoriel.
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
const ecusson = (bg, fg, abbr, bande) => `<svg width="256" height="256" viewBox="0 0 256 256">
  <path d="M128 12 L228 44 V128 C228 190 180 228 128 246 C76 228 28 190 28 128 V44 Z" fill="${bg}" stroke="${fg}" stroke-width="10"/>
  <path d="M60 58 L196 58 L196 84 L60 84 Z" fill="${bande}"/>
  <text x="128" y="168" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="66" fill="${fg}">${abbr}</text>
  <text x="128" y="206" text-anchor="middle" font-family="system-ui" font-weight="700" font-size="20" letter-spacing="4" fill="${fg}" opacity=".85">LOMÉ</text></svg>`;
await render("ecusson-avenir", 256, 256, ecusson("#047857", "#ffffff", "AVA", "#fbbf24"));
await render("ecusson-tokoin", 256, 256, ecusson("#1d4ed8", "#ffffff", "OLT", "#ef4444"));
await render("banniere-avenir", 1600, 500, `<div style="width:1600px;height:500px;background:linear-gradient(115deg,#064e3b 0%,#059669 60%,#fbbf24 150%);position:relative;overflow:hidden;font-family:system-ui;color:#fff">
 <div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 110px,rgba(255,255,255,0) 110px 220px)"></div>
 <div style="position:absolute;right:-120px;top:-160px;width:620px;height:620px;border:12px solid rgba(255,255,255,.14);border-radius:50%"></div>
 <div style="position:absolute;right:140px;top:90px;font-size:260px;opacity:.9">⚽</div></div>`);
await b.close();
console.log("actifs →", OUT);
