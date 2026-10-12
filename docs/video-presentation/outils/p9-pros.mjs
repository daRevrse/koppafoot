// Scène 08 : pour les pros. Le terrain de Yawo dans l'annuaire, sa fiche, son
// planning, son offre gratuite ; puis des marques fictives dans les
// emplacements partenaires du Direct, de la Tribune et des Actus (les
// bannières de la vidéo annonceurs).
import fs from "node:fs";
import path from "node:path";
import { open, go, settle, ecran, cible, nettoyer, loadState, loginUI, actusFictives, PHONE } from "./lib.mjs";
import { db, FieldValue, chronosDuChampionnat } from "./admin.mjs";
import { GERANT, SUPPORTER } from "./roster.mjs";
const { venueId } = loadState();
const BANNIERES = path.resolve(import.meta.dirname, "../../video-annonceurs/source/images/bannieres");
const dataUri = (f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(BANNIERES, f)).toString("base64")}`;
const jour = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

// Le terrain, côté public.
let { ctx, page } = await open("elikem-tel", PHONE);
await loginUI(page, SUPPORTER.email, SUPPORTER.mdp);
await go(page, "/terrains/annuaire");
await settle(page, 3500);
await ecran(page, "08a-annuaire");
await go(page, `/terrains/${venueId}`);
await settle(page, 3500);
await ecran(page, "08b-fiche-terrain");
await ctx.close();

// Côté gérant : ses réservations, son offre.
({ ctx, page } = await open("yawo-tel", PHONE));
await loginUI(page, GERANT.email, GERANT.mdp);
await go(page, "/mes-terrains/reservations");
await settle(page, 3000);
// La liste : la demande d'Edem, confirmée, avec le match qu'elle accueille.
await ecran(page, "08c-planning");
await go(page, "/offre");
await settle(page, 3000);
await ecran(page, "08d-offre");
await ctx.close();

// Les marques, dans les emplacements partenaires.
for (const d of (await db.collection("partenariats").get()).docs) await d.ref.delete();
const partenariat = (id, champs) => db.doc(`partenariats/${id}`).set({
  accroche: null, format: "banniere", type: "partenaire", image_verticale_url: null,
  lien: "https://exemple.tg", competition_id: null, competition_nom: null,
  debut: jour(-3), fin: jour(30), actif: true, vues: 0, clics: 0, created_by: "video",
  created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(), ...champs,
});
await partenariat("sika-direct", {
  annonceur: "Sika Jus", accroche: "100 % fruits pressés", image_url: dataUri("sika-jus.jpg"),
  emplacements: ["direct", "direct_affiche", "direct_vide"],
});
await partenariat("novo-tribune", { annonceur: "Novo Assurances", type: "annonce", image_url: dataUri("novo-assurances.jpg"), emplacements: ["tribune"] });
await partenariat("mawuli-actus", { annonceur: "Mawuli Auto", type: "annonce", image_url: dataUri("mawuli-auto.jpg"), emplacements: ["actus"] });

// L'emplacement visible de la page (celui de l'ordinateur est masqué), bannière chargée.
async function zone(page, nom, centrer) {
  const z = page.locator("[data-emplacement]:visible").first();
  await z.waitFor({ timeout: 40000 });
  await z.locator("img").first().waitFor({ timeout: 20000 }).catch(() => {});
  if (centrer) await z.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await settle(page, 1500);
  await nettoyer(page);
  await cible(page, nom, z);
  await ecran(page, nom);
}
await chronosDuChampionnat();
({ ctx, page } = await open("elikem-tel", PHONE));
await go(page, "/");
await settle(page, 3000);
await zone(page, "08e-partenaire-direct", false);
await go(page, "/feed");
await settle(page, 3000);
await zone(page, "08f-partenaire-tribune", true);
await go(page, "/actus");
await settle(page, 4000);
await actusFictives(page);
await zone(page, "08g-partenaire-actus", true);
await ctx.close();
console.log("pros fait");
