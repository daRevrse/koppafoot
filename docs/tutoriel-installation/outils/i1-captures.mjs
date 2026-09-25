// Tout ce que KoppaFoot affiche pour l'installation et les notifications,
// sur un téléphone Android, un iPhone et un ordinateur.
//
// Ce qu'un navigateur piloté ne sait pas faire, on le rejoue au plus près :
// - l'évènement de Chrome « ce site peut s'installer » (simulerInstallable) ;
// - l'iPhone : l'identité de Safari sur iPhone (PHONE, dans lib.mjs) ;
// - l'application ouverte depuis l'écran d'accueil (ouverteDepuisAccueil) ;
// - la réponse donnée à la demande d'autorisation (permission).
// Les fenêtres du navigateur lui-même sont dans schemas.mjs.
import {
  open, go, settle, shot, region, loginUI, simulerInstallable, done,
  ANDROID, PHONE, DESKTOP, BASE,
} from "./lib.mjs";
import { createPlayer } from "./admin.mjs";

const EMAIL = "kafui.mensah@example.com";
const MDP = "Joueur2026!";
await createPlayer({ first: "Kafui", last: "Mensah", email: EMAIL, position: "midfielder" });

// SEULEMENT=ordinateur,iphone : ne refaire que ces parties.
const faire = (n) => !process.env.SEULEMENT || process.env.SEULEMENT.split(",").includes(n);

const CARTE = (page) => page.getByRole("dialog", { name: /Mettez KoppaFoot sur l'écran d'accueil/i });
const AVATAR = (page) => page.getByRole("button", { name: "Mon compte" }).filter({ visible: true }).first();

/** L'application lancée depuis son icône : plein écran, sans barre du navigateur. */
async function ouverteDepuisAccueil(ctx) {
  await ctx.addInitScript(() => {
    const vrai = window.matchMedia.bind(window);
    window.matchMedia = (q) =>
      /display-mode:\s*standalone/.test(q)
        ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {},
            addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }
        : vrai(q);
    Object.defineProperty(navigator, "standalone", { get: () => true });
  });
}

/**
 * Sur iPhone, Safari n'émet jamais l'évènement d'installation ; le Chromium
 * qui joue l'iPhone, lui, l'émettrait de lui-même. On l'arrête avant KoppaFoot.
 */
async function commeSafari(ctx) {
  await ctx.addInitScript(() => {
    window.addEventListener("beforeinstallprompt", (e) => e.stopImmediatePropagation(), true);
  });
}

/** La réponse donnée à « Autoriser les notifications ? ». */
async function permission(ctx, reponse) {
  if (reponse === "granted") return ctx.grantPermissions(["notifications"], { origin: BASE });
  await ctx.addInitScript((r) => {
    Object.defineProperty(Notification, "permission", { get: () => r });
  }, reponse);
}

/** Attend la carte « Mettez KoppaFoot sur l'écran d'accueil » (8 s après l'ouverture). */
async function attendreCarte(page) {
  await CARTE(page).waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(800); // fin de l'animation
}

/** Le bloc « Notifications » de la page Paramètres. */
const blocNotifs = (page) =>
  page.locator("div").filter({ has: page.getByText("Sur cet appareil", { exact: true }) })
    .filter({ has: page.getByText(/^Notifications$/) }).last();

// ------------------------------------------------------------------ Android
if (faire("android")) {
  const { ctx, page } = await open("android", ANDROID, { proposition: true });
  await permission(ctx, "granted");

  // Avant même de se connecter : le bloc de la page de connexion.
  await go(page, "/login");
  await simulerInstallable(page);
  await settle(page, 1200);
  const bloc = page.locator("div.rounded-2xl").filter({ hasText: "Installer KoppaFoot" }).last();
  await region(page, "01-android-connexion", bloc, {
    marks: [{ loc: bloc.getByRole("button", { name: "Installer", exact: true }), n: 1 }],
    margin: 20, depuis: page.getByText("Pas encore de compte"), hideHeader: false,
  });

  await loginUI(page, EMAIL, MDP);
  await go(page, "/");
  await simulerInstallable(page);
  await attendreCarte(page);
  await shot(page, "01-android-carte", {
    marks: [{ loc: CARTE(page).getByRole("button", { name: "Installer KoppaFoot" }), n: 1 }],
  });

  // Plus tard : le menu de son avatar.
  await CARTE(page).getByRole("button", { name: "Plus tard" }).last().click();
  await page.waitForTimeout(600);
  await shot(page, "04a-android-avatar", {
    marks: [{ loc: AVATAR(page), n: 1 }],
    clip: { x: 0, y: 0, width: 412, height: 150 },
  });
  await AVATAR(page).click();
  await settle(page, 1200);
  await shot(page, "04b-android-menu", {
    marks: [{ loc: page.getByRole("button", { name: /Installer KoppaFoot/ }), n: 2 }],
  });
  await shot(page, "14-android-menu-parametres", {
    marks: [{ loc: page.getByRole("link", { name: /Paramètres/ }).last(), n: 1 }],
  });

  // Les notifications : pas encore activées sur ce téléphone.
  await go(page, "/parametres");
  await blocNotifs(page).waitFor();
  await region(page, "15-notifs-inactif", blocNotifs(page), {
    marks: [{ loc: blocNotifs(page).getByRole("button", { name: "Oui", exact: true }), n: 1 }],
    margin: 16, extraBottom: -12, hideHeader: false,
  });
  // Activées : le jeton de l'appareil est posé (c'est ce que fait « Oui »).
  await page.evaluate(() => localStorage.setItem("koppafoot:push-token", "jeton-factice"));
  await go(page, "/parametres");
  await blocNotifs(page).waitFor();
  await region(page, "17-notifs-actif", blocNotifs(page), {
    marks: [{ loc: blocNotifs(page).getByRole("button", { name: "Oui", exact: true }), n: 1 }],
    margin: 16, extraBottom: -12, hideHeader: false,
  });
  await page.evaluate(() => localStorage.removeItem("koppafoot:push-token"));
  await done(ctx);
}

// ------------------------------------------------------------------ Android, notifications refusées
if (faire("android-refus")) {
  const { ctx, page } = await open("android-refus", ANDROID);
  await permission(ctx, "denied");
  await loginUI(page, EMAIL, MDP);
  await go(page, "/parametres");
  await blocNotifs(page).waitFor();
  await region(page, "19-notifs-refuse", blocNotifs(page), { margin: 16, extraBottom: -12, hideHeader: false });
  await done(ctx);
}

// ------------------------------------------------------------------ iPhone, dans Safari
if (faire("iphone")) {
  const { ctx, page } = await open("iphone", PHONE, { proposition: true });
  await commeSafari(ctx);
  await loginUI(page, EMAIL, MDP);
  await go(page, "/");
  await attendreCarte(page);
  await shot(page, "06-iphone-carte", { marks: [{ loc: CARTE(page), n: 1, badge: "top" }] });

  await CARTE(page).getByRole("button", { name: "Plus tard" }).first().click();
  await page.waitForTimeout(600);
  await AVATAR(page).click();
  await settle(page, 1200);
  const ios = page.getByText(/Pour installer KoppaFoot sur iPhone/).last();
  await shot(page, "11-iphone-menu", { marks: [{ loc: ios, n: 1, badge: "top", union: page.getByText("Application", { exact: true }).last() }] });

  await go(page, "/parametres");
  await blocNotifs(page).waitFor();
  await region(page, "18-iphone-notifs-safari", blocNotifs(page), { margin: 16, extraBottom: -12, hideHeader: false });
  await done(ctx);
}

// ------------------------------------------------------------------ iPhone, depuis l'écran d'accueil
if (faire("iphone-app")) {
  const { ctx, page } = await open("iphone-app", PHONE);
  await commeSafari(ctx);
  await ouverteDepuisAccueil(ctx);
  await permission(ctx, "granted");
  await loginUI(page, EMAIL, MDP);
  await go(page, "/parametres");
  await blocNotifs(page).waitFor();
  await region(page, "18b-iphone-notifs-app", blocNotifs(page), {
    marks: [{ loc: blocNotifs(page).getByRole("button", { name: "Oui", exact: true }), n: 1 }],
    margin: 16, extraBottom: -12, hideHeader: false,
  });
  await done(ctx);
}

// ------------------------------------------------------------------ Ordinateur
if (faire("ordinateur")) {
  const { ctx, page } = await open("ordinateur", DESKTOP, { proposition: true });
  await loginUI(page, EMAIL, MDP);
  await go(page, "/");
  await simulerInstallable(page);
  await attendreCarte(page);
  await shot(page, "12a-ordinateur-carte", {
    marks: [{ loc: CARTE(page).getByRole("button", { name: "Installer KoppaFoot" }), n: 1 }],
  });
  await CARTE(page).getByRole("button", { name: "Plus tard" }).last().click();
  await page.waitForTimeout(600);
  const avatar = AVATAR(page);
  await avatar.click();
  await settle(page, 800);
  const installer = page.getByRole("button", { name: /Installer KoppaFoot/ }).filter({ visible: true }).first();
  const b = await installer.boundingBox();
  await shot(page, "12b-ordinateur-menu", {
    marks: [{ loc: avatar, n: 1 }, { loc: installer, n: 2 }],
    clip: { x: 880, y: 0, width: 400, height: Math.min(800, b.y + b.height + 90) },
  });
  await done(ctx);
}
