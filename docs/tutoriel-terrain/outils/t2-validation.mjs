// Chapitre 2 : la réponse de l'équipe KoppaFoot.
// L'équipe KoppaFoot relit en coulisses (par la vraie route de l'API) ; le
// gérant voit la réponse arriver. Une autre candidate montre le cas d'un refus.
import { open, go, shot, region, settle, loginUI, saveState } from "./lib.mjs";
import { api, db, auth, ensureAdmin, compteSimple, terrainDe } from "./admin.mjs";
import { GERANT, CANDIDATE } from "./roster.mjs";

const admin = await ensureAdmin();
const decider = async (email, action, motif) => {
  const uid = (await auth.getUserByEmail(email)).uid;
  const snap = await db.collection("venue_applications").where("uid", "==", uid).where("status", "==", "pending").get();
  for (const d of snap.docs) {
    await api(admin.email, admin.password, "PATCH", `/api/venue-applications/${d.id}`, { action, motif });
  }
};

// Yawo : approuvé.
await decider(GERANT.email, "approve");
saveState({ venueId: await terrainDe(GERANT.email) });

const { ctx, page } = await open("yawo");
await go(page, "/notifications");
await settle(page, 1500);
const notif = page.getByText("Terrain publié").first().locator("xpath=ancestor::*[self::a or self::li or self::button][1]");
await region(page, "07-notif-publie", notif, {
  margin: 30, hideHeader: false,
  marks: [{ loc: notif, n: 1, badge: "top" }],
});
await ctx.close();

// Mawuena : refusée, avec un motif.
await compteSimple(CANDIDATE);
await api(CANDIDATE.email, CANDIDATE.mdp, "POST", "/api/venue-applications", {
  venueName: CANDIDATE.terrain, city: "Lomé", fieldSize: "7v7", fieldSurface: "natural_grass",
});
await decider(CANDIDATE.email, "reject",
  "Précise ton lien avec le terrain : propriétaire, gérant, association qui l'exploite.");
const m = await open("mawuena");
await loginUI(m.page, CANDIDATE.email, CANDIDATE.mdp);
await go(m.page, "/terrains/candidature");
await settle(m.page, 1500);
const refus = m.page.locator("section div.border").filter({ hasText: "Fiche non publiée" }).first();
await region(m.page, "09-refus-motif", refus, {
  margin: 30, hideHeader: false,
  marks: [
    { loc: m.page.getByText(/^Motif :/).locator("xpath=.."), n: 1 },
    { loc: m.page.getByRole("button", { name: "Redéposer ma demande" }), n: 2 },
  ],
});
await m.ctx.close();
