// Scène 05 : le samedi soir, dans la Tribune. Kafui raconte sa victoire avec
// une photo ; les j'aime et les commentaires arrivent, et il en est prévenu.
// Plus bas dans le fil : un résultat officiel et l'annonce d'Edem. Puis les
// Actus.
import path from "node:path";
import { open, go, settle, ecran, cible, loadState, saveState, loginUI, actusFictives, PHONE } from "./lib.mjs";
import { api, db, ensureAdmin, uidOf } from "./admin.mjs";
import { EDEM, SCOREUSE, ORGANISATEUR, JOUEURS } from "./roster.mjs";
const { ligueId, coupeId } = loadState();
const KAFUI = JOUEURS[0];
const PHOTO = path.resolve(import.meta.dirname, "../../../public/branding/fan_terrain.png");
const TEXTE = "Victoire 2-0 à Bè ! Doublé pour moi, merci les gars 🙌⚽";

// Les annonces officielles, publiées avant la sienne : elles sont plus bas dans le fil.
const admin = await ensureAdmin();
await api(ORGANISATEUR.email, ORGANISATEUR.mdp, "POST", "/api/tribune/announce", { cid: coupeId, event: { kind: "registrations_open" } });
await api(admin.email, admin.password, "POST", "/api/tribune/announce", {
  cid: ligueId, event: { kind: "match_result", homeTeam: "Racing Hédzranawoé", awayTeam: "Étoile de Bè", scoreHome: 1, scoreAway: 1 },
});

// Kafui publie.
const { ctx, page } = await open("kafui-tel", PHONE);
await loginUI(page, KAFUI.email, "Joueur2026!");
await go(page, "/feed");
await settle(page, 3000);
const zone = page.getByPlaceholder("Quoi de neuf sur le terrain ?");
await zone.fill(TEXTE);
await page.locator('input[type="file"]').first().setInputFiles(PHOTO);
await settle(page, 2000);
await page.evaluate(() => document.activeElement?.blur());
const publier = page.getByRole("button", { name: /Publier/ });
await cible(page, "05a-tribune-ecrit", publier);
await ecran(page, "05a-tribune-ecrit");
await publier.click();
const sienne = page.locator('[id^="post-"]', { hasText: "Doublé pour moi" }).first();
await sienne.waitFor({ timeout: 60000 });
await sienne.locator("img").first().waitFor({ timeout: 60000 }).catch(() => {});
await settle(page, 3000);
const postId = (await sienne.getAttribute("id")).replace("post-", "");
saveState({ postKafui: postId });
await ecran(page, "05b-tribune-publie");

// Les réactions : des j'aime, et trois commentaires par la vraie route.
const amis = await Promise.all([EDEM.email, SCOREUSE.email, ...JOUEURS.slice(1).map((j) => j.email)].map(uidOf));
await db.collection("posts").doc(postId).update({ likes: [...amis, ...Array.from({ length: 31 }, (_, i) => `supporter-${i}`)] });
await api(SCOREUSE.email, SCOREUSE.mdp, "POST", "/api/tribune/comments", { postId, content: "Quel doublé Kafui !! 🔥🔥" });
await api(EDEM.email, EDEM.mdp, "POST", "/api/tribune/comments", { postId, content: "Fier de vous les gars. On remet ça samedi 💪" });
await api(JOUEURS[1].email, "Joueur2026!", "POST", "/api/tribune/comments", { postId, content: "La passe était belle aussi 😏" });

// Il ouvre la notification : ses commentaires, dépliés.
await go(page, "/notifications");
await settle(page, 2500);
await ecran(page, "05c-notifications");
await go(page, `/feed?post=${postId}&commentaires=1`);
await settle(page, 4000);
await page.locator(`#post-${postId}`).evaluate((el) => el.scrollIntoView({ block: "start" }));
await page.evaluate(() => scrollBy(0, -90));
await settle(page, 1200);
await ecran(page, "05d-tribune-reactions");

// Plus bas dans le fil : le résultat officiel, puis l'annonce d'Edem.
await go(page, "/feed");
await settle(page, 3500);
const officiel = page.locator('[id^="post-"]', { hasText: "Racing Hédzranawoé" }).first();
await officiel.evaluate((el) => el.scrollIntoView({ block: "start" }));
await page.evaluate(() => scrollBy(0, -90));
await settle(page, 1200);
await ecran(page, "05e-tribune-officiel");
const annonce = page.locator('[id^="post-"]', { hasText: "recrute" }).first();
await annonce.evaluate((el) => el.scrollIntoView({ block: "start" }));
await page.evaluate(() => scrollBy(0, -90));
await settle(page, 1200);
await ecran(page, "05f-tribune-annonce");

// Les Actus. Le fil de presse est réel : sur la capture, ses titres, ses
// sources et ses photos sont remplacés par des contenus fictifs (la mise en
// page, elle, reste celle de l'application).
await go(page, "/actus");
await settle(page, 4000);
await actusFictives(page);
await settle(page, 2500);
await ecran(page, "05g-actus");
await ctx.close();
console.log("tribune faite", postId);
