// Les écrans du NAVIGATEUR, dessinés en schéma.
//
// La fenêtre « Installer l'application » de Chrome, le menu Partager de
// Safari, la demande d'autorisation des notifications : rien de cela n'est
// une page web, un navigateur piloté ne peut pas les photographier. On les
// dessine donc, simplement, avec la vraie icône de KoppaFoot, et chaque
// schéma porte la mention « SCHÉMA » pour ne pas passer pour une capture.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT = process.env.OUT_DIR ?? path.resolve("captures-brutes");
const RACINE = new URL("../../../", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const b64 = (f) => fs.readFileSync(path.join(RACINE, f)).toString("base64");
const ICONE = `data:image/png;base64,${b64("public/icons/icon-192.png")}`;
const SPLASH = `data:image/jpeg;base64,${b64("public/splash/splash-1170x2532.jpg")}`;

const ORANGE = "#FF5A1F";
const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, "DejaVu Sans", sans-serif; }
  .ecran { position: relative; overflow: hidden; background: #f3f4f6; }
  .tag { position: absolute; top: 10px; right: 10px; z-index: 50; background: #111827; color: #fff;
         font: 800 10px/1 system-ui; letter-spacing: .14em; padding: 5px 7px; border-radius: 4px; opacity: .85; }
  .statut { height: 30px; display: flex; align-items: center; justify-content: space-between; padding: 0 18px;
            font: 600 12px system-ui; color: #111; }
  .repere { outline: 3px solid ${ORANGE}; outline-offset: 3px; border-radius: 8px; box-shadow: 0 0 0 7px rgba(255,90,31,.22); position: relative; }
  .pastille { position: absolute; width: 26px; height: 26px; border-radius: 50%; background: ${ORANGE}; color: #fff;
              font: 800 14px/26px system-ui; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,.25); z-index: 40; }
  .voile { position: absolute; inset: 0; background: rgba(0,0,0,.45); }
  .page-floue { position: absolute; inset: 30px 0 0; padding: 18px; filter: blur(1.5px); opacity: .9; }
  .bloc { background: #fff; border-radius: 6px; height: 64px; margin-bottom: 12px; }
  .bande { background: linear-gradient(120deg,#064e3b,#059669); height: 120px; border-radius: 6px; margin-bottom: 12px; }
  .icone-app { width: 56px; height: 56px; border-radius: 14px; background: #d1d5db; }
`;

/** Le fond commun : une page KoppaFoot vue de loin. */
const pageFloue = `<div class="page-floue"><div class="bande"></div><div class="bloc"></div><div class="bloc"></div><div class="bloc"></div><div class="bloc" style="height:120px"></div></div>`;

const SCHEMAS = {
  // ---------------------------------------------------------------- Android
  "02-android-fenetre-chrome": [390, 844, `
    <div class="statut"><span>9:41</span></div>
    ${pageFloue}<div class="voile"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:22px 22px 0 0;padding:26px 24px 30px">
      <div style="width:40px;height:4px;border-radius:2px;background:#d1d5db;margin:0 auto 20px"></div>
      <div style="font:600 19px system-ui;color:#111;margin-bottom:18px">Installer l'application&nbsp;?</div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:26px">
        <img src="${ICONE}" style="width:52px;height:52px;border-radius:12px">
        <div><div style="font:700 16px system-ui">KoppaFoot</div><div style="font:13px system-ui;color:#6b7280">koppafoot.com</div></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:12px">
        <span style="padding:11px 18px;font:600 15px system-ui;color:#1a56db">Annuler</span>
        <span class="repere" data-n="1" data-cote="top" style="padding:11px 22px;font:600 15px system-ui;color:#fff;background:#1a56db;border-radius:22px">Installer</span>
      </div>
    </div>`],

  "03-android-ecran-accueil": [390, 844, `
    <div style="position:absolute;inset:0;background:linear-gradient(160deg,#1e3a8a,#0f766e 60%,#064e3b)"></div>
    <div class="statut" style="position:relative;color:#fff"><span>9:41</span></div>
    <div style="position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:26px 0;padding:40px 14px;justify-items:center">
      ${Array.from({ length: 10 }, () => `<div><div class="icone-app" style="background:rgba(255,255,255,.28)"></div><div style="height:8px;width:44px;margin:8px auto 0;border-radius:4px;background:rgba(255,255,255,.25)"></div></div>`).join("")}
      <div style="text-align:center"><img class="repere" data-n="1" data-cote="right" src="${ICONE}" style="width:56px;height:56px;border-radius:14px"><div style="font:600 12px system-ui;color:#fff;margin-top:6px">KoppaFoot</div></div>
    </div>`],

  "05-android-menu-chrome": [390, 844, `
    <div class="statut"><span>9:41</span></div>
    <div style="position:absolute;top:30px;left:0;right:0;height:56px;background:#fff;display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:1px solid #e5e7eb">
      <span style="font:16px system-ui;color:#6b7280">⌂</span>
      <div style="flex:1;height:38px;border-radius:19px;background:#f1f3f4;display:flex;align-items:center;padding:0 14px;font:14px system-ui;color:#374151">🔒 koppafoot.com</div>
      <span class="repere" data-n="1" data-cote="left" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;font:900 20px system-ui;color:#374151">⋮</span>
    </div>
    <div style="position:absolute;inset:86px 0 0">${pageFloue.replace("inset: 30px 0 0", "inset:0")}</div>
    <div style="position:absolute;top:92px;right:8px;width:250px;background:#fff;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.25);padding:6px 0;font:15px system-ui;color:#111">
      ${["Nouvel onglet", "Nouvel onglet navigation privée", "Historique", "Téléchargements", "Favoris", "Partager…", "Rechercher dans la page"].map((l) => `<div style="padding:12px 18px">${l}</div>`).join("")}
      <div class="repere" data-n="2" data-cote="left" style="padding:12px 18px;margin:0 6px;font-weight:600">Ajouter à l'écran d'accueil</div>
      <div style="padding:12px 18px">Paramètres</div>
    </div>`],

  // ---------------------------------------------------------------- iPhone
  "07-iphone-partager": [390, 844, `
    <div class="statut"><span>9:41</span></div>
    ${pageFloue}
    <div style="position:absolute;left:0;right:0;bottom:0;background:rgba(249,250,251,.97);border-top:1px solid #e5e7eb;padding:10px 14px 30px">
      <div style="height:40px;border-radius:12px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font:15px system-ui;color:#111;margin-bottom:12px">koppafoot.com</div>
      <div style="display:flex;justify-content:space-around;align-items:center;font:22px system-ui;color:#1d4ed8">
        <span>‹</span><span style="color:#9ca3af">›</span>
        <span class="repere" data-n="1" data-cote="right" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center">
          <svg width="22" height="26" viewBox="0 0 22 26" fill="none" stroke="#1d4ed8" stroke-width="2"><path d="M11 17V2M6 7l5-5 5 5"/><path d="M7 11H3v13h16V11h-4"/></svg>
        </span>
        <span>▢</span><span>⧉</span>
      </div>
    </div>`],

  "08-iphone-sur-ecran-accueil": [390, 844, `
    <div class="statut"><span>9:41</span></div>
    ${pageFloue}<div class="voile"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;top:170px;background:#f2f2f7;border-radius:14px 14px 0 0;padding:16px">
      <div style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:12px;padding:12px;margin-bottom:14px">
        <img src="${ICONE}" style="width:44px;height:44px;border-radius:10px">
        <div><div style="font:600 15px system-ui">KoppaFoot</div><div style="font:13px system-ui;color:#6b7280">koppafoot.com</div></div>
      </div>
      <div style="display:flex;gap:18px;padding:4px 6px 16px">${Array.from({ length: 5 }, () => `<div class="icone-app" style="width:52px;height:52px;background:#d1d5db"></div>`).join("")}</div>
      <div style="background:#fff;border-radius:12px;font:16px system-ui;color:#111">
        ${["Copier", "Ajouter à la liste de lecture", "Ajouter un signet", "Ajouter aux favoris"].map((l) => `<div style="padding:13px 16px;border-bottom:1px solid #e5e7eb">${l}</div>`).join("")}
        <div class="repere" data-n="1" data-cote="coin" style="padding:13px 16px;font-weight:600;display:flex;justify-content:space-between"><span>Sur l'écran d'accueil</span><span>⊞</span></div>
        <div style="padding:13px 16px;border-top:1px solid #e5e7eb">Rechercher dans la page</div>
      </div>
    </div>`],

  "09-iphone-ajouter": [390, 844, `
    <div class="statut"><span>9:41</span></div>
    <div style="position:absolute;inset:30px 0 0;background:#f2f2f7">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;font:16px system-ui">
        <span style="color:#1d4ed8">Annuler</span>
        <span style="font:600 15px system-ui;text-align:center;flex:1;padding:0 8px">Ajouter à l'écran d'accueil</span>
        <span class="repere" data-n="1" data-cote="bottom" style="color:#1d4ed8;font-weight:600;padding:2px 6px">Ajouter</span>
      </div>
      <div style="margin:16px;background:#fff;border-radius:12px;padding:16px;display:flex;gap:14px;align-items:flex-start">
        <img src="${ICONE}" style="width:62px;height:62px;border-radius:14px">
        <div style="flex:1">
          <div style="font:17px system-ui;border-bottom:1px solid #e5e7eb;padding:6px 0 10px">KoppaFoot</div>
          <div style="font:14px system-ui;color:#6b7280;padding-top:8px">https://koppafoot.com/</div>
        </div>
      </div>
      <div style="margin:0 16px;background:#fff;border-radius:12px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;font:16px system-ui">
        <span>Ouvrir comme app web</span>
        <span style="width:50px;height:30px;border-radius:15px;background:#34c759;position:relative"><span style="position:absolute;right:2px;top:2px;width:26px;height:26px;border-radius:50%;background:#fff"></span></span>
      </div>
      <div style="margin:10px 28px;font:13px system-ui;color:#6b7280">Une icône sera ajoutée à votre écran d'accueil pour accéder rapidement à ce site web.</div>
    </div>`],

  "10-iphone-ecran-accueil": [390, 844, `
    <div style="position:absolute;inset:0;background:linear-gradient(170deg,#312e81,#1e3a8a 50%,#0f172a)"></div>
    <div class="statut" style="position:relative;color:#fff"><span>9:41</span></div>
    <div style="position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:26px 0;padding:36px 14px;justify-items:center">
      ${Array.from({ length: 13 }, () => `<div><div class="icone-app" style="background:rgba(255,255,255,.22)"></div><div style="height:8px;width:44px;margin:8px auto 0;border-radius:4px;background:rgba(255,255,255,.2)"></div></div>`).join("")}
      <div style="text-align:center"><img class="repere" data-n="1" data-cote="right" src="${ICONE}" style="width:56px;height:56px;border-radius:14px"><div style="font:500 12px system-ui;color:#fff;margin-top:6px">KoppaFoot</div></div>
    </div>`],

  "10b-iphone-ouverture": [390, 844, `<img src="${SPLASH}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`],

  // ---------------------------------------------------------------- Ordinateur
  "13-ordinateur-barre-adresse": [1100, 420, `
    <div style="position:absolute;inset:0;background:#dee1e6"></div>
    <div style="position:absolute;top:8px;left:80px;width:230px;height:34px;background:#fff;border-radius:10px 10px 0 0;display:flex;align-items:center;gap:8px;padding:0 12px;font:13px system-ui">
      <img src="${ICONE}" style="width:16px;height:16px;border-radius:3px">KoppaFoot</div>
    <div style="position:absolute;top:42px;left:0;right:0;height:50px;background:#fff;display:flex;align-items:center;gap:14px;padding:0 16px;font:18px system-ui;color:#5f6368">
      <span>←</span><span>→</span><span>↻</span>
      <div style="flex:1;height:36px;border-radius:18px;background:#f1f3f4;display:flex;align-items:center;padding:0 16px;font:15px system-ui;color:#202124;gap:10px">
        <span>🔒</span><span style="flex:1">koppafoot.com</span>
        <span class="repere" data-n="1" data-cote="left" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" stroke-width="2"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4M12 7v6M9 10l3 3 3-3"/></svg>
        </span>
        <span>☆</span>
      </div>
      <span>⋮</span>
    </div>
    <div style="position:absolute;top:92px;left:0;right:0;bottom:0;background:#f4f6fa;padding:24px 40px">
      <div style="height:26px;width:180px;background:#111827;border-radius:3px;margin-bottom:22px"></div>
      <div style="height:80px;background:#fff;border-radius:6px;margin-bottom:12px"></div><div style="height:80px;background:#fff;border-radius:6px"></div>
    </div>
    <div style="position:absolute;top:100px;right:90px;width:340px;background:#fff;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.2);padding:20px">
      <div style="font:600 17px system-ui;margin-bottom:14px">Installer l'application&nbsp;?</div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        <img src="${ICONE}" style="width:40px;height:40px;border-radius:9px">
        <div><div style="font:600 14px system-ui">KoppaFoot</div><div style="font:12px system-ui;color:#6b7280">koppafoot.com</div></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;font:600 14px system-ui">
        <span class="repere" data-n="2" data-cote="bottom" style="padding:8px 18px;background:#1a73e8;color:#fff;border-radius:18px">Installer</span>
        <span style="padding:8px 14px;color:#1a73e8;border:1px solid #dadce0;border-radius:18px">Annuler</span>
      </div>
    </div>`],

  // ---------------------------------------------------------------- Notifications
  "16-notifs-autoriser": [390, 844, `
    <div class="statut"><span>9:41</span></div>
    ${pageFloue}<div class="voile"></div>
    <div style="position:absolute;left:12px;right:12px;bottom:24px;background:#fff;border-radius:22px;padding:22px 22px 18px">
      <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:18px">
        <span style="font:22px system-ui">🔔</span>
        <div style="font:16px system-ui;color:#111;line-height:1.4">Autoriser <b>koppafoot.com</b> à vous envoyer des notifications&nbsp;?</div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;font:600 15px system-ui">
        <span style="padding:10px 16px;color:#1a56db">Ne pas autoriser</span>
        <span class="repere" data-n="1" data-cote="coin" style="padding:10px 20px;color:#fff;background:#1a56db;border-radius:20px">Autoriser</span>
      </div>
    </div>`],
};

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await b.newPage({ deviceScaleFactor: 3 });
for (const [nom, [w, h, html]] of Object.entries(SCHEMAS)) {
  await page.setViewportSize({ width: w, height: h });
  const tag = nom.startsWith("10b") ? "" : `<span class="tag">SCHÉMA</span>`;
  await page.setContent(`<html><head><style>${CSS}</style></head><body><div class="ecran" style="width:${w}px;height:${h}px">${tag}${html}</div></body></html>`);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("[data-n]")) {
      const r = el.getBoundingClientRect(), d = 26, e = 10;
      const pos = {
        left: [r.left - d - e, r.top + r.height / 2 - d / 2],
        right: [r.right + e, r.top + r.height / 2 - d / 2],
        top: [r.left + r.width / 2 - d / 2, r.top - d - e],
        bottom: [r.left + r.width / 2 - d / 2, r.bottom + e],
        coin: [r.left - d / 2, r.top - d / 2],
      }[el.dataset.cote ?? "left"];
      const b = document.createElement("span");
      b.className = "pastille";
      b.textContent = el.dataset.n;
      b.style.left = pos[0] + "px";
      b.style.top = pos[1] + "px";
      document.querySelector(".ecran").appendChild(b);
    }
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, nom + ".jpg"), type: "jpeg", quality: 88 });
  console.log("✏️ ", nom);
}
await b.close();
