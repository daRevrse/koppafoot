// Écussons, bannière et portraits fictifs de la vidéo. Les portraits sont des
// illustrations, pas des photos : personne de réel n'y figure.
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

/** Un portrait illustré : un joueur en maillot, de face, sur un fond de couleur. */
const portrait = ({ fond, peau, cheveux, maillot, col, numero, barbe }) => `<svg width="600" height="600" viewBox="0 0 600 600">
  <defs><radialGradient id="f" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${fond[0]}"/><stop offset="1" stop-color="${fond[1]}"/></radialGradient></defs>
  <rect width="600" height="600" fill="url(#f)"/>
  <circle cx="300" cy="250" r="230" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="18"/>
  <path d="M70 600 C80 470 170 420 300 420 C430 420 520 470 530 600 Z" fill="${maillot}"/>
  <path d="M232 424 L300 486 L368 424 Z" fill="${col}"/>
  <path d="M252 424 L300 468 L348 424 Z" fill="${peau}"/>
  <rect x="262" y="330" width="76" height="104" rx="30" fill="${peau}"/>
  <path d="M262 380 Q300 404 338 380 L338 400 Q300 420 262 400 Z" fill="rgba(0,0,0,.12)"/>
  <ellipse cx="300" cy="252" rx="112" ry="132" fill="${peau}"/>
  <ellipse cx="190" cy="262" rx="20" ry="30" fill="${peau}"/><ellipse cx="410" cy="262" rx="20" ry="30" fill="${peau}"/>
  <path d="M188 238 C182 150 236 112 300 112 C366 112 420 150 412 238 C404 200 380 178 300 176 C222 178 196 200 188 238 Z" fill="${cheveux}"/>
  ${barbe ? `<path d="M196 280 C206 360 250 386 300 386 C350 386 394 360 404 280 C392 330 360 352 300 352 C240 352 208 330 196 280 Z" fill="${cheveux}" opacity=".9"/>` : ""}
  <ellipse cx="258" cy="258" rx="11" ry="13" fill="#1c1310"/><ellipse cx="342" cy="258" rx="11" ry="13" fill="#1c1310"/>
  <path d="M236 228 Q258 218 280 228" stroke="#1c1310" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M320 228 Q342 218 364 228" stroke="#1c1310" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M300 262 Q292 298 300 306 Q308 306 312 300" stroke="rgba(0,0,0,.25)" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M264 330 Q300 356 336 330" stroke="#5a2a22" stroke-width="9" fill="none" stroke-linecap="round"/>
  <text x="430" y="560" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="74" fill="${col}">${numero}</text>
</svg>`;
await render("portrait-ekoue", 600, 600, portrait({ fond: ["#fde68a", "#f59e0b"], peau: "#7a4a2e", cheveux: "#1b1210", maillot: "#047857", col: "#fbbf24", numero: "11" }));
await render("portrait-kafui", 600, 600, portrait({ fond: ["#bae6fd", "#0ea5e9"], peau: "#5c3420", cheveux: "#120c0a", maillot: "#047857", col: "#fbbf24", numero: "9", barbe: true }));
await b.close();
console.log("actifs →", OUT);
