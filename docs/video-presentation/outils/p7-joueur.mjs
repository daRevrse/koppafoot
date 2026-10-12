// Scène 06 : le dimanche, la fiche de Kafui. Sa condition, déclarée ; sa
// forme, que ses matchs disent ; sa place au classement des joueurs, sur ses
// cinq derniers matchs.
//
// Le classement demande trois matchs notés. L'Avenir en a joué deux autres
// avant ce samedi : deux amicaux contre des équipes hors plateforme, posés
// ici avec la feuille du samedi, comme la console les aurait laissés.
import { open, go, settle, ecran, cible, loadState, loginUI, PHONE } from "./lib.mjs";
import { api, db, FieldValue, uidOf } from "./admin.mjs";
import { EDEM, JOUEURS } from "./roster.mjs";
const { matchId, teamId, edem } = loadState();
const KAFUI = JOUEURS[0];
const kafui = await uidOf(KAFUI.email);

const samedi = (await db.collection("matches").doc(matchId).get()).data();
const feuille = samedi.home_lineup ?? [];
const nomDe = (uid) => feuille.find((e) => e.player_id === uid)?.name ?? "Kafui Mensah";
const adverse = (nom) => Array.from({ length: 11 }, (_, i) => ({
  player_id: `ext-${nom.slice(0, 3).toLowerCase()}-${i + 1}`, name: `Joueur ${i + 1}`, number: String(i + 1), role: "starter", position: null,
}));
let n = 0;
const but = (minute, period, uid, nom, passeur = null) => ({
  id: `p${++n}`, type: "goal", period, minute, team_id: teamId, player_id: uid, player_name: nom,
  assist_player_id: passeur?.player_id ?? null, assist_player_name: passeur?.name ?? null, created_at: new Date().toISOString(),
});
const selom = feuille.find((e) => e.name === "Selom Adjo");
const etse = feuille.find((e) => e.name === "Etse Gbeassor");
const kafuiSurLaFeuille = feuille.find((e) => e.player_id === kafui);
// Kafui monte en puissance : une passe décisive, puis un but, puis le doublé
// du samedi. Sa forme est « en progrès ».
for (const [date, adversaire, sh, sa, buts] of [
  ["2026-10-03", "Dynamo de Bè", 3, 1, [
    but(12, 1, etse.player_id, etse.name, kafuiSurLaFeuille), but(58, 3, etse.player_id, etse.name, selom), but(80, 3, selom.player_id, selom.name)]],
  ["2026-10-10", "Espoir de Kégué", 1, 1, [but(74, 3, kafui, nomDe(kafui), selom)]],
]) {
  await db.collection("matches").add({
    home_team_id: teamId, away_team_id: "", home_team_name: samedi.home_team_name, away_team_name: adversaire,
    home_team_logo: samedi.home_team_logo ?? null, away_team_logo: null, manager_id: edem, away_manager_id: "",
    date, time: "16:00", venue_name: "Complexe sportif de Bè", venue_city: "Lomé", venue_id: null,
    status: "completed", result: sh > sa ? "win" : sh < sa ? "loss" : "draw", score_home: sh, score_away: sa,
    referee_id: null, referee_name: null, referee_status: "none", local_referee_name: null, format: "11v11",
    is_home: true, players_confirmed: 22, players_total: 22, confirmed_home: 11, confirmed_away: 11,
    home_lineup: feuille, home_lineup_ready: true, away_ghost_lineup: adverse(adversaire), away_lineup_ready: true,
    home_formation: samedi.home_formation ?? "4-4-2",
    live_state: { current_period: 4, timer_start_at: null, timer_offset: 0, is_timer_running: false, events: buts },
    completed_at: `${date}T17:45:00.000Z`,
    created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
  });
}
// Le classement et les formes se refont, comme à chaque coup de sifflet final.
await api(EDEM.email, EDEM.mdp, "POST", "/api/rankings/rebuild", {});

const { ctx, page } = await open("kafui-tel", PHONE);
await loginUI(page, KAFUI.email, "Joueur2026!");
await go(page, "/stats");
await settle(page, 4000);
const declarer = page.getByRole("button", { name: /Déclarer ma condition|Mettre à jour/ }).first();
await declarer.evaluate((el) => el.closest("section, div.border, div")?.scrollIntoView({ block: "start" }));
await page.evaluate(() => scrollBy(0, -110));
await settle(page, 1500);
await cible(page, "06a-forme", declarer);
await ecran(page, "06a-forme");
await declarer.click();
await settle(page, 1200);
const apte = page.getByRole("radio", { name: /Apte/ }).first();
await apte.click().catch(() => {});
await settle(page, 600);
await cible(page, "06b-condition", apte);
await cible(page, "06b-condition-blesse", page.getByRole("radio", { name: /Blessé/ }).first());
await ecran(page, "06b-condition");
await page.getByRole("button", { name: /^Enregistrer/ }).first().click();
await settle(page, 2500);

await go(page, "/top-players");
await settle(page, 4000);
const ligne = page.getByText("Kafui Mensah").first();
await ligne.evaluate((el) => el.scrollIntoView({ block: "center" }));
await settle(page, 1200);
await cible(page, "06c-classement", ligne);
await ecran(page, "06c-classement");
await page.evaluate(() => scrollTo(0, 0));
await settle(page, 800);
await ecran(page, "06d-classement-haut");
await ctx.close();
console.log("joueur fait");
