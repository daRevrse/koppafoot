// Le tournage : Kafui, sur un téléphone (390 × 844, ×3), publie dans la
// Tribune. Quatre états, chacun capturé en entier :
//
//   vide        la Tribune, la zone de publication encore vide
//   texte       son texte tapé
//   photo       la photo ajoutée, prête à partir
//   publie      sa publication en tête du fil
//   reactions   48 « j'aime », les commentaires ouverts (decor.mjs reactions)
//
//   captures-brutes/<état>-page.jpg   la page entière, en-tête et barre du bas masqués
//   captures-brutes/<état>-haut.jpg   l'en-tête, posé par-dessus pendant le défilement
//   captures-brutes/<état>-bas.jpg    la barre du bas, idem
//   cibles.json                       où sont les éléments que la vidéo anime (px CSS)
//
//   node tournage.mjs        (application sur http://localhost:3000, branchée
//                             sur les émulateurs, décor posé par decor.mjs)
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ICI = import.meta.dirname;
const OUT = path.join(ICI, "captures-brutes");
const PHOTO = path.resolve(ICI, "../../../public/branding/fan_terrain.png");
const TEXTE = "Victoire 3-1 ce soir à Bè ! Doublé pour moi, merci les gars 🙌⚽";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await navigateur.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  locale: "fr-FR", timezoneId: "Africa/Lome",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("koppafoot:install-repousse", String(Date.now() + 1e11));
    sessionStorage.setItem("koppafoot:genre-plus-tard", "1");
  } catch {}
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("   pageerror:", e.message.slice(0, 160)));

async function aller(url, ms = 3000) {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(ms);
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((n) => n.remove()));
}

/** La place d'un élément dans la page (et non dans l'écran), en px CSS. */
async function place(loc) {
  const b = await loc.boundingBox();
  const y = await page.evaluate(() => scrollY);
  return b && { x: b.x, y: b.y + y, w: b.width, h: b.height };
}

/**
 * Un état : ce qui reste collé à l'écran (en-tête, barre du bas) capturé à
 * part, puis la page entière sans lui. Le style ajouté est retiré ensuite :
 * on continue de jouer dans la page.
 */
async function capturer(nom) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
  const collants = await page.evaluate(() => {
    const h = innerHeight;
    let haut = 0, bas = 0;
    for (const el of document.querySelectorAll("body *")) {
      const s = getComputedStyle(el);
      if (s.position !== "fixed" && s.position !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (r.width < innerWidth * 0.9 || r.height === 0 || r.height > 200) continue;
      if (r.top <= 1) { haut = Math.max(haut, r.bottom); el.dataset.collant = "haut"; }
      else if (r.bottom >= h - 1) { bas = Math.max(bas, h - r.top); el.dataset.collant = "bas"; }
    }
    return { haut: Math.round(haut), bas: Math.round(bas) };
  });
  if (collants.haut) await page.screenshot({ path: path.join(OUT, `${nom}-haut.jpg`), type: "jpeg", quality: 92, clip: { x: 0, y: 0, width: 390, height: collants.haut } });
  if (collants.bas) await page.screenshot({ path: path.join(OUT, `${nom}-bas.jpg`), type: "jpeg", quality: 92, clip: { x: 0, y: 844 - collants.bas, width: 390, height: collants.bas } });
  const style = await page.addStyleTag({ content: "[data-collant=haut], [data-collant=haut] * { visibility: hidden !important; } [data-collant=bas] { display: none !important; }" });
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: path.join(OUT, `${nom}-page.jpg`), type: "jpeg", quality: 92, fullPage: true });
  await style.evaluate((el) => el.remove());
  return { ...collants, hauteur };
}

// Connexion de Kafui.
await aller("/login", 1500);
const parEmail = page.getByRole("button", { name: /email/i }).first();
if (await parEmail.count()) await parEmail.click().catch(() => {});
await page.locator('input[type="email"]').first().fill("kafui@exemple.tg");
await page.locator('input[type="password"]').first().fill("Video2026!");
await page.locator('input[type="password"]').first().press("Enter");
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 });
await page.waitForTimeout(2500);

const cibles = {};
const zone = page.getByPlaceholder("Quoi de neuf sur le terrain ?");
const publier = page.getByRole("button", { name: /Publier/ });
const boutonPhoto = page.getByRole("button", { name: /^Photo$/ });

// 1. Vide.
await aller("/feed", 5000);
await zone.waitFor({ timeout: 60000 });
cibles.vide = { ...(await capturer("vide")), zone: await place(zone), photo: await place(boutonPhoto), publier: await place(publier) };

// 2. Le texte.
await zone.fill(TEXTE);
await page.waitForTimeout(600);
await page.evaluate(() => document.activeElement?.blur());
cibles.texte = { ...(await capturer("texte")), zone: await place(zone), photo: await place(boutonPhoto) };

// 3. La photo.
await page.locator('input[type="file"]').first().setInputFiles(PHOTO);
await page.waitForTimeout(2000);
cibles.photo = { ...(await capturer("photo")), publier: await place(publier) };

// 4. Publié.
await publier.click();
const sienne = page.locator('[id^="post-"]', { hasText: "Doublé pour moi" }).first();
await sienne.waitFor({ timeout: 60000 });
await sienne.locator("img").first().waitFor({ timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);
cibles.publie = {
  ...(await capturer("publie")),
  post: await place(sienne),
  jaime: await place(sienne.getByRole("button", { name: "J'aime" })),
  commentaires: await place(sienne.getByRole("button", { name: "Commentaires" })),
};

// 5. Les réactions.
execFileSync("node", [path.join(ICI, "decor.mjs"), "reactions"], { stdio: "inherit" });
await aller("/feed", 5000);
const sienne2 = page.locator('[id^="post-"]', { hasText: "Doublé pour moi" }).first();
await sienne2.waitFor({ timeout: 60000 });
await sienne2.getByRole("button", { name: "Commentaires" }).click();
await sienne2.getByText("Quel but Kafui").waitFor({ timeout: 30000 });
await page.waitForTimeout(1500);
const officiels = page.locator('[id^="post-"]', { hasText: "KoppaFoot" });
cibles.reactions = {
  ...(await capturer("reactions")),
  post: await place(sienne2),
  jaime: await place(sienne2.getByRole("button", { name: "J'aime" })),
  officiels: await Promise.all((await officiels.all()).slice(0, 3).map(place)),
};

fs.writeFileSync(path.join(ICI, "cibles.json"), JSON.stringify(cibles, null, 2));
for (const [nom, c] of Object.entries(cibles)) console.log(nom, JSON.stringify(c).slice(0, 240));
await navigateur.close();
