/**
 * KOPPAFOOT — Vérification des calculs purs du gardien : qui est dans les
 * cages, quand les gants changent de main, ce qu'il encaisse, et ce que la
 * note, le classement et le retrait d'un événement en font. Aucune base,
 * aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-gardiens.ts
 */
import assert from "node:assert/strict";
import {
  bilanDesGardiens, gardienDeDepart, gardienEnPlace, gardienExige, gardienPropose,
  peutPrendreLesGants, regleDuGardienDesigne, type FaitDeGardien,
} from "@/lib/gardiens";
import { calculerClassements, type MatchAClasser } from "@/lib/classement";
import { notesDuCamp } from "@/lib/notes";
import { DETAIL_SECOND_JAUNE, planDuRetrait } from "@/lib/retrait-evenement";
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

// Deux equipes fictives : A a domicile, B a l'exterieur.
const ligne = (playerId: string, role: "starter" | "substitute", position: LineupEntry["position"] = null): LineupEntry =>
  ({ playerId, name: playerId, number: "", role, position });

const feuilleA: LineupEntry[] = [
  ligne("gA2", "substitute", "goalkeeper"),
  ligne("gA", "starter", "goalkeeper"),
  ligne("c1", "starter"),
  ligne("c2", "starter"),
  ligne("c3", "substitute"),
];

const fait = (f: FaitDeGardien): FaitDeGardien => f;
const rempl = (minute: number, entre: string, sort: string, teamId = "A") =>
  fait({ type: "substitution", minute, teamId, playerId: entre, outPlayerId: sort });
const but = (minute: number, teamId: string, detail?: string) =>
  fait({ type: "goal", minute, teamId, playerId: "x", detail });

console.log("La règle du gardien désigné");

cas("absente tant que le match ne dit rien", () => {
  assert.equal(regleDuGardienDesigne(null), false);
  assert.equal(regleDuGardienDesigne(undefined), false);
  assert.equal(regleDuGardienDesigne({}), false);
});

cas("présente dès que le lancement a écrit la case, cochée ou non", () => {
  assert.equal(regleDuGardienDesigne({ sansGardien: false }), true);
  assert.equal(regleDuGardienDesigne({ sansGardien: true }), true);
});

console.log("\nLe gardien au coup d'envoi");

cas("un titulaire, jamais le gardien resté sur le banc", () => {
  assert.equal(gardienDeDepart(feuilleA)?.playerId, "gA");
});

cas("personne quand aucun titulaire n'est au poste", () => {
  assert.equal(gardienDeDepart([ligne("c1", "starter"), ligne("gA2", "substitute", "goalkeeper")]), null);
});

console.log("\nQui est dans les cages");

cas("le gardien de la feuille, sans rien d'autre", () => {
  assert.deepEqual(gardienEnPlace(feuilleA, [], "A"), { playerId: "gA", source: "feuille" });
});

cas("celui qui entre à la place du gardien devient gardien", () => {
  assert.deepEqual(gardienEnPlace(feuilleA, [rempl(50, "gA2", "gA")], "A"), { playerId: "gA2", source: "remplacement" });
});

cas("le gardien expulsé laisse les cages vides", () => {
  assert.equal(gardienEnPlace(feuilleA, [fait({ type: "red_card", minute: 30, teamId: "A", playerId: "gA" })], "A"), null);
});

cas("le gardien sorti sans remplaçant aussi", () => {
  assert.equal(gardienEnPlace(feuilleA, [fait({ type: "sortie", minute: 30, teamId: "A", playerId: "gA" })], "A"), null);
});

cas("un joueur de champ expulsé ne change rien au but", () => {
  assert.deepEqual(
    gardienEnPlace(feuilleA, [fait({ type: "red_card", minute: 30, teamId: "A", playerId: "c1" })], "A"),
    { playerId: "gA", source: "feuille" },
  );
});

cas("le joueur qui prend les gants devient gardien", () => {
  const faits = [
    fait({ type: "red_card", minute: 30, teamId: "A", playerId: "gA" }),
    fait({ type: "gants", minute: 31, teamId: "A", playerId: "c1" }),
  ];
  assert.deepEqual(gardienEnPlace(feuilleA, faits, "A"), { playerId: "c1", source: "gants" });
});

cas("le dépanneur remplacé passe les gants à celui qui entre", () => {
  const faits = [
    fait({ type: "red_card", minute: 30, teamId: "A", playerId: "gA" }),
    fait({ type: "gants", minute: 31, teamId: "A", playerId: "c1" }),
    rempl(40, "c3", "c1"),
  ];
  assert.deepEqual(gardienEnPlace(feuilleA, faits, "A"), { playerId: "c3", source: "remplacement" });
});

cas("les faits de l'autre équipe ne comptent pas", () => {
  assert.deepEqual(
    gardienEnPlace(feuilleA, [fait({ type: "red_card", minute: 30, teamId: "B", playerId: "gA" })], "A"),
    { playerId: "gA", source: "feuille" },
  );
});

console.log("\nQui peut prendre les gants");

cas("tout le monde, quand personne n'est au but", () => {
  assert.equal(peutPrendreLesGants(null, "c1"), true);
});

cas("les autres, quand un dépanneur les tient", () => {
  const depanneur = { playerId: "c1", source: "gants" as const };
  assert.equal(peutPrendreLesGants(depanneur, "c2"), true);
  assert.equal(peutPrendreLesGants(depanneur, "c1"), false);
});

cas("personne, quand le gardien de la feuille est en place", () => {
  assert.equal(peutPrendreLesGants({ playerId: "gA", source: "feuille" }, "c1"), false);
  assert.equal(peutPrendreLesGants({ playerId: "gA2", source: "remplacement" }, "c1"), false);
});

console.log("\nCe que chaque gardien a encaissé, et combien de temps");

cas("le remplaçant a ses propres chiffres", () => {
  const faits = [
    but(20, "B"),
    rempl(50, "gA2", "gA"),
    but(70, "A", "csc"),
    // Un csc de l'autre equipe est un but POUR A, pas contre.
    but(80, "B", "csc"),
  ];
  assert.deepEqual(bilanDesGardiens(feuilleA, faits, "A", 90), [
    { playerId: "gA", minutes: 50, encaisses: 1 },
    { playerId: "gA2", minutes: 40, encaisses: 1 },
  ]);
});

cas("les cages vides : le but ne va à personne", () => {
  const faits = [
    fait({ type: "red_card", minute: 30, teamId: "A", playerId: "gA" }),
    but(30, "B"),
    fait({ type: "gants", minute: 31, teamId: "A", playerId: "c1" }),
    but(60, "B"),
  ];
  assert.deepEqual(bilanDesGardiens(feuilleA, faits, "A", 90), [
    { playerId: "gA", minutes: 30, encaisses: 0 },
    { playerId: "c1", minutes: 59, encaisses: 1 },
  ]);
});

console.log("\nLe gardien d'une feuille en préparation");

cas("le titulaire au poste gardien est proposé d'office", () => {
  assert.equal(gardienPropose([{ id: "c1" }, { id: "gA", position: "Gardien" }], undefined), "gA");
});

cas("le choix du scoreur l'emporte, tant qu'il est titulaire", () => {
  const titulaires = [{ id: "c1" }, { id: "gA", position: "Gardien" }];
  assert.equal(gardienPropose(titulaires, "c1"), "c1");
  assert.equal(gardienPropose(titulaires, null), null);
  assert.equal(gardienPropose(titulaires, "x"), null);
});

cas("l'adversaire hors plateforme est dispensé de gardien", () => {
  assert.equal(gardienExige("", false), false);
  assert.equal(gardienExige(null, false), false);
  assert.equal(gardienExige("A", true), false);
  assert.equal(gardienExige("A", false), true);
});

// ---- La note et le classement ------------------------------------------------

type Evenement = NonNullable<CompMatch["liveState"]>["events"][number];
const evt = (f: FaitDeGardien): Evenement =>
  ({ id: Math.random().toString(36).slice(2), period: 1, createdAt: "", ...f }) as Evenement;

/** Un match chronométré de 90 minutes, A contre B. */
function matchJoue(
  faits: FaitDeGardien[],
  sansGardien: boolean | undefined,
  score = { home: 0, away: 0 },
  lineup: LineupEntry[] = feuilleA,
): MatchAClasser {
  return {
    id: "m1", competitionId: "c1", homeTeamId: "A", awayTeamId: "B",
    homeTeamName: "LES PALMIERS FC", awayTeamName: "AS LAGUNE",
    date: "2026-10-23", time: "16:00", scoreHome: score.home, scoreAway: score.away, status: "completed",
    homeLineup: lineup, awayLineup: [], homeOnPitch: [], awayOnPitch: [],
    dureeMatchMin: 90,
    liveState: {
      currentPeriod: 4, timerStartAt: null, timerOffset: 90 * 60_000, isTimerRunning: false,
      events: faits.map(evt),
      ...(sansGardien === undefined ? {} : { sansGardien }),
    },
  } as unknown as MatchAClasser;
}
const notesDe = (m: MatchAClasser) => notesDuCamp(m, m.homeLineup, m.liveState!.events, "A", 90);

console.log("\nLa note du gardien");

cas("sans gardien : personne ne prend les buts encaissés", () => {
  // Le titulaire au poste en tete de feuille : l'ancienne regle le
  // penaliserait.
  const feuille = [ligne("gA", "starter", "goalkeeper"), ligne("c1", "starter")];
  const n = notesDe(matchJoue([but(20, "B"), but(60, "B")], true, { home: 0, away: 2 }, feuille)).get("gA");
  assert.equal(n?.note, 6);
  assert.equal(n?.faits, 0);
});

cas("avec gardien : chacun ses buts, le remplaçant sans prime avant 60 minutes", () => {
  const notes = notesDe(matchJoue([but(10, "B"), but(20, "B"), rempl(50, "gA2", "gA")], false));
  assert.equal(notes.get("gA")?.note, 5.3);
  assert.equal(notes.get("gA2")?.note, 6);
});

cas("avec gardien : 90 minutes sans encaisser valent la prime", () => {
  assert.equal(notesDe(matchJoue([], false)).get("gA")?.note, 6.5);
});

cas("un match d'avant la case garde l'ancienne règle", () => {
  // L'ancien chemin prend la premiere ligne au poste — ici le gardien du
  // banc —, et le titulaire n'est pas touche. C'est l'existant, fige.
  assert.equal(notesDe(matchJoue([but(20, "B")], undefined)).get("gA")?.note, 6);
});

console.log("\nLe classement des gardiens");

const ligneDe = (c: ReturnType<typeof calculerClassements>, nom: string) =>
  c.parContribution.find((l) => l.nom === nom);

// Le classement par contribution ne montre que ceux qui ont marque ou servi :
// chacun des deux gardiens donne donc une passe decisive, pour etre lisible.
const servi = (minute: number, passeur: string): FaitDeGardien & { assistPlayerId: string } =>
  ({ type: "goal", minute, teamId: "A", playerId: "c1", assistPlayerId: passeur });
const passesDesGardiens = [servi(5, "gA"), servi(6, "gA2")];
const deuxZero = { home: 2, away: 0 };

cas("le gardien resté sur le banc ne compte plus", () => {
  const c = calculerClassements([matchJoue(passesDesGardiens, false, deuxZero)]);
  assert.equal(ligneDe(c, "gA")?.cleanSheets, 1);
  assert.equal(ligneDe(c, "gA2")?.cleanSheets, 0);
  assert.equal(ligneDe(c, "gA2")?.gardien, false);
});

cas("deux gardiens sans encaisser dans le même match : deux clean sheets", () => {
  const c = calculerClassements([matchJoue([...passesDesGardiens, rempl(50, "gA2", "gA")], false, deuxZero)]);
  assert.equal(ligneDe(c, "gA")?.cleanSheets, 1);
  assert.equal(ligneDe(c, "gA2")?.cleanSheets, 1);
});

cas("sans gardien : aucun clean sheet", () => {
  const c = calculerClassements([matchJoue(passesDesGardiens, true, deuxZero)]);
  assert.equal(ligneDe(c, "gA")?.cleanSheets, 0);
  assert.equal(ligneDe(c, "gA2")?.cleanSheets, 0);
});

console.log("\nRetirer l'exclusion du gardien");

const avecId = (id: string, f: FaitDeGardien): Evenement => ({ ...evt(f), id });
const pelouseA = ["c1", "c2"];
const contexteDuRetrait = (lineups?: boolean) => ({
  homeTeamId: "A",
  surLeTerrain: { home: pelouseA, away: [] },
  ...(lineups ? { lineups: { home: feuilleA, away: [] } } : {}),
});

cas("le rouge du gardien annulé emporte la prise de gants qui a suivi", () => {
  const events = [
    avecId("r1", { type: "red_card", minute: 30, teamId: "A", playerId: "gA" }),
    avecId("g1", { type: "gants", minute: 31, teamId: "A", playerId: "c1" }),
  ];
  const r = planDuRetrait(events, "r1", contexteDuRetrait(true));
  assert.ok(r.ok);
  assert.deepEqual([...r.plan.ids].sort(), ["g1", "r1"]);
  assert.ok(r.plan.surLeTerrain.home?.includes("gA"));
});

cas("le rouge d'un joueur de champ n'emporte rien d'autre", () => {
  const events = [
    avecId("r1", { type: "red_card", minute: 30, teamId: "A", playerId: "c2" }),
    avecId("g1", { type: "gants", minute: 31, teamId: "A", playerId: "c1" }),
  ];
  const r = planDuRetrait(events, "r1", contexteDuRetrait(true));
  assert.ok(r.ok);
  assert.deepEqual(r.plan.ids, ["r1"]);
});

cas("sans les feuilles, le retrait reste celui d'avant", () => {
  const events = [
    avecId("r1", { type: "red_card", minute: 30, teamId: "A", playerId: "gA" }),
    avecId("g1", { type: "gants", minute: 31, teamId: "A", playerId: "c1" }),
  ];
  const r = planDuRetrait(events, "r1", contexteDuRetrait(false));
  assert.ok(r.ok);
  assert.deepEqual(r.plan.ids, ["r1"]);
});

cas("le second jaune du gardien retiré emporte son rouge et la prise de gants", () => {
  const events = [
    avecId("j1", { type: "yellow_card", minute: 20, teamId: "A", playerId: "gA" }),
    avecId("j2", { type: "yellow_card", minute: 30, teamId: "A", playerId: "gA" }),
    { ...avecId("r2", { type: "red_card", minute: 30, teamId: "A", playerId: "gA" }), detail: DETAIL_SECOND_JAUNE },
    avecId("g1", { type: "gants", minute: 31, teamId: "A", playerId: "c1" }),
  ];
  const r = planDuRetrait(events, "j2", contexteDuRetrait(true));
  assert.ok(r.ok);
  assert.deepEqual([...r.plan.ids].sort(), ["g1", "j2", "r2"]);
});

if (echecs > 0) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
