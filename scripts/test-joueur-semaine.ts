/**
 * KOPPAFOOT — Vérification du joueur de la semaine (lib/joueur-semaine). Aucune
 * base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-joueur-semaine.ts
 */
import assert from "node:assert/strict";
import {
  classerLaSemaine, detailDePerformance, jourCourt, semaineDu, semainePrecedente,
  type MatchDeLaSemaine,
} from "@/lib/joueur-semaine";
import type { CompMatch } from "@/types";

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

type Evenement = NonNullable<CompMatch["liveState"]>["events"][number];

function evt(e: Partial<Evenement> & { teamId: string }): Evenement {
  return {
    id: Math.random().toString(36).slice(2),
    type: "goal", period: 0, minute: 0, createdAt: "",
    ...e,
  } as Evenement;
}

const enDirect = { currentPeriod: 4, timerStartAt: null, timerOffset: 50 * 60_000, isTimerRunning: false };
const apresCoup = { currentPeriod: 4, timerStartAt: null, timerOffset: 0, isTimerRunning: false };

function match(m: Partial<MatchDeLaSemaine>): MatchDeLaSemaine {
  return {
    id: "m1", competitionId: "c1", competitionNom: "G2 ÉDITION 2026",
    homeTeamId: "A", awayTeamId: "B", homeTeamName: "PRAISE FC", awayTeamName: "FC LION",
    homeTeamLogo: null, awayTeamLogo: "lion.png",
    date: "2026-10-18", time: "16:00", scoreHome: 0, scoreAway: 0, status: "completed",
    forfeitByTeamId: null, stage: "group",
    homeLineup: [], awayLineup: [], homeOnPitch: [], awayOnPitch: [],
    liveState: { ...apresCoup, events: [] },
    comptesDesLignes: {},
    ...m,
  } as unknown as MatchDeLaSemaine;
}

const ligne = (playerId: string, name = playerId, userId: string | null = null) =>
  ({ playerId, name, number: "", role: "starter" as const, userId });

const S = semaineDu("2026-10-18");
const aucune = new Set<string>();

// Le cas G2 du 18 octobre : PRAISE FC 0-4 FC LION, saisi le lendemain, FC
// LION sans feuille.
const g2 = () => match({
  scoreHome: 0, scoreAway: 4,
  homeLineup: [ligne("praise1"), ligne("praise2")],
  liveState: {
    ...apresCoup,
    events: [
      evt({ teamId: "B", playerId: "amegan", playerName: "AMEGAN Kodjo" }),
      evt({ teamId: "B", playerId: "ayite", playerName: "AYITE Komi" }),
      evt({ teamId: "B", playerId: "amegan", playerName: "AMEGAN Kodjo" }),
      evt({ teamId: "B", playerId: "woayi", playerName: "WOAYI Sena" }),
    ],
  } as CompMatch["liveState"],
});

console.log("La semaine");

cas("du lundi au dimanche, numéro ISO", () => {
  assert.deepEqual(semaineDu("2026-10-18"), { lundi: "2026-10-12", dimanche: "2026-10-18", numero: 42 });
  assert.deepEqual(semaineDu("2026-10-12"), { lundi: "2026-10-12", dimanche: "2026-10-18", numero: 42 });
});

cas("la dernière semaine terminée, vue d'un lundi", () => {
  assert.equal(semainePrecedente("2026-10-19").lundi, "2026-10-12");
});

cas("les numéros de semaine aux bords de l'année", () => {
  assert.equal(semaineDu("2026-01-01").numero, 1);
  assert.equal(semaineDu("2027-01-01").numero, 53);
});

cas("le jour court d'une ligne", () => {
  assert.equal(jourCourt("2026-10-18"), "DIM. 18 OCT.");
  assert.equal(jourCourt("2026-02-03"), "MAR. 3 FÉVR.");
});

cas("la performance en détail", () => {
  assert.equal(detailDePerformance(2, 0), "2 BUTS");
  assert.equal(detailDePerformance(1, 1), "1 BUT · 1 PASSE");
  assert.equal(detailDePerformance(0, 2), "2 PASSES");
  assert.equal(detailDePerformance(0, 0), "");
});

console.log("\nLe classement");

cas("le doublé d'AMEGAN, premier, sa ligne vue de son équipe", () => {
  const c = classerLaSemaine([g2()], S, aucune);
  const premier = c.candidats[0];
  assert.equal(premier.nom, "AMEGAN Kodjo");
  assert.equal(premier.buts, 2);
  assert.equal(premier.note, null);
  assert.equal(premier.matchs.length, 1);
  assert.equal(premier.matchs[0].affiche, "FC LION 4–0 PRAISE FC");
  assert.equal(premier.matchs[0].competition, "G2 ÉDITION 2026");
  assert.equal(premier.matchs[0].equipe, "FC LION");
  assert.equal(premier.matchs[0].ecusson, "lion.png");
  assert.equal(premier.matchs[0].jour, "DIM. 18 OCT.");
});

cas("hors de la semaine, rien ne compte", () => {
  const c = classerLaSemaine([g2()].map((m, i) => ({ ...m, id: `m${i}`, date: "2026-10-11" }))
    .concat({ ...g2(), id: "m9", date: "2026-10-19" }), S, aucune);
  assert.equal(c.candidats.length, 0);
  assert.equal(c.competitions.length, 0);
});

cas("une compétition écartée sort des candidats, pas de la liste des compétitions", () => {
  const c = classerLaSemaine([g2()], S, new Set(["c1"]));
  assert.equal(c.candidats.length, 0);
  assert.deepEqual(c.competitions, [{ id: "c1", nom: "G2 ÉDITION 2026", matchs: 1 }]);
});

cas("un forfait ne compte pas", () => {
  const c = classerLaSemaine([{ ...g2(), forfeitByTeamId: "A" }], S, aucune);
  assert.equal(c.candidats.length, 0);
});

cas("un dossard qui marque est écarté, et signalé", () => {
  const m = match({
    liveState: { ...apresCoup, events: [1, 2, 3, 4].map(() => evt({ teamId: "B", playerId: "dos-B-11", playerName: "N°11" })) } as CompMatch["liveState"],
  });
  const c = classerLaSemaine([m], S, aucune);
  assert.equal(c.candidats.length, 0);
  assert.deepEqual(c.dossards, [{ equipe: "FC LION", nom: "N°11", buts: 4, passes: 0 }]);
});

cas("deux homonymes sans compte, de deux équipes, restent deux joueurs", () => {
  const m1 = match({ id: "m1", date: "2026-10-14", homeLineup: [ligne("k1", "Kossi")], liveState: { ...enDirect, events: [evt({ teamId: "A", playerId: "k1" })] } as CompMatch["liveState"] });
  const m2 = match({ id: "m2", date: "2026-10-16", homeTeamId: "C", homeTeamName: "AS BÈ", homeLineup: [ligne("k2", "Kossi")], liveState: { ...enDirect, events: [evt({ teamId: "C", playerId: "k2" })] } as CompMatch["liveState"] });
  const kossi = classerLaSemaine([m1, m2], S, aucune).candidats.filter((x) => x.nom === "Kossi");
  assert.equal(kossi.length, 2);
});

cas("un même compte dans deux équipes réunit ses matchs, dans l'ordre des dates", () => {
  const m2 = match({ id: "m2", date: "2026-10-16", homeTeamId: "C", homeTeamName: "AS BÈ", homeLineup: [ligne("x2", "Komlan", "u1")], liveState: { ...enDirect, events: [] } as CompMatch["liveState"] });
  const m1 = match({ id: "m1", date: "2026-10-14", homeLineup: [ligne("x1", "Komlan", "u1")], liveState: { ...enDirect, events: [] } as CompMatch["liveState"] });
  const komlan = classerLaSemaine([m2, m1], S, aucune).candidats.filter((x) => x.uid === "u1");
  assert.equal(komlan.length, 1);
  assert.deepEqual(komlan[0].matchs.map((l) => l.matchId), ["m1", "m2"]);
  assert.deepEqual(komlan[0].matchs.map((l) => l.equipe), ["PRAISE FC", "AS BÈ"]);
});

cas("deux buts sans note passent devant un but noté", () => {
  const note = match({ id: "m2", date: "2026-10-15", homeLineup: [ligne("p1", "Noté")], liveState: { ...enDirect, events: [evt({ teamId: "A", playerId: "p1" })] } as CompMatch["liveState"] });
  const c = classerLaSemaine([g2(), note], S, aucune);
  assert.equal(c.candidats[0].nom, "AMEGAN Kodjo");
  const n = c.candidats.find((x) => x.nom === "Noté");
  assert.ok(n && n.note !== null && n.note > 6);
});

cas("à buts et passes égaux, le noté passe devant", () => {
  const note = match({ id: "m2", date: "2026-10-15", homeLineup: [ligne("p1", "Zoé")], liveState: { ...enDirect, events: [evt({ teamId: "A", playerId: "p1" })] } as CompMatch["liveState"] });
  const sans = match({ id: "m3", date: "2026-10-15", liveState: { ...apresCoup, events: [evt({ teamId: "B", playerId: "a1", playerName: "Abla" })] } as CompMatch["liveState"] });
  const noms = classerLaSemaine([sans, note], S, aucune).candidats.map((x) => x.nom);
  assert.ok(noms.indexOf("Zoé") < noms.indexOf("Abla"));
});

cas("un amical s'écrit « MATCH AMICAL »", () => {
  const m = match({ competitionId: "friendly", competitionNom: "MATCH AMICAL", amical: true, comptesDesLignes: undefined, homeLineup: [ligne("u9", "Yao", "u9")], liveState: { ...enDirect, events: [evt({ teamId: "A", playerId: "u9" })] } as CompMatch["liveState"] });
  const c = classerLaSemaine([m], S, aucune);
  assert.equal(c.candidats[0].matchs[0].competition, "MATCH AMICAL");
});

cas("les buteurs déclarés d'un amical renseigné vont à l'équipe qui l'a saisi", () => {
  const m = match({
    competitionId: "friendly", competitionNom: "MATCH AMICAL", amical: true, comptesDesLignes: undefined,
    campDesContributions: "away",
    contributionsDirectes: [{ playerId: "u7", nom: "Edem", userId: "u7", buts: 3, passes: 0 }],
  });
  const edem = classerLaSemaine([m], S, aucune).candidats[0];
  assert.equal(edem.buts, 3);
  assert.equal(edem.matchs[0].equipe, "FC LION");
  assert.equal(edem.matchs[0].affiche, "FC LION 0–0 PRAISE FC");
});

cas("une semaine vide", () => {
  const c = classerLaSemaine([], S, aucune);
  assert.equal(c.candidats.length, 0);
  assert.equal(c.competitions.length, 0);
  assert.equal(c.dossards.length, 0);
});

if (echecs > 0) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout passe.");
