/**
 * KOPPAFOOT — Vérification des matchs « chauds » : les suggestions
 * (lib/chauds) et leur place en tête de l'accueil Direct (lib/direct-shared).
 * Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-chauds.ts
 */
import assert from "node:assert/strict";
import { CHAUDS_PAR_COMPETITION, chaudsAVenir, peutMarquerChaud, suggererChocs } from "@/lib/chauds";
import { chaudsEnTete, type Entry } from "@/lib/direct-shared";
import type { Competition, CompMatch } from "@/types";

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

function match(id: string, m: Partial<CompMatch> = {}): CompMatch {
  return {
    id, competitionId: "c1", stage: "group", group: "A", round: null, bracketSlot: null,
    homeSource: null, awaySource: null,
    homeTeamId: "H", awayTeamId: "A", homeTeamName: "Domicile", awayTeamName: "Extérieur",
    homeTeamLogo: null, awayTeamLogo: null, bannerUrl: null,
    date: "2026-11-01", time: "16:00", venueName: null, venueCity: null, venueId: null, venueBooking: null,
    status: "scheduled", scoreHome: null, scoreAway: null, penaltyHome: null, penaltyAway: null,
    winnerTeamId: null, journee: null, chaud: false, forfeitByTeamId: null, feedsIntoMatchId: null, feedsIntoSlot: null,
    homeLineup: [], awayLineup: [], homeLineupReady: true, awayLineupReady: true,
    homeOnPitch: [], awayOnPitch: [], liveState: null, createdAt: "", updatedAt: "",
    ...m,
  } as CompMatch;
}

/** Un match joué entre deux équipes, à une date passée. */
let n = 0;
const joue = (dom: string, ext: string, sd: number, se: number, date = "2026-10-01") =>
  match(`j${n++}`, { homeTeamId: dom, awayTeamId: ext, status: "completed", scoreHome: sd, scoreAway: se, date });

const AUJOURDHUI = "2026-10-22";

console.log("suggererChocs");

// L1 et L2 gagnent tout, M1 et M2 font des nuls, F1 et F2 perdent tout.
const passe = [
  joue("L1", "F1", 2, 0), joue("L1", "F2", 3, 1), joue("L2", "F1", 1, 0), joue("L2", "F2", 2, 0),
  joue("M1", "M2", 1, 1), joue("M1", "M2", 0, 0),
];

cas("deux équipes en forme passent devant une équipe en feu contre une lanterne rouge", () => {
  const r = suggererChocs([
    ...passe,
    match("feu-contre-lanterne", { homeTeamId: "L1", awayTeamId: "F1", date: "2026-10-25" }),
    match("deux-en-forme", { homeTeamId: "L1", awayTeamId: "L2", date: "2026-11-08" }),
    match("deux-moyens", { homeTeamId: "M1", awayTeamId: "M2", date: "2026-10-26" }),
  ], AUJOURDHUI);
  assert.deepEqual(r.map((s) => s.match.id), ["deux-en-forme", "deux-moyens", "feu-contre-lanterne"]);
  assert.equal(r[0].forme, 3);
});

cas("à forme égale, le match le plus proche d'abord ; sans date, après", () => {
  const r = suggererChocs([
    ...passe,
    match("sans-date", { homeTeamId: "L1", awayTeamId: "L2", date: null }),
    match("loin", { homeTeamId: "L2", awayTeamId: "L1", date: "2026-11-30" }),
    match("proche", { homeTeamId: "L1", awayTeamId: "L2", date: "2026-10-24" }),
  ], AUJOURDHUI);
  assert.deepEqual(r.map((s) => s.match.id), ["proche", "loin", "sans-date"]);
});

cas("trois au plus", () => {
  const r = suggererChocs([...passe, ...[1, 2, 3, 4].map((i) => match(`m${i}`, { homeTeamId: "L1", awayTeamId: "L2", date: `2026-11-0${i}` }))], AUJOURDHUI);
  assert.equal(r.length, 3);
});

cas("une équipe qui n'a pas joué deux matchs ne se suggère pas", () => {
  const r = suggererChocs([...passe, joue("N", "F1", 5, 0), match("novice", { homeTeamId: "L1", awayTeamId: "N" })], AUJOURDHUI);
  assert.deepEqual(r.map((s) => s.match.id), []);
});

cas("la forme est une moyenne : trois victoires valent cinq victoires", () => {
  const r = suggererChocs([
    joue("T3", "F1", 1, 0), joue("T3", "F2", 1, 0), joue("T3", "F1", 1, 0),
    ...[1, 2, 3, 4, 5].map(() => joue("T5", "F2", 1, 0)),
    match("trois-contre-cinq", { homeTeamId: "T3", awayTeamId: "T5" }),
  ], AUJOURDHUI);
  assert.equal(r[0].forme, 3);
});

cas("ni match joué, ni passé, ni annulé, ni déjà chaud, ni place à déterminer", () => {
  const r = suggererChocs([
    ...passe,
    match("passe", { homeTeamId: "L1", awayTeamId: "L2", date: "2026-10-10" }),
    match("annule", { homeTeamId: "L1", awayTeamId: "L2", status: "cancelled" }),
    match("deja-chaud", { homeTeamId: "L1", awayTeamId: "L2", chaud: true }),
    match("a-determiner", { homeTeamId: null, awayTeamId: "L2", stage: "knockout", group: null }),
    match("en-direct", { homeTeamId: "L1", awayTeamId: "L2", status: "live" }),
  ], AUJOURDHUI);
  assert.deepEqual(r.map((s) => s.match.id), []);
});

console.log("chaudsAVenir, peutMarquerChaud");

cas(`${CHAUDS_PAR_COMPETITION} matchs chauds à venir au plus ; un match joué ne compte plus`, () => {
  const l = [
    match("a", { chaud: true }), match("b", { chaud: true, status: "live" }),
    match("vieux", { chaud: true, status: "completed" }), match("c"),
  ];
  assert.deepEqual(chaudsAVenir(l).map((m) => m.id), ["a", "b"]);
  assert.equal(peutMarquerChaud(l, l[3]), false);
  assert.equal(peutMarquerChaud(l, l[0]), true, "on peut toujours éteindre un match chaud");
  assert.equal(peutMarquerChaud(l.slice(1), l[3]), true);
});

cas("un match joué ou annulé ne se marque pas", () => {
  assert.equal(peutMarquerChaud([], match("fini", { status: "completed" })), false);
  assert.equal(peutMarquerChaud([], match("annule", { status: "cancelled" })), false);
});

console.log("chaudsEnTete (accueil Direct)");

const comp = (id: string) => ({ id, name: id }) as Competition;
const entree = (c: string, m: Partial<CompMatch> & { id: string }): Entry => ({ competition: comp(c), match: match(m.id, { competitionId: c, ...m }) });

cas("les matchs chauds à venir ou en direct, le plus proche d'abord", () => {
  const r = chaudsEnTete([
    entree("c1", { id: "loin", chaud: true, date: "2026-11-15" }),
    entree("c2", { id: "direct", chaud: true, status: "live", date: "2026-10-22" }),
    entree("c1", { id: "froid", date: "2026-10-23" }),
    entree("c3", { id: "proche", chaud: true, date: "2026-10-25" }),
  ], AUJOURDHUI);
  assert.deepEqual(r.map((e) => e.match.id), ["direct", "proche", "loin"]);
});

cas("joué, annulé ou d'une date passée : il ne reste pas en tête", () => {
  const r = chaudsEnTete([
    entree("c1", { id: "joue", chaud: true, status: "completed" }),
    entree("c1", { id: "annule", chaud: true, status: "cancelled" }),
    entree("c1", { id: "oublie", chaud: true, date: "2026-10-01" }),
  ], AUJOURDHUI);
  assert.deepEqual(r, []);
});

cas("deux par compétition au plus, même si les données en portent plus", () => {
  const r = chaudsEnTete(["a", "b", "c", "d"].map((id, i) => entree("c1", { id, chaud: true, date: `2026-11-0${i + 1}` })), AUJOURDHUI);
  assert.deepEqual(r.map((e) => e.match.id), ["a", "b"]);
});

cas("un match chaud sans date passe après ceux qui en ont une", () => {
  const r = chaudsEnTete([
    entree("c1", { id: "sans-date", chaud: true, date: null }),
    entree("c2", { id: "date", chaud: true, date: "2026-12-01" }),
  ], AUJOURDHUI);
  assert.deepEqual(r.map((e) => e.match.id), ["date", "sans-date"]);
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
