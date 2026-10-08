// Le tournage : Elikem, sur un téléphone (390 × 844, ×3), ouvre les pages où
// une marque peut paraître. Pour chacune :
//
//   captures-brutes/<nom>-page.jpg   la page entière, en-tête et barre du bas
//                                    masqués : la vidéo la fait défiler
//   captures-brutes/<nom>-haut.jpg   l'en-tête, posé par-dessus pendant le défilement
//   captures-brutes/<nom>-bas.jpg    la barre de navigation du bas, idem
//   cibles.json                      où est l'emplacement de la marque, en px CSS
//
//   node tournage.mjs        (application sur http://localhost:3000, branchée
//                             sur les émulateurs, décor posé par decor.mjs)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ICI = import.meta.dirname;
const OUT = path.join(ICI, "captures-brutes");
fs.mkdirSync(OUT, { recursive: true });
const { cid, match } = JSON.parse(fs.readFileSync(path.join(ICI, "state.json"), "utf8"));

const PAGES = [
  ["direct", "/"],
  ["match", `/c/${cid}/matches/${match}`],
  ["competition", `/c/${cid}`],
  ["tribune", "/feed"],
];

const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await navigateur.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  locale: "fr-FR", timezoneId: "Africa/Lome",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
// Ni la proposition d'installation, ni le rappel du genre : ils masqueraient l'écran.
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

// Connexion d'Elikem.
await aller("/login", 1500);
const parEmail = page.getByRole("button", { name: /email/i }).first();
if (await parEmail.count()) await parEmail.click().catch(() => {});
await page.locator('input[type="email"]').first().fill("elikem@exemple.tg");
await page.locator('input[type="password"]').first().fill("Video2026!");
await page.locator('input[type="password"]').first().press("Enter");
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 });
await page.waitForTimeout(2500);

const cibles = {};
for (const [nom, url] of PAGES) {
  await aller(url, 5000);
  const zone = page.locator("[data-emplacement]:visible").first();
  await zone.waitFor({ timeout: 60000 }).catch(async (e) => {
    await page.screenshot({ path: path.join(OUT, `${nom}-ECHEC.png`) });
    throw new Error(`${nom} (${page.url()}) : aucun emplacement à l'écran. ${e.message.split("\n")[0]}`);
  });
  await zone.locator("img").first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // La carte « Pour bien démarrer » d'Elikem : un accompagnement propre à son
  // compte, qui n'a rien à faire dans une publicité.
  await page.evaluate(() => {
    // La plus grande boîte qui commence par ce titre et ne contient guère
    // plus : ses ancêtres commencent aussi par lui, mais portent toute la page.
    const carte = (el) => /^pour bien démarrer/i.test((el.innerText ?? "").trim()) && el.innerText.length < 400;
    const el = [...document.querySelectorAll("body *")].find((e) => carte(e) && !carte(e.parentElement));
    el?.remove();
  });
  await page.waitForTimeout(500);

  // Ce qui reste collé à l'écran (en-tête, barre du bas) : mesuré, capturé
  // seul, puis masqué pour la capture de la page entière.
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
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(400);
  if (collants.haut) await page.screenshot({ path: path.join(OUT, `${nom}-haut.jpg`), type: "jpeg", quality: 92, clip: { x: 0, y: 0, width: 390, height: collants.haut } });
  if (collants.bas) await page.screenshot({ path: path.join(OUT, `${nom}-bas.jpg`), type: "jpeg", quality: 92, clip: { x: 0, y: 844 - collants.bas, width: 390, height: collants.bas } });

  // L'en-tête garde sa place (il est souvent `sticky`) ; la barre du bas,
  // fixe, disparaît tout à fait, descendants compris.
  await page.addStyleTag({ content: "[data-collant=haut], [data-collant=haut] * { visibility: hidden !important; } [data-collant=bas] { display: none !important; }" });
  const box = await zone.boundingBox();
  const img = await zone.locator("img").first().boundingBox().catch(() => null);
  // Pour une annonce, la vidéo réécrit le nom de l'annonceur et les points du
  // défilement à chaque relève : leur place, et le fond sur lequel ils sont.
  const nomAnnonceur = await zone.locator("span.truncate").first().boundingBox().catch(() => null);
  const points = await zone.locator("button[aria-current]").first().locator("..").boundingBox().catch(() => null);
  const fond = await zone.evaluate((el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
    }
    return "#fff";
  });
  const scroll = await page.evaluate(() => scrollY);
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: path.join(OUT, `${nom}-page.jpg`), type: "jpeg", quality: 92, fullPage: true });
  cibles[nom] = {
    zone: { x: box.x, y: box.y + scroll, w: box.width, h: box.height },
    // L'image de la bannière, seule : la vidéo y fait défiler les annonces.
    image: img && { x: img.x, y: img.y + scroll, w: img.width, h: img.height },
    nom: nomAnnonceur && { x: nomAnnonceur.x, y: nomAnnonceur.y + scroll, w: nomAnnonceur.width, h: nomAnnonceur.height },
    points: points && { x: points.x, y: points.y + scroll, w: points.width, h: points.height },
    fond,
    haut: collants.haut, bas: collants.bas, hauteur,
    texte: (await zone.innerText()).replace(/\s+/g, " ").slice(0, 80),
  };
  console.log(nom, JSON.stringify(cibles[nom]));
}

fs.writeFileSync(path.join(ICI, "cibles.json"), JSON.stringify(cibles, null, 2));
await navigateur.close();
