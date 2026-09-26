// Chapitre 7 : après le match. Le samedi, Afi a tenu la console et sifflé la
// fin (joué en coulisses) ; Edem valide et note l'arbitrage à l'écran, Kokou
// en coulisses ; Komi retrouve ses notes, son bilan et sa fiche.
import { open, go, settle, region, loginUI, loadState, BUREAU } from "./lib.mjs";
import { api, db, uidOf } from "./admin.mjs";
import { ARBITRE, SCOREUSE, EDEM, KOKOU } from "./roster.mjs";

const { matchA, teamId, oppTeamId } = loadState();

// Le match, tel que la console d'Afi l'a laissé : 2-1, puis le coup de
// sifflet final par la vraie route.
const but = (side, team_id, minute, period, player_name) => ({
  id: Math.random().toString(36).slice(2, 11), type: "goal", period, minute, team_id,
  player_id: null, player_name, detail: null, victim_player_id: null, victim_player_name: null,
  out_player_id: null, out_player_name: null, created_at: new Date().toISOString(),
});
await db.collection("matches").doc(matchA).update({
  status: "live", score_home: 2, score_away: 1,
  live_state: {
    current_period: 2, timer_start_at: null, timer_offset: 0, is_timer_running: false,
    events: [
      but("home", teamId, 23, 1, "Atsu Ekpe"),
      but("away", oppTeamId, 51, 2, "Kwami Dogbe"),
      but("home", teamId, 78, 2, "Yawo Kuevi"),
    ],
  },
});
await api(SCOREUSE.email, SCOREUSE.mdp, "POST", "/api/matches/complete", { matchId: matchA });
await new Promise((r) => setTimeout(r, 1500));

// Edem valide le match et note l'arbitre.
const e = await open("edem", BUREAU);
await loginUI(e.page, EDEM.email, EDEM.mdp);
await go(e.page, `/matches/${matchA}`);
await settle(e.page, 3000);
const bloc = e.page.getByText("Validation Finale de la Feuille de Match").locator("xpath=ancestor::div[contains(@class,'border-2')][1]");
await bloc.getByRole("button", { name: /Valider le Score/i }).click();
const etoiles = bloc.getByText(/Noter l'arbitre/).locator("xpath=following-sibling::div[1]");
await etoiles.locator("button").nth(4).click();
await bloc.locator("textarea").fill("Arbitrage calme et juste, bien placé toute la rencontre. Merci !");
await settle(e.page, 400);
await region(e.page, "33-manager-note", bloc, {
  margin: 24,
  marks: [
    { loc: bloc.getByRole("button", { name: /Valider le Score/i }), n: 1, badge: "top" },
    { loc: etoiles, n: 2, badge: "top" },
    { loc: bloc.locator("textarea"), n: 3, badge: "top" },
    { loc: bloc.getByRole("button", { name: /Valider et envoyer/i }), n: 4, badge: "top" },
  ],
});
await bloc.getByRole("button", { name: /Valider et envoyer/i }).click();
await settle(e.page, 2500);
await e.ctx.close();

// Kokou fait de même, en coulisses.
await api(KOKOU.email, KOKOU.mdp, "POST", "/api/matches/validation", {
  matchId: matchA, action: "retour", validation: "validated", noteArbitre: 4,
  commentaire: "Bon match. Deux ou trois hésitations sur les touches.",
});
await new Promise((r) => setTimeout(r, 1500));

// Komi : les notes arrivent, l'historique se remplit.
const { ctx, page } = await open("komi", BUREAU);
await go(page, "/notifications");
await settle(page, 2000);
const n5 = page.getByText("Une note de 5/5").first().locator("xpath=ancestor::*[self::a or self::li or self::button][1]");
const n4 = page.getByText("Une note de 4/5").first().locator("xpath=ancestor::*[self::a or self::li or self::button][1]");
await region(page, "34-notif-notes", n4, { margin: 16, hideHeader: false, bas: n5, marks: [{ loc: n4, union: n5, n: 1, badge: "top" }] });

await go(page, "/designations");
await settle(page, 2000);
await page.getByRole("button", { name: /Historique/ }).first().click();
await settle(page, 2500);
const histo = page.getByText("Matchs dirigés").locator("xpath=ancestor::div[contains(@class,'space-y-3')][1]");
await region(page, "35-historique", histo, {
  margin: 24,
  marks: [
    { loc: page.getByText("Matchs dirigés").locator("xpath=ancestor::div[contains(@class,'grid')][1]"), n: 1 },
    { loc: histo.getByText("5/5").first().locator("xpath=ancestor::div[contains(@class,'border-t')][1]"), n: 2 },
  ],
});
await ctx.close();

// Sa fiche publique, telle que la voit un manager.
const komi = await uidOf(ARBITRE.email);
const e2 = await open("edem", BUREAU);
await go(e2.page, `/profile/${komi}`);
await settle(e2.page, 3000);
const section = e2.page.getByText("Matchs arbitrés").locator("xpath=ancestor::div[contains(@class,'space-y-4')][1]");
await region(e2.page, "36-fiche-publique", section, {
  margin: 24,
  marks: [
    { loc: e2.page.getByText("Matchs arbitrés").locator("xpath=ancestor::div[contains(@class,'grid')][1]"), n: 1 },
    { loc: e2.page.getByText(/corps arbitral/i).first().locator("xpath=ancestor::div[contains(@class,'border')][1]"), n: 2 },
  ],
});
await e2.ctx.close();
