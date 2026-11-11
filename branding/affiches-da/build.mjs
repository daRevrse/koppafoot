// Rend les trois affiches dans la DA des flyers Koppafoot (src/lib/og-da.tsx) :
// cadre d'éclats en trois verts, carte nuit, titres Anton fendus, Outfit en
// capitales, émeraude, à plat sans dégradé.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(require_resolve());
function require_resolve() { return process.env.PW; }
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const REPO = "/home/user/koppafoot";
const W = 1080, H = 1350, CADRE = 60;

// ─── Le cadre d'éclats, porté tel quel de motifEclats ───
function motifEclats(w, h, cadre) {
  let graine = 11;
  const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
  const couleurs = ["#10b981", "#10b981", "#34d399", "#047857", "#022c22"];
  const angles = [-60, -30, 30, 60, 120, 150];
  const formes = [];
  for (let y = -60; y < h + 60; y += 58) {
    for (let x = -60; x < w + 60; x += 58) {
      const dansLaBande = x < cadre + 40 || x > w - cadre - 40 || y < cadre + 40 || y > h - cadre - 40;
      if (!dansLaBande || hasard() < 0.25) continue;
      const long = 110 + hasard() * 120;
      const large = 34 + hasard() * 34;
      const angle = angles[Math.floor(hasard() * angles.length)];
      const couleur = couleurs[Math.floor(hasard() * couleurs.length)];
      const p = `0,0 ${long},${large / 2} 0,${large} ${long * 0.28},${large / 2}`;
      formes.push(`<polygon points="${p}" fill="${couleur}" transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${angle})"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#064e3b"/>${formes.join("")}</svg>`;
}

// ─── Icônes (trait façon Lucide) ───
const svg = (inner, size, color = "currentColor", sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const I = {
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  trophy: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`,
  star: `<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h5"/><path d="m18 13 1.55 3.13 3.45.5-2.5 2.44.59 3.43L18 20.88l-3.09 1.62.59-3.43-2.5-2.44 3.45-.5Z"/>`,
  ballon: `<circle cx="12" cy="12" r="10"/><path d="m12 7 4.2 3.05-1.6 4.95H9.4L7.8 10.05Z"/><path d="M12 7V2.3M16.2 10.05l4.5-1.45M14.6 15l2.8 3.9M9.4 15l-2.8 3.9M7.8 10.05 3.3 8.6"/>`,
  but: `<path d="M2 20V5h20v15"/><path d="M2 5l3 4h14l3-4"/><path d="M5 9v11M19 9v11"/><path d="M8.5 9v11M12 9v11M15.5 9v11M5 12.5h14M5 16h14"/><path d="M1 20h22"/>`,
  x: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  fleche: `<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>`,
  partage: `<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>`,
  retour: `<path d="m15 18-6-6 6-6"/>`,
};

// Réseaux : pleins, en blanc.
const tiktok = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="#fff"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`;
const youtube = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><rect x="1" y="4.5" width="22" height="15" rx="4.5" fill="#fff"/><path d="M10 8.6v6.8l5.8-3.4z" fill="#080d0b"/></svg>`;
const whatsapp = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><path d="M3.5 20.5l1.3-4.2A9 9 0 1 1 8 19.4z"/><path d="M9 7.6c-.5 0-1.1.6-1.1 1.6 0 2.6 3.6 6.4 6.6 6.6 1 .1 1.7-.6 1.7-1.2l-.1-.6-1.9-.9-1 1c-1.2-.5-2.6-1.9-3.1-3.1l.9-1-.8-2z" fill="#fff" stroke-width="1"/></svg>`;

const LOGO = `file://${REPO}/public/branding/logo_full_name.png`;

const tete = `
<meta charset="utf-8">
<style>
@font-face { font-family: Anton; src: url("file://${REPO}/assets/fonts/Anton-Regular.ttf"); }
@font-face { font-family: Outfit; font-weight: 500; src: url("file://${REPO}/assets/fonts/Outfit-Medium.ttf"); }
@font-face { font-family: Outfit; font-weight: 700; src: url("file://${REPO}/assets/fonts/Outfit-Bold.ttf"); }
@font-face { font-family: Outfit; font-weight: 900; src: url("file://${REPO}/assets/fonts/Outfit-Black.ttf"); }
:root { --nuit:#080d0b; --emeraude:#34d399; --vert:#10b981; --gris:#9ba6a1; --rouge:#f87171; --foret:#064e3b; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: var(--foret); }
body { position: relative; font-family: Outfit, sans-serif; color: #fff; -webkit-font-smoothing: antialiased; }
.eclats { position: absolute; inset: 0; }
.carte { position: absolute; inset: ${CADRE}px; background: var(--nuit); overflow: hidden; display: flex; flex-direction: column; }
.anton { font-family: Anton; line-height: 1; text-transform: uppercase; letter-spacing: 0; }
.espace { font-weight: 700; text-transform: uppercase; color: var(--gris); }
.fendu { position: relative; display: inline-block; white-space: nowrap; }
.fendu > span { display: block; }
.fendu > span + span { position: absolute; top: 5px; left: 6px; }
.pied { display: flex; align-items: center; gap: 18px; }
.pied .sep { width: 2px; height: 30px; background: rgba(255,255,255,.25); }
.url { font-weight: 700; font-size: 26px; letter-spacing: 3px; color: var(--emeraude); }
.logo { display: block; width: 236px; height: 118px; }
.tagline { font-size: 17px; letter-spacing: 7px; margin-top: 6px; }
</style>`;

// Le titre fendu en diagonale (TitreFendu) : deux copies, rognées de part et d'autre de la coupe.
const fendu = (texte, cls = "") => `<span class="fendu ${cls}"><span>${texte}</span><span aria-hidden="true">${texte}</span></span>`;
const scriptFendu = `
<script>
document.fonts.ready.then(() => {
  for (const el of document.querySelectorAll('.fendu')) {
    const [a, b] = el.children;
    const w = el.offsetWidth + 20, h = el.offsetHeight;
    const g = h * 0.84, d = h * 0.12, j = 3, m = 60;
    a.style.clipPath = 'polygon(-20px -' + m + 'px,' + w + 'px -' + m + 'px,' + w + 'px ' + (d - j) + 'px,-20px ' + (g - j) + 'px)';
    b.style.clipPath = 'polygon(-20px ' + (g + j) + 'px,' + w + 'px ' + (d + j) + 'px,' + w + 'px ' + (h + m) + 'px,-20px ' + (h + m) + 'px)';
  }
  document.body.dataset.pret = '1';
});
</script>`;

const pied = (extra = "") => `
<div class="pied">
  ${tiktok(30)}<div class="sep"></div>${youtube(34)}<div class="sep"></div>${whatsapp(32)}
  <div class="sep"></div><div class="url">www.koppafoot.com</div>${extra}
</div>`;

const page = (corps) => `<!doctype html><html><head>${tete}</head><body>
<img class="eclats" src="eclats.svg" width="${W}" height="${H}">
<div class="carte">${corps}</div>${scriptFendu}</body></html>`;

// ═══════════ 1 — « Votre équipe joue chaque week-end » ═══════════
const affiche1 = page(`
<style>
.c1 { align-items: center; padding: 44px 56px 0; text-align: center; }
.c1 h1 { margin-top: 26px; font-size: 100px; line-height: 1.02; }
.c1 .q1 { margin-top: 24px; font-weight: 900; font-size: 42px; letter-spacing: 2px; text-transform: uppercase; }
.c1 .q2 { margin-top: 6px; font-size: 116px; color: var(--emeraude); }
.c1 .q2 .fendu > span { color: var(--emeraude); }
.photo1 { position: absolute; left: 0; right: 0; bottom: 104px; height: 420px;
  clip-path: polygon(0 22%, 100% 4%, 100% 100%, 0 100%); }
.photo1 img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 62%; filter: grayscale(1) contrast(1.08) brightness(.82); }
.trait1 { position: absolute; left: 0; right: 0; bottom: 104px; height: 420px; pointer-events: none;
  clip-path: polygon(0 calc(22% - 8px), 100% calc(4% - 8px), 100% 4%, 0 22%); background: var(--emeraude); }
.bande1 { position: absolute; left: 0; right: 0; bottom: 0; height: 104px; background: var(--nuit); border-top: 8px solid var(--emeraude);
  display: flex; flex-direction: column; align-items: center; justify-content: center; }
.etiquette { position: absolute; left: 56px; bottom: 134px; background: var(--emeraude); color: var(--nuit);
  font-weight: 900; font-size: 28px; letter-spacing: 1px; text-transform: uppercase; line-height: 1.12; padding: 12px 18px; text-align: left; }
</style>
<div class="c1 carte" style="inset:0">
  <img class="logo" src="${LOGO}">
  <div class="espace tagline">Le football amateur en temps réel</div>
  <h1 class="anton">Votre équipe<br>joue chaque<br>week-end.</h1>
  <div class="q1">Mais que reste-t-il</div>
  <div class="q2 anton">${fendu("de vos matchs ?")}</div>
</div>
<div class="photo1"><img src="huddle.png"></div>
<div class="trait1"></div>
<div class="etiquette">Donnez une histoire<br>à votre équipe.</div>
<div class="bande1">${pied()}</div>
`);

// ═══════════ 2 — « Où sont-ils conservés ? » ═══════════
const tuile = (icone, label) => `
<div class="tuile">
  <div class="ico">${svg(I[icone], 92, "#34d399", 1.6)}<div class="croix">${svg(I.x, 30, "#080d0b", 3.2)}</div></div>
  <div class="lab">${label}</div>
</div>`;
const affiche2 = page(`
<style>
.c2 { padding: 44px 56px 0; }
.photo2 { position: absolute; top: 0; right: 0; width: 430px; height: 760px;
  clip-path: polygon(42% 0, 100% 0, 100% 100%, 0 100%); }
.photo2 img { width: 100%; height: 100%; object-fit: cover; object-position: 40% 0; filter: grayscale(1) contrast(1.08) brightness(.8); }
.trait2 { position: absolute; top: 0; right: 0; width: 430px; height: 760px;
  clip-path: polygon(42% 0, calc(42% + 9px) 0, 9px 100%, 0 100%); background: var(--emeraude); }
.c2 .tete2 { position: relative; z-index: 1; }
.c2 .tagline { letter-spacing: 4px; font-size: 16px; }
.c2 h1 { margin-top: 40px; font-size: 94px; line-height: 1.04; }
.boite { display: inline-block; margin-top: 28px; background: var(--emeraude); padding: 14px 26px 18px; }
.boite .anton { color: var(--nuit); font-size: 80px; line-height: 1.02; }
.tuiles { position: absolute; left: 56px; right: 56px; top: 800px; display: flex; gap: 22px; }
.tuile { position: relative; flex: 1; border: 1px solid rgba(255,255,255,.12); background: #0e1613; padding: 34px 0 26px; display: flex; flex-direction: column; align-items: center; }
.ico { position: static; }
.croix { position: absolute; right: -1px; top: -1px; width: 46px; height: 46px; background: var(--rouge); display: flex; align-items: center; justify-content: center; }
.lab { margin-top: 26px; font-weight: 900; font-size: 26px; letter-spacing: 3px; text-transform: uppercase; }
.citation { position: absolute; left: 56px; right: 150px; top: 1020px; border-left: 8px solid var(--emeraude); padding-left: 26px;
  font-weight: 500; font-size: 33px; line-height: 1.28; color: var(--gris); }
.citation b { font-weight: 900; color: #fff; }
.bas2 { position: absolute; left: 56px; right: 56px; bottom: 40px; display: flex; align-items: center; justify-content: space-between; }
.suivant { width: 84px; height: 84px; background: var(--emeraude); display: flex; align-items: center; justify-content: center; }
</style>
<div class="photo2"><img src="pensif.png"></div>
<div class="trait2"></div>
<div class="c2 carte" style="inset:0;background:transparent">
  <div class="tete2">
    <img class="logo" src="${LOGO}">
    <div class="espace tagline">Le football amateur en temps réel</div>
    <h1 class="anton">Vos victoires,<br>vos défaites,<br>vos buts…</h1>
    <div class="boite"><div class="anton">Où sont-ils<br>conservés ?</div></div>
  </div>
</div>
<div class="tuiles">${tuile("trophy", "Vos victoires")}${tuile("ballon", "Vos buts")}${tuile("but", "Vos matchs")}</div>
<div class="citation">Trop souvent, les résultats restent dans les conversations ou <b>disparaissent avec le temps.</b></div>
<div class="bas2">${pied()}<div class="suivant">${svg(I.fleche, 44, "#080d0b", 2.6)}</div></div>
`);

// ═══════════ 3 — « Et si votre équipe avait son propre espace ? » ═══════════
const atout = (icone, texte) => `<div class="atout"><div class="pastille">${svg(I[icone], 34, "#080d0b", 2.2)}</div><div>${texte}</div></div>`;
const affiche3 = page(`
<style>
.c3 { padding: 44px 56px 0; }
.c3 .tagline { letter-spacing: 4px; font-size: 16px; }
.c3 h1 { margin-top: 28px; font-size: 80px; line-height: 1.03; width: 470px; }
.c3 .kf { margin-top: 4px; font-size: 90px; white-space: nowrap; }
.c3 .kf .fendu > span { color: var(--emeraude); }
.c3 .kf .pt { color: #fff; }
.c3 .intro { margin-top: 20px; width: 440px; font-weight: 500; font-size: 25px; line-height: 1.32; color: var(--gris); }
.atouts { margin-top: 26px; display: flex; flex-direction: column; gap: 14px; }
.atout { display: flex; align-items: center; gap: 18px; font-weight: 700; font-size: 26px; }
.pastille { width: 52px; height: 52px; background: var(--emeraude); display: flex; align-items: center; justify-content: center; flex: none; }
.cta { position: absolute; left: 56px; right: 56px; bottom: 100px; background: var(--emeraude); color: var(--nuit); padding: 14px 26px 16px;
  display: flex; align-items: baseline; justify-content: center; gap: 22px; }
.cta .l1 { font-weight: 900; font-size: 26px; letter-spacing: 1px; text-transform: uppercase; }
.cta .l2 { font-size: 66px; }
.bas3 { position: absolute; left: 56px; bottom: 36px; }

/* Le téléphone : l'écran est la vraie fiche équipe (bandeau noir, capitales serrées, angles droits) */
.tel { position: absolute; right: 50px; top: 230px; width: 368px; height: 760px; background: #000; border-radius: 54px;
  padding: 14px; box-shadow: 0 0 0 3px #1d2724; }
.ecran { position: relative; width: 100%; height: 100%; border-radius: 42px; overflow: hidden; background: #f9fafb; color: #111827; font-family: Outfit; }
.encoche { position: absolute; top: 10px; left: 50%; width: 110px; height: 30px; margin-left: -55px; background: #000; border-radius: 20px; z-index: 5; }
.statut { position: absolute; top: 14px; left: 30px; right: 26px; display: flex; justify-content: space-between; font-weight: 700; font-size: 14px; color: #fff; z-index: 4; }
.bandeau { position: relative; background: #000; color: #fff; padding: 56px 18px 18px; overflow: hidden; }
.bandeau .fond { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .38; filter: grayscale(1); }
.bandeau > *:not(.fond) { position: relative; }
.btns { display: flex; justify-content: space-between; }
.btn { height: 30px; min-width: 30px; border: 1px solid rgba(255,255,255,.25); display: flex; align-items: center; justify-content: center; gap: 5px; padding: 0 8px; font-weight: 900; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; }
.id { margin-top: 22px; display: flex; align-items: center; gap: 14px; }
.ecu { width: 64px; height: 64px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.1); display: flex; align-items: center; justify-content: center; flex: none; }
.sur { font-weight: 900; font-size: 9.5px; letter-spacing: 1.6px; text-transform: uppercase; color: #6ee7b7; }
.nom { margin-top: 3px; font-weight: 900; font-size: 25px; line-height: 1.05; text-transform: uppercase; letter-spacing: -.3px; }
.devise { margin-top: 4px; font-weight: 500; font-style: italic; font-size: 12.5px; color: rgba(255,255,255,.7); }
.puces { margin-top: 16px; display: flex; gap: 14px; align-items: center; font-weight: 900; font-size: 9.5px; letter-spacing: 1.4px; text-transform: uppercase; color: rgba(255,255,255,.6); }
.forme { display: flex; gap: 3px; }
.forme i { font-style: normal; width: 15px; height: 15px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #fff; }
.corps { padding: 14px 14px 0; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: rgba(229,231,235,.7); border: 1px solid rgba(229,231,235,.7); }
.stats div { background: #fff; padding: 10px 4px; text-align: center; }
.stats small { display: block; font-weight: 900; font-size: 8.5px; letter-spacing: 1.4px; text-transform: uppercase; color: #9ca3af; }
.stats b { display: block; margin-top: 2px; font-weight: 900; font-size: 27px; }
.onglets { margin-top: 14px; display: flex; gap: 20px; border-bottom: 1px solid rgba(229,231,235,.7); }
.onglets span { padding: 4px 0 10px; font-weight: 900; font-size: 10.5px; letter-spacing: 1.3px; text-transform: uppercase; color: #9ca3af; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.onglets .on { color: #111827; border-color: #111827; }
.titre-c { margin-top: 14px; font-weight: 900; font-size: 9.5px; letter-spacing: 1.6px; text-transform: uppercase; color: #6b7280; }
.res { margin-top: 8px; background: #fff; border: 1px solid rgba(229,231,235,.7); padding: 12px; display: flex; align-items: center; justify-content: space-between; }
.eq { width: 92px; display: flex; flex-direction: column; align-items: center; gap: 6px; font-weight: 900; font-size: 9.5px; letter-spacing: .6px; text-transform: uppercase; text-align: center; }
.mini { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; }
.score { font-weight: 900; font-size: 26px; letter-spacing: 1px; }
.score small { display: block; text-align: center; font-size: 8.5px; letter-spacing: 1.4px; color: #059669; }
</style>
<div class="c3 carte" style="inset:0;background:transparent">
  <img class="logo" src="${LOGO}">
  <div class="espace tagline">Le football amateur en temps réel</div>
  <h1 class="anton">Et si votre équipe avait son propre espace sur</h1>
  <div class="kf anton">${fendu("KoppaFoot")}<span class="pt"> ?</span></div>
  <div class="intro">Un espace pour présenter votre équipe et retrouver tout son parcours.</div>
  <div class="atouts">
    ${atout("users", "Présentez votre équipe")}
    ${atout("trophy", "Suivez vos résultats")}
    ${atout("star", "Valorisez vos joueurs")}
  </div>
</div>
<div class="tel"><div class="ecran">
  <div class="encoche"></div>
  <div class="statut"><span>9:41</span><span>●●● ▮</span></div>
  <div class="bandeau">
    <img class="fond" src="huddle.png">
    <div class="btns"><div class="btn">${svg(I.retour, 15, "#fff", 2.4)}</div><div style="display:flex;gap:6px"><div class="btn">${svg(I.partage, 13, "#fff", 2.2)}</div><div class="btn">Suivre</div></div></div>
    <div class="id">
      <div class="ecu">${svg(I.ballon, 38, "#34d399", 1.8)}</div>
      <div>
        <div class="sur">Lomé · Amateur</div>
        <div class="nom">FC Excellence</div>
        <div class="devise">Ensemble plus forts !</div>
      </div>
    </div>
    <div class="puces">
      <span class="forme"><i style="background:#059669">V</i><i style="background:#059669">V</i><i style="background:#6b7280">N</i><i style="background:#059669">V</i><i style="background:#dc2626">D</i></span>
      <span>18 joueurs</span><span style="color:#6ee7b7">Recrute</span>
    </div>
  </div>
  <div class="corps">
    <div class="stats"><div><small>Matchs</small><b>12</b></div><div><small>Victoires</small><b style="color:#059669">7</b></div><div><small>Défaites</small><b>1</b></div></div>
    <div class="onglets"><span class="on">Effectif 18</span><span>Matchs 12</span><span>Palmarès 2</span></div>
    <div class="titre-c">Derniers résultats</div>
    <div class="res">
      <div class="eq"><div class="mini" style="background:#111827">${svg(I.ballon, 22, "#34d399", 2)}</div>FC Excellence</div>
      <div class="score">2 - 0<small>Terminé</small></div>
      <div class="eq"><div class="mini" style="background:#e5e7eb;color:#374151">A</div>AS Lomé</div>
    </div>
    <div class="res">
      <div class="eq"><div class="mini" style="background:#e5e7eb;color:#374151">U</div>US Bè</div>
      <div class="score">1 - 3<small>Terminé</small></div>
      <div class="eq"><div class="mini" style="background:#111827">${svg(I.ballon, 22, "#34d399", 2)}</div>FC Excellence</div>
    </div>
    <div class="titre-c">Meilleur buteur</div>
    <div class="res" style="justify-content:flex-start;gap:12px">
      <div class="mini" style="background:#ecfdf5;color:#047857">10</div>
      <div style="flex:1"><div style="font-weight:900;font-size:13px;text-transform:uppercase">K. Mensah</div><div style="font-weight:500;font-size:11px;color:#6b7280">Attaquant</div></div>
      <div style="font-weight:900;font-size:22px">9 <span style="font-size:9px;letter-spacing:1.4px;color:#9ca3af">BUTS</span></div>
    </div>
  </div>
</div></div>
<div class="cta"><div class="l1">Votre équipe a sa place sur</div><div class="l2 anton">Koppafoot.</div></div>
<div class="bas3">${pied()}</div>
`);

writeFileSync(join(ICI, "eclats.svg"), motifEclats(W, H, CADRE));
const affiches = { "koppafoot-affiche-1": affiche1, "koppafoot-affiche-2": affiche2, "koppafoot-affiche-3": affiche3 };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF || 1) });
for (const [nom, html] of Object.entries(affiches)) {
  const f = join(ICI, `${nom}.html`);
  writeFileSync(f, html);
  await p.goto(`file://${f}`);
  await p.waitForSelector("body[data-pret]");
  await p.screenshot({ path: join(ICI, `${nom}.png`) });
}
await b.close();
console.log("ok");
