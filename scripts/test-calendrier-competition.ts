/**
 * KOPPAFOOT — Vérification du calendrier mis en ordre pour le PDF
 * (lib/calendrier-competition). Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-calendrier-competition.ts
 */
import assert from "node:assert/strict";
import { calendrierDeCompetition, libelleButeur } from "@/lib/calendrier-competition";
import type { CompMatch, LineupEntry } from "@/types";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${nom}`);
  } catch (err) {
    echecs += 1;
    console.error(`  KO  ${nom}\n      ${(err as Error).message.split("\n").join("\n      ")}`);
  }
}

type Evt = NonNullable<CompMatch["liveState"]>["events"][number];

const but = (teamId: string, playerId: string, playerName: string, minute = 0, extra: Partial<Evt> = {}): Evt =>
  ({ id: `${playerId}-${minute}`, type: "goal", minute, teamId, playerId, playerName, ...extra }) as Evt;

const feuille = [{ playerId: "p1", name: "Joueur" }] as unknown as LineupEntry[];

function match(id: string, m: Partial<CompMatch> & { events?: Evt[] } = {}): CompMatch {
  const { events, ...reste } = m;
  return {
    id, competitionId: "c1", stage: "group", group: "A", round: null, bracketSlot: null,
    homeSource: null, awaySource: null,
    homeTeamId: "H", awayTeamId: "A", homeTeamName: "Domicile", awayTeamName: "Extérieur",
    homeTeamLogo: null, awayTeamLogo: null, bannerUrl: null,
    date: "2026-10-16", time: "16:30", venueName: null, venueCity: null, venueId: null, venueBooking: null,
    status: "scheduled", scoreHome: null, scoreAway: null, penaltyHome: null, penaltyAway: null,
    winnerTeamId: null, journee: null, forfeitByTeamId: null, feedsIntoMatchId: null, feedsIntoSlot: null,
    homeLineup: feuille, awayLineup: feuille, homeLineupReady: true, awayLineupReady: true,
    homeOnPitch: [], awayOnPitch: [],
    liveState: events ? ({ events } as unknown as CompMatch["liveState"]) : null,
    createdAt: "", updatedAt: "",
    ...reste,
  } as CompMatch;
}

const joue = (id: string, h: number, a: number, m: Partial<CompMatch> & { events?: Evt[] } = {}) =>
  match(id, { status: "completed", scoreHome: h, scoreAway: a, ...m });

const ids = (c: ReturnType<typeof calendrierDeCompetition>) => c.jours.map((j) => j.lignes.map((l) => l.id));

console.log("L'ordre");

cas("jour par jour, puis à l'heure", () => {
  const c = calendrierDeCompetition([
    match("m3", { date: "2026-10-17", time: "15:00" }),
    match("m2", { date: "2026-10-16", time: "17:30" }),
    match("m1", { date: "2026-10-16", time: "16:30" }),
  ], 45);
  assert.deepEqual(ids(c), [["m1", "m2"], ["m3"]]);
  assert.deepEqual(c.jours.map((j) => j.titre), ["Vendredi 16 octobre", "Samedi 17 octobre"]);
});

cas("à la même heure, les poules avant la phase finale, et dans l'ordre des poules", () => {
  const c = calendrierDeCompetition([
    match("k", { stage: "knockout", group: null, round: "quarter", bracketSlot: 1 }),
    match("b", { group: "B" }),
    match("a", { group: "A" }),
  ], 45);
  assert.deepEqual(ids(c), [["a", "b", "k"]]);
});

cas("un match sans heure passe après ceux de son jour", () => {
  const c = calendrierDeCompetition([match("sans", { time: null }), match("avec", { time: "18:00" })], 45);
  assert.deepEqual(ids(c), [["avec", "sans"]]);
});

cas("les matchs sans date à la fin, sous « Date à fixer »", () => {
  const c = calendrierDeCompetition([match("x", { date: null, time: null }), match("y")], 45);
  assert.deepEqual(ids(c), [["y"], ["x"]]);
  assert.equal(c.jours[1].date, null);
  assert.equal(c.jours[1].titre, "Date à fixer");
});

cas("un match annulé n'y figure pas", () => {
  const c = calendrierDeCompetition([match("ok"), match("annule", { status: "cancelled" })], 45);
  assert.deepEqual(ids(c), [["ok"]]);
});

console.log("\nLa ligne d'un match");

cas("la phase : poule, tour de phase finale, exhibition", () => {
  const c = calendrierDeCompetition([
    match("p", { group: "B" }),
    match("d", { stage: "knockout", group: null, round: "semi", time: "17:00" }),
    match("f", { stage: "knockout", group: null, round: null, time: "18:00" }),
    match("x", { stage: "exhibition", group: null, time: "19:00" }),
  ], 45);
  assert.deepEqual(c.jours[0].lignes.map((l) => l.phase), ["Poule B", "Demi-finale", "Phase finale", "Exhibition"]);
});

cas("une place de phase finale pas encore attribuée se dit par sa provenance", () => {
  const l = calendrierDeCompetition([match("k", {
    stage: "knockout", group: null, round: "semi", homeTeamId: null, homeTeamName: "",
    homeSource: { kind: "group_rank", group: "B", rank: 1 }, awayTeamId: null, awayTeamName: "",
  })], 45).jours[0].lignes[0];
  assert.deepEqual([l.domicile.nom, l.domicile.enAttente], ["1er poule B", true]);
  assert.deepEqual([l.exterieur.nom, l.exterieur.enAttente], ["À déterminer", true]);
});

cas("à venir : ni score ni buteurs, l'heure et le terrain", () => {
  const l = calendrierDeCompetition([match("m", { venueName: "UL - Terrain 1", venueCity: "Lomé" })], 45).jours[0].lignes[0];
  assert.equal(l.etat, "a_venir");
  assert.equal(l.score, null);
  assert.equal(l.lieu, "UL - Terrain 1, Lomé");
  assert.deepEqual([l.domicile.buteurs, l.exterieur.buteurs], [[], []]);
});

cas("joué : le score, et les buteurs de chaque camp groupés par joueur", () => {
  const l = calendrierDeCompetition([joue("m", 3, 1, { events: [
    but("H", "k", "Kossi", 12), but("A", "m", "Mawuli", 18), but("H", "k", "Kossi", 34), but("H", "e", "Edem", 40),
  ] })], 45).jours[0].lignes[0];
  assert.equal(l.etat, "joue");
  assert.deepEqual(l.score, [3, 1]);
  assert.deepEqual(l.domicile.buteurs, ["Kossi 12', 34'", "Edem 40'"]);
  assert.deepEqual(l.exterieur.buteurs, ["Mawuli 18'"]);
});

cas("les tirs au but et le forfait", () => {
  const [tab, forfait] = calendrierDeCompetition([
    joue("tab", 1, 1, { penaltyHome: 4, penaltyAway: 3 }),
    joue("forfait", 3, 0, { forfeitByTeamId: "A", time: "18:00" }),
  ], 45).jours[0].lignes;
  assert.deepEqual(tab.tab, [4, 3]);
  assert.equal(tab.forfait, null);
  assert.equal(forfait.forfait, "exterieur");
  assert.equal(forfait.tab, null);
});

cas("en cours : le score du moment", () => {
  const l = calendrierDeCompetition([match("m", { status: "live", scoreHome: 1, scoreAway: 0 })], 45).jours[0].lignes[0];
  assert.equal(l.etat, "en_cours");
  assert.deepEqual(l.score, [1, 0]);
});

cas("les comptes : joués, et ce qui reste à jouer", () => {
  const c = calendrierDeCompetition([joue("a", 1, 0), match("b"), match("c", { status: "live", scoreHome: 0, scoreAway: 0 })], 45);
  assert.deepEqual([c.joues, c.aVenir], [1, 2]);
});

console.log("\nLe libellé d'un buteur");

cas("ses minutes à la suite", () =>
  assert.equal(libelleButeur({ nom: "Kossi", minutes: ["12'", "34'"], nombre: 2, csc: false, passeurs: [] }), "Kossi 12', 34'"));
cas("sans minutes, le nombre de buts", () =>
  assert.equal(libelleButeur({ nom: "Kossi", minutes: [], nombre: 2, csc: false, passeurs: [] }), "Kossi ×2"));
cas("un seul but sans minute : le nom seul", () =>
  assert.equal(libelleButeur({ nom: "Kossi", minutes: [], nombre: 1, csc: false, passeurs: [] }), "Kossi"));
cas("contre son camp, signalé", () =>
  assert.equal(libelleButeur({ nom: "Kossi", minutes: ["40'"], nombre: 1, csc: true, passeurs: [] }), "Kossi (csc) 40'"));

console.log("\nLes matchs sans feuille de match");

cas("un camp qui a marqué sans feuille : étoile", () => {
  const c = calendrierDeCompetition([joue("m", 2, 0, { homeLineup: [] })], 45);
  assert.equal(c.jours[0].lignes[0].sansFeuille, true);
  assert.equal(c.sansFeuille, 1);
});

cas("le camp sans feuille n'a pas marqué : rien à douter de ses buteurs", () => {
  assert.equal(calendrierDeCompetition([joue("m", 2, 0, { awayLineup: [] })], 45).jours[0].lignes[0].sansFeuille, false);
});

cas("un buteur au dossard, feuille de secours : étoile", () => {
  const l = calendrierDeCompetition([joue("m", 1, 0, { events: [but("H", "dos-H-7", "N°7", 40)] })], 45).jours[0].lignes[0];
  assert.equal(l.sansFeuille, true);
  assert.deepEqual(l.domicile.buteurs, ["N°7 40'"]);
});

cas("deux feuilles et des buteurs nommés : pas d'étoile", () => {
  const c = calendrierDeCompetition([joue("m", 1, 0, { events: [but("H", "k", "Kossi", 12)] })], 45);
  assert.equal(c.jours[0].lignes[0].sansFeuille, false);
  assert.equal(c.sansFeuille, 0);
});

cas("un forfait ou un 0-0 n'ont pas de buteurs à douter", () => {
  const c = calendrierDeCompetition([
    joue("f", 3, 0, { forfeitByTeamId: "A", homeLineup: [], awayLineup: [] }),
    joue("z", 0, 0, { homeLineup: [], awayLineup: [], time: "18:00" }),
  ], 45);
  assert.deepEqual(c.jours[0].lignes.map((l) => l.sansFeuille), [false, false]);
});

cas("un match à venir sans feuille n'est pas marqué", () => {
  assert.equal(calendrierDeCompetition([match("m", { homeLineup: [], awayLineup: [] })], 45).jours[0].lignes[0].sansFeuille, false);
});

cas("la journée suit la poule", () => {
  const c = calendrierDeCompetition([match("m", { journee: 2, group: "B" })], 45);
  assert.equal(c.jours[0].lignes[0].phase, "Poule B · Journée 2");
});

cas("sans journée, la poule seule", () => {
  assert.equal(calendrierDeCompetition([match("m", { group: "B" })], 45).jours[0].lignes[0].phase, "Poule B");
});

cas("chaque camp garde l'adresse de son écusson, un camp sans écusson n'en a pas", () => {
  const c = calendrierDeCompetition([match("m", { homeTeamLogo: "https://x/h.png" })], 45);
  assert.equal(c.jours[0].lignes[0].domicile.logo, "https://x/h.png");
  assert.equal(c.jours[0].lignes[0].exterieur.logo, null);
});

cas("une place de phase finale pas encore attribuée n'a pas d'écusson", () => {
  const c = calendrierDeCompetition([match("m", {
    stage: "knockout", group: null, round: "semi", homeTeamId: null, homeTeamName: "", homeTeamLogo: "https://x/vieux.png",
  })], 45);
  assert.equal(c.jours[0].lignes[0].domicile.enAttente, true);
  assert.equal(c.jours[0].lignes[0].domicile.logo, null);
});

if (echecs > 0) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout passe.");
