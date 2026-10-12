// Le décor, sans capture, sur les ÉMULATEURS (jamais en production) :
//   · les joueurs inscrits, le gardien qui rejoindra l'Avenir ;
//   · Kokou et l'Olympique de Tokoin, créés à l'écran comme dans le guide manager ;
//   · Komi, son corps arbitral « Les Sifflets du Golfe », et Afi, scoreuse ;
//   · Elikem, le supporter ;
//   · Yawo et le Complexe sportif de Bè, validé par KoppaFoot ;
//   · le Championnat de Lomé-Est, déjà en cours : il remplit le Direct ;
//   · la Coupe des Quartiers, ouverte aux inscriptions, et son organisateur.
// Edem, lui, s'inscrit à l'écran (p1-equipe).
import fs from "node:fs";
import { open, go, settle, saveState, modale } from "./lib.mjs";
import { ensureAdmin, createPlayer, addGhostPlayers, compteSimple, api, db, auth, FieldValue, terrainDe } from "./admin.mjs";
import {
  JOUEURS, GARDIEN, KOKOU, TOKOIN, ARBITRE, CORPS, SCOREUSE, SUPPORTER, GERANT, TERRAIN,
  ORGANISATEUR, LIGUE, COUPE, effectif, slug,
} from "./roster.mjs";

const A = process.env.ASSETS ?? "actifs";
const dataUri = (f) => `data:image/png;base64,${fs.readFileSync(`${A}/${f}`).toString("base64")}`;
const maintenant = new Date().toISOString();
const jour = (decalage) => new Date(Date.now() + decalage * 86400000).toISOString().slice(0, 10);

const admin = await ensureAdmin();

// ── Les joueurs ─────────────────────────────────────────────
for (const j of [...JOUEURS, GARDIEN]) {
  const uid = await createPlayer(j);
  // Un compte à rôle dit son genre ; sans lui, l'application le redemande à
  // chaque connexion, par une fenêtre qui masquerait les captures.
  await db.collection("users").doc(uid).update({ gender: "male" });
}

// ── L'arbitre, la scoreuse, le supporter ────────────────────
const komi = await compteSimple(ARBITRE);
await db.collection("users").doc(komi).update({
  evolution_role: "referee", user_type: "referee", license_level: "regional", experience_years: 6, gender: "male",
});
const afi = await compteSimple(SCOREUSE);
await db.collection("users").doc(afi).update({ is_scorer: true, gender: "female" });
const elikem = await compteSimple(SUPPORTER);
await db.collection("users").doc(elikem).update({ gender: "male" });

const { id: corpsId } = await api(ARBITRE.email, ARBITRE.mdp, "POST", "/api/corps-arbitral", { action: "creer", nom: CORPS });
await api(ARBITRE.email, ARBITRE.mdp, "POST", "/api/corps-arbitral", { action: "inviter", corpsId, uid: afi, role: "scoreur" });
await api(SCOREUSE.email, SCOREUSE.mdp, "POST", "/api/corps-arbitral", { action: "repondre", corpsId, accepte: true });

// ── Le terrain : candidature, validation par KoppaFoot ──────
const yawo = await compteSimple(GERANT);
await db.collection("users").doc(yawo).update({ gender: "male" });
await api(GERANT.email, GERANT.mdp, "POST", "/api/venue-applications", {
  venueName: TERRAIN.nom, city: TERRAIN.ville, address: TERRAIN.adresse, phone: TERRAIN.telephone,
  fieldSize: "11v11", fieldSurface: "synthetic",
  motivation: "Je suis le gérant du complexe depuis 2019 : je m'occupe des réservations et de l'entretien.",
});
for (const d of (await db.collection("venue_applications").where("uid", "==", yawo).where("status", "==", "pending").get()).docs) {
  await api(admin.email, admin.password, "PATCH", `/api/venue-applications/${d.id}`, { action: "approve" });
}
const venueId = await terrainDe(GERANT.email);
// Ce que le gérant renseigne ensuite sur sa fiche : tarif, horaires, équipements.
await db.collection("venues").doc(venueId).update({
  price_per_hour: 25000, amenities: ["Vestiaires", "Éclairage", "Parking", "Buvette"],
  opening_hours: Object.fromEntries(["0", "1", "2", "3", "4", "5", "6"].map((j) => [j, { ouvre: "07:00", ferme: "22:00" }])),
  available: true, rating: 4.6, review_count: 18,
});

// ── Kokou et l'Olympique de Tokoin, à l'écran ───────────────
const { ctx, page } = await open("kokou");
await go(page, "/signup?role=manager");
await page.fill("#firstName", KOKOU.prenom);
await page.fill("#lastName", KOKOU.nom);
await page.fill("#signupEmail", KOKOU.email);
await page.fill("#signupPassword", KOKOU.mdp);
await page.getByRole("radio", { name: "Homme" }).click();
await page.getByRole("button", { name: /^Continuer$/ }).click();
await settle(page, 800);
await page.fill("#locationCity", "Lomé");
await page.getByRole("button", { name: /Créer mon compte/i }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 60000 });
await go(page, "/teams");
await page.getByRole("button", { name: "Créer une équipe" }).first().click();
await settle(page, 800);
await page.getByPlaceholder("FC Koppa").fill(KOKOU.equipe);
await page.getByPlaceholder("Paris").fill("Lomé");
await modale(page).locator('input[type="number"]').fill("20");
await modale(page).getByRole("button", { name: "Créer l'équipe" }).click();
await settle(page, 2500);
const oppTeamId = (await page.getByRole("link", { name: /Tokoin/ }).first().getAttribute("href")).split("/").pop();
await go(page, `/teams/${oppTeamId}`);
await page.getByRole("button", { name: "Modifier l'équipe" }).click();
await settle(page, 800);
await page.locator("#logo-input").setInputFiles(`${A}/ecusson-tokoin.png`);
await settle(page, 800);
await modale(page).getByRole("button", { name: /Enregistrer/ }).click();
await page.waitForTimeout(4000);
await ctx.close();
await addGhostPlayers(oppTeamId, TOKOIN);

// ── Le Championnat de Lomé-Est : déjà en cours ──────────────
const ligueId = "ligue-lome-est";
await db.doc(`competitions/${ligueId}`).set({
  name: LIGUE.nom, slug: LIGUE.slug, description: "Six clubs de l'est de Lomé, en matchs aller.",
  logo_url: null, banner_url: null, organizer_ids: [], moderator_ids: [], created_by: "video",
  organizer_name: "Ligue de Lomé-Est", status: "group_stage", competition_type: "league", category: "men",
  format: { group_count: 1, teams_per_group: 6, qualifiers_per_group: 0, has_third_place: false,
    points: { win: 3, draw: 1, loss: 0 }, team_size: 11, half_duration: 45 },
  start_date: jour(-14), end_date: jour(40), venue_city: "Lomé", rules_text: "",
  require_rules_acceptance: false, entry_fee: null, entry_fee_currency: "FCFA",
  is_validated: true, created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
});
const equipesLigue = LIGUE.equipes.map(([nom, court, couleur], i) => ({ id: slug(nom), nom, court, couleur, joueurs: effectif(i + 1) }));
for (const e of equipesLigue) {
  await db.doc(`competitions/${ligueId}/comp_teams/${e.id}`).set({
    name: e.nom, short_name: e.court, logo_url: dataUri(`ecusson-${e.id}.png`), color: e.couleur, group: "A",
    players: e.joueurs, claimed_by_manager_id: null, claimed_by_team_id: null, created_at: maintenant, updated_at: maintenant,
  });
}
const parId = Object.fromEntries(equipesLigue.map((e) => [e.id, e]));
let nEv = 0;
const but = (equipe, k, minute, period) => ({
  id: `ev${++nEv}`, type: "goal", period, minute, team_id: equipe.id,
  player_id: equipe.joueurs[k].id, player_name: equipe.joueurs[k].name, created_at: maintenant,
});
const feuille = (e) => e.joueurs.slice(0, 11).map((j) => ({ player_id: j.id, name: j.name, number: j.number, role: "starter", position: j.position, user_id: null }));
async function matchLigue(id, h, a, { date, time, status, sh = null, sa = null, buts = [], minute = null }) {
  const H = parId[h], Aw = parId[a];
  await db.doc(`competitions/${ligueId}/comp_matches/${id}`).set({
    competition_id: ligueId, stage: "group", group: "A", round: null, bracket_slot: null,
    home_team_id: h, away_team_id: a, home_team_name: H.nom, away_team_name: Aw.nom,
    home_team_logo: dataUri(`ecusson-${h}.png`), away_team_logo: dataUri(`ecusson-${a}.png`),
    date, time, venue_name: "Stade de Bè", venue_city: "Lomé", status,
    score_home: sh, score_away: sa, penalty_home: null, penalty_away: null,
    winner_team_id: status === "completed" ? (sh > sa ? h : sa > sh ? a : null) : null,
    feeds_into_match_id: null, feeds_into_slot: null,
    home_lineup: status === "scheduled" ? [] : feuille(H), away_lineup: status === "scheduled" ? [] : feuille(Aw),
    home_formation: null, away_formation: null,
    live_state: status === "scheduled" ? null : {
      current_period: status === "live" ? (minute > 45 ? 3 : 1) : 4,
      timer_start_at: status === "live" ? new Date(Date.now() - minute * 60000).toISOString() : null,
      timer_offset: 0, is_timer_running: status === "live", events: buts,
    },
    ...(status === "completed" ? { completed_at: `${date}T18:00:00.000Z` } : {}),
    created_at: maintenant, updated_at: maintenant,
  });
}
const [etb, rhe, uny, jke, eag, lba] = equipesLigue.map((e) => e.id);
await matchLigue("j1a", etb, uny, { date: jour(-6), time: "15:00", status: "completed", sh: 2, sa: 1,
  buts: [but(parId[etb], 9, 12, 1), but(parId[uny], 10, 40, 1), but(parId[etb], 9, 77, 3)] });
await matchLigue("j1b", jke, rhe, { date: jour(-6), time: "17:00", status: "completed", sh: 0, sa: 0 });
await matchLigue("j1c", lba, eag, { date: jour(-5), time: "16:00", status: "completed", sh: 1, sa: 3,
  buts: [but(parId[eag], 10, 8, 1), but(parId[lba], 11, 33, 1), but(parId[eag], 9, 61, 3), but(parId[eag], 10, 88, 3)] });
await matchLigue("j2a", rhe, etb, { date: jour(0), time: "16:00", status: "live", sh: 1, sa: 1, minute: 67,
  buts: [but(parId[rhe], 9, 21, 1), but(parId[etb], 9, 54, 3)] });
await matchLigue("j2b", eag, jke, { date: jour(0), time: "18:00", status: "live", sh: 2, sa: 0, minute: 31,
  buts: [but(parId[eag], 10, 6, 1), but(parId[eag], 11, 27, 1)] });
await matchLigue("j2c", uny, lba, { date: jour(1), time: "16:00", status: "scheduled" });

// ── La Coupe des Quartiers : ouverte aux inscriptions ───────
const kossi = await compteSimple({ ...ORGANISATEUR });
await db.collection("users").doc(kossi).update({ is_organizer: true, gender: "male" });
const coupe = await db.collection("competitions").add({
  name: COUPE.nom, slug: COUPE.slug,
  description: "Le tournoi des quartiers de Lomé : huit équipes, deux poules, une finale au stade de Bè.",
  logo_url: null, banner_url: null, organizer_ids: [kossi], moderator_ids: [], created_by: kossi,
  status: "registration", competition_type: "groups_knockout", category: "men",
  organizer_name: "Association Sportive des Quartiers",
  format: { group_count: 2, teams_per_group: 4, qualifiers_per_group: 2, has_third_place: false,
    points: { win: 3, draw: 1, loss: 0 }, team_size: 11, half_duration: 30 },
  start_date: jour(9), end_date: jour(60), venue_city: "Lomé",
  rules_text: "Chaque équipe présente 16 joueurs au plus. Deux cartons jaunes valent un match de suspension.",
  require_rules_acceptance: true, entry_fee: 10000, entry_fee_currency: "FCFA",
  is_validated: true, created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
});
for (const [i, [nom, court, couleur]] of COUPE.equipes.entries()) {
  await db.doc(`competitions/${coupe.id}/comp_teams/${slug(nom)}`).set({
    name: nom, short_name: court, logo_url: dataUri(`ecusson-${slug(nom)}.png`), color: couleur, group: null,
    players: effectif(i + 10), claimed_by_manager_id: null, claimed_by_team_id: null, created_at: maintenant, updated_at: maintenant,
  });
}

saveState({ oppTeamId, venueId, corpsId, komi, afi, elikem, yawo, kossi, ligueId, coupeId: coupe.id });
console.log("décor posé", { oppTeamId, venueId, corpsId, ligueId, coupeId: coupe.id });
void auth;
