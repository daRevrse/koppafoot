// Scène 07 : la Coupe des Quartiers. Edem inscrit l'Avenir ; Kossi, qui
// l'organise, ferme les inscriptions, tire les poules, construit le
// calendrier puis le tableau final ; la page publique montre résultats,
// classement et buteurs.
import { open, go, settle, ecran, cible, loadState, loginUI, PHONE } from "./lib.mjs";
import { api, db, idToken } from "./admin.mjs";
import { EDEM, ORGANISATEUR, COUPE, BLESSE } from "./roster.mjs";
const { coupeId: cid } = loadState();
const centrer = (loc) => loc.evaluate((el) => el.scrollIntoView({ block: "center" }));

// 1. Edem inscrit son équipe, depuis « Mon équipe ».
let { ctx, page } = await open("edem-tel", PHONE);
await loginUI(page, EDEM.email, EDEM.mdp);
await go(page, `/c/${COUPE.slug}`);
await settle(page, 3500);
await ecran(page, "07a-coupe");
await go(page, "/mon-equipe");
await settle(page, 3000);
const sInscrire = page.getByRole("button", { name: "S'inscrire" }).first();
await sInscrire.click();
await settle(page, 1200);
const m = page.locator(".modal-layer").last();
await m.locator("textarea").fill("L'Avenir d'Adakpamé sera de la partie. À bientôt sur le terrain !");
await m.locator('input[type="checkbox"]').check();
await settle(page, 600);
const envoyer = m.getByRole("button", { name: "Envoyer" });
await cible(page, "07b-inscription", envoyer);
await ecran(page, "07b-inscription");
await envoyer.click();
await settle(page, 2500);
await ctx.close();

// 2. Kossi accepte l'inscription (en coulisses) et ferme les inscriptions.
const tok = await idToken(ORGANISATEUR.email, ORGANISATEUR.mdp);
const r = await fetch(`http://localhost:3000/api/competitions/registrations?cid=${cid}`, { headers: { authorization: `Bearer ${tok}` } });
for (const reg of (await r.json()).registrations ?? []) {
  await api(ORGANISATEUR.email, ORGANISATEUR.mdp, "PATCH", "/api/competitions/registrations", { id: reg.id, action: "accept" });
}
await db.collection("competitions").doc(cid).update({ status: "registration_closed" });

// 3. Le tirage des poules.
({ ctx, page } = await open("kossi-tel", PHONE));
await loginUI(page, ORGANISATEUR.email, ORGANISATEUR.mdp);
await go(page, `/organizer/competitions/${cid}/groups`);
await settle(page, 3000);
const tirage = page.getByRole("button", { name: /Tirage aléatoire/ });
await centrer(tirage);
await settle(page, 600);
await cible(page, "07c-poules-vides", tirage);
await ecran(page, "07c-poules-vides");
await tirage.click();
await settle(page, 2000);
await page.evaluate(() => scrollTo(0, 0));
await settle(page, 600);
await ecran(page, "07d-poules-tirees");
await page.getByRole("button", { name: /Valider les poules/ }).click();
await settle(page, 2500);

// 4. Le calendrier.
await go(page, `/organizer/competitions/${cid}/schedule`);
await settle(page, 3000);
await page.getByRole("button", { name: /générer un round-robin/ }).click();
await settle(page, 3500);
await page.evaluate(() => scrollTo(0, 0));
await ecran(page, "07e-calendrier");
await db.collection("competitions").doc(cid).update({ status: "group_stage" });

// La phase de poules se joue (en coulisses) : scores et buteurs.
const equipes = Object.fromEntries((await db.collection(`competitions/${cid}/comp_teams`).get()).docs.map((d) => [d.id, d.data()]));
const matchs = (await db.collection(`competitions/${cid}/comp_matches`).where("stage", "==", "group").get()).docs;
const SCORES = [[2, 0], [1, 1], [3, 1], [0, 1], [2, 2], [1, 0], [2, 1], [0, 0], [3, 2], [1, 2], [2, 0], [1, 1]];
let k = 0, ev = 0;
for (const d of matchs) {
  const x = d.data();
  let [sh, sa] = SCORES[k++ % SCORES.length];
  const avenirDom = x.home_team_name === EDEM.equipe, avenirExt = x.away_team_name === EDEM.equipe;
  if (avenirDom) [sh, sa] = [Math.max(sh, sa) + 1, Math.min(sh, sa)];
  if (avenirExt) [sh, sa] = [Math.min(sh, sa), Math.max(sh, sa) + 1];
  const buteurs = (teamId, n) => {
    const joueurs = equipes[teamId]?.players ?? [];
    const kafui = joueurs.find((j) => j.name === "Kafui Mensah");
    // Ekoué, blessé, ne marque pas.
    const valides = joueurs.filter((j) => j.name !== BLESSE);
    const attaque = valides.filter((j) => /forward|attaquant/i.test(j.position ?? "")).concat(valides);
    return Array.from({ length: n }, (_, i) => {
      const j = kafui && i % 2 === 0 ? kafui : attaque[i % Math.max(attaque.length, 1)];
      return { id: `cq${++ev}`, type: "goal", period: i % 2 ? 3 : 1, minute: 10 + i * 17, team_id: teamId,
        player_id: j?.id ?? null, player_name: j?.name ?? "Buteur", created_at: new Date().toISOString() };
    });
  };
  await d.ref.update({
    status: "completed", score_home: sh, score_away: sa,
    winner_team_id: sh > sa ? x.home_team_id : sa > sh ? x.away_team_id : null,
    date: x.date ?? "2026-10-24", time: x.time ?? "15:00",
    live_state: { current_period: 4, timer_start_at: null, timer_offset: 0, is_timer_running: false,
      events: [...buteurs(x.home_team_id, sh), ...buteurs(x.away_team_id, sa)] },
    completed_at: new Date().toISOString(),
  });
}

// 5. Le tableau final.
page.on("dialog", (dl) => dl.accept());
await go(page, `/organizer/competitions/${cid}/knockout`);
await settle(page, 3000);
try {
  await page.getByRole("button", { name: /générer automatiquement/ }).click();
  await settle(page, 3500);
  const attribuer = page.getByRole("button", { name: /Attribuer les places/ });
  if (await attribuer.count()) { await attribuer.click(); await settle(page, 2500); }
} catch (e) { console.log("tableau :", e.message.slice(0, 160)); }
await ctx.close();

// 6. La page publique : le tableau, résultats, classement, buteurs.
({ ctx, page } = await open("edem-tel", PHONE));
for (const [onglet, nom] of [["Tableau", "07f-tableau"], ["Classement", "07g-public-classement"], ["Buteurs", "07h-public-buteurs"], ["Calendrier", "07i-public-resultats"]]) {
  await go(page, `/c/${COUPE.slug}`);
  await settle(page, 3000);
  const o = page.getByRole("tab", { name: new RegExp(onglet, "i") }).or(page.getByRole("button", { name: new RegExp(`^${onglet}`, "i") })).first();
  await o.click().catch(() => console.log("onglet absent", onglet));
  await settle(page, 2500);
  await ecran(page, nom);
}
await ctx.close();
console.log("compétition faite");
