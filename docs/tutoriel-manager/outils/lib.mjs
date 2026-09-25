// Outils communs aux scripts de capture du tutoriel manager.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

export const BASE = process.env.BASE_URL ?? "http://localhost:3000";
export const OUT = process.env.OUT_DIR ?? path.resolve("captures-brutes");
const PROFILES = process.env.PROFILES_DIR ?? path.resolve("profiles");

export const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 };
export const PHONE_LAND = {
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};
export const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

/** Contexte persistant : la session Firebase survit d'un script à l'autre. */
export async function open(profile, device = DESKTOP) {
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await chromium.launchPersistentContext(path.join(PROFILES, profile), {
    executablePath: process.env.CHROMIUM_PATH || undefined,
    locale: "fr-FR",
    args: ["--lang=fr-FR"],
    env: { ...process.env, LANG: "fr_FR.UTF-8", LANGUAGE: "fr_FR:fr" },
    timezoneId: "Africa/Lome",
    ...device,
  });
  // Le bandeau « Mettez KoppaFoot sur l'écran d'accueil » masquerait les captures.
  await ctx.addInitScript(() => {
    try { localStorage.setItem("koppafoot:install-repousse", String(Date.now() + 1e11)); } catch {}
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.setDefaultTimeout(30000);
  page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 200)));
  return { ctx, page };
}

export async function go(page, url) {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await settle(page);
}

/** Laisse le temps aux données temps réel et aux animations d'arriver. */
export async function settle(page, ms = 1200) {
  await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(ms);
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((n) => n.remove());
  });
}

async function clearMarks(page) {
  await page.evaluate(() => document.querySelectorAll(".kf-mark").forEach((n) => n.remove()));
}

/**
 * Entoure chaque cible d'un cadre orange numéroté.
 * `targets` : Locator, ou { loc, n, pad } ; n = numéro affiché (omis = pas de pastille).
 */
export async function mark(page, targets) {
  await clearMarks(page);
  const list = (Array.isArray(targets) ? targets : [targets]).map((t) =>
    t && t.loc ? t : { loc: t },
  );
  for (const t of list) {
    if ((await t.loc.count()) === 0) {
      console.log("mark: cible absente", t.n ?? "");
      continue;
    }
    let box = await t.loc.boundingBox();
    for (const u of box && t.union ? [t.union].flat() : []) {
      const b2 = await u.boundingBox();
      if (b2) {
        const x1 = Math.min(box.x, b2.x), y1 = Math.min(box.y, b2.y);
        const x2 = Math.max(box.x + box.width, b2.x + b2.width), y2 = Math.max(box.y + box.height, b2.y + b2.height);
        box = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
      }
    }
    if (!box) {
      console.log("mark: cible introuvable", t.n ?? "");
      continue;
    }
    await page.evaluate(
      ({ box, n, pad, badge }) => {
        const d = document.createElement("div");
        d.className = "kf-mark";
        const x = box.x + window.scrollX - pad;
        const y = box.y + window.scrollY - pad;
        Object.assign(d.style, {
          position: "absolute",
          left: x + "px",
          top: y + "px",
          width: box.width + pad * 2 + "px",
          height: box.height + pad * 2 + "px",
          border: "3px solid #FF5A1F",
          borderRadius: "10px",
          boxShadow: "0 0 0 4px rgba(255,90,31,.22)",
          zIndex: 2147483646,
          pointerEvents: "none",
        });
        document.body.appendChild(d);
        if (n != null) {
          const b = document.createElement("div");
          b.className = "kf-mark";
          b.textContent = String(n);
          // Pastille à gauche du cadre, centrée verticalement, pour ne rien
          // masquer ; en coin haut-gauche si la place manque.
          const midY = y + (box.height + pad * 2) / 2 - 14;
          let left, top;
          if (badge === "right") { left = x + box.width + pad * 2 + 6; top = midY; }
          else if (badge !== "top" && x - 34 >= 4) { left = x - 34; top = midY; }
          else { left = Math.max(4, x - 14); top = Math.max(4, y - 14); }
          Object.assign(b.style, {
            position: "absolute",
            left: left + "px",
            top: top + "px",
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: "#FF5A1F",
            color: "#fff",
            font: "800 15px/28px system-ui, sans-serif",
            textAlign: "center",
            zIndex: 2147483647,
            pointerEvents: "none",
            boxShadow: "0 2px 6px rgba(0,0,0,.25)",
          });
          document.body.appendChild(b);
        }
      },
      { box, n: t.n ?? null, pad: t.pad ?? 5, badge: t.badge ?? null },
    );
  }
}

/** Capture (JPEG) puis retire les repères. */
export async function shot(page, name, { marks, fullPage = false, clip, el } = {}) {
  await settle(page, 400);
  if (marks) await mark(page, marks);
  const file = path.join(OUT, name + ".jpg");
  const opts = { path: file, type: "jpeg", quality: 82 };
  if (el) await el.screenshot(opts);
  else await page.screenshot({ ...opts, fullPage, clip });
  await clearMarks(page);
  console.log("📸", name);
  return file;
}

export async function done(ctx) {
  await ctx.close();
}

/**
 * Capture d'une zone de la page autour d'un élément (marges comprises).
 *
 * Pas de capture « pleine page » cousue : l'en-tête collant s'y retrouvait au
 * milieu. On agrandit plutôt la fenêtre pour que toute la page tienne, on
 * remonte en haut, et on découpe.
 */
export async function region(page, name, loc, { marks, margin = 44, extraBottom = 0, hideHeader = true, maxHeight = 5000, bas, depuis } = {}) {
  await settle(page, 400);
  const vp = page.viewportSize();
  const fullH = await page.evaluate(() => document.documentElement.scrollHeight);
  if (fullH > vp.height) await page.setViewportSize({ width: vp.width, height: Math.min(fullH, 6000) });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  // Les images chargées à la demande n'arrivent qu'une fois la fenêtre agrandie.
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
  if (hideHeader) {
    await page.addStyleTag({ content: "header { visibility: hidden !important; }" }).then((h) => h.evaluate((el) => el.classList.add("kf-hide"))).catch(() => {});
  }
  if (marks) await mark(page, marks);
  const b = await loc.boundingBox();
  const W = page.viewportSize().width;
  const x = Math.max(0, b.x - margin);
  // `depuis` : la capture commence au-dessus de cet élément, au lieu du haut de `loc`.
  const debut = depuis ? await depuis.boundingBox() : null;
  const y = Math.max(0, (debut ? debut.y : b.y) - margin);
  const width = Math.min(W - x, b.width + margin * 2);
  // `bas` : la capture s'arrête sous cet élément, au lieu du bas de `loc`.
  const fin = bas ? await bas.boundingBox() : null;
  const hauteur = (fin ? fin.y + fin.height : b.y + b.height) + margin - y;
  const height = Math.min(maxHeight, hauteur + extraBottom);
  const file = path.join(OUT, name + ".jpg");
  await page.screenshot({ path: file, type: "jpeg", quality: 82, clip: { x, y, width, height } });
  await clearMarks(page);
  await page.evaluate(() => document.querySelectorAll("style.kf-hide").forEach((n) => n.remove()));
  await page.setViewportSize(vp);
  console.log("📸", name);
  return file;
}

const STATE = path.resolve("state.json");
export function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return {}; }
}
export function saveState(patch) {
  const s = { ...loadState(), ...patch };
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
  return s;
}

/** Connexion par email depuis /login (profil vierge). */
export async function loginUI(page, email, password) {
  await go(page, "/login");
  const emailBtn = page.getByRole("button", { name: /email/i }).first();
  if (await emailBtn.count()) await emailBtn.click().catch(() => {});
  await settle(page, 600);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('input[type="password"]').first().press("Enter");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  await settle(page, 1500);
}

/** La colonne de contenu de la page (sans l'en-tête du site). */
export const content = (page) => page.locator("main div.mx-auto").first();

/** Le panneau de la fenêtre ouverte (les modales de l'appli sont des `fixed inset-0`). */
export const modale = (page) =>
  page.locator("div.fixed.inset-0").filter({ has: page.locator("button") }).last().locator(":scope > div").last();

/** Le bloc principal des pages de l'espace (sans l'indicateur « tirer pour actualiser »). */
export const corps = (page) => page.locator("main > div >> visible=true").first();
