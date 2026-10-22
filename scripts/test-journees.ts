/**
 * KOPPAFOOT — Vérification des journées de poule (lib/journees).
 * Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-journees.ts
 */
import assert from "node:assert/strict";
import {
  filtreDeJournee, journeesAttendues, proposerJournees, rencontresAvecJournee, toursDuCercle, type MatchANumeroter,
} from "@/lib/journees";

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

/**
 * L'ancien `roundRobinPairs` (lib/competition-firestore), recopié : le module
 * démarre le SDK Firebase du navigateur et ne s'importe pas dans un script.
 * `toursDuCercle` doit produire les mêmes paires, dans le même ordre.
 */
function ancienRoundRobinPairs(teamIds: string[]): [string, string][] {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push("__BYE__");
  const n = ids.length;
  const rounds: [string, string][] = [];
  const arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a !== "__BYE__" && b !== "__BYE__") rounds.push([a, b]);
    }
    arr.splice(1, 0, arr.pop() as string);
  }
  return rounds;
}

/** Des matchs de poule datés dans l'ordre de la liste, un par jour. */
function datees(paires: [string, string][], groupe = "A"): MatchANumeroter[] {
  return paires.map(([h, a], i) => ({
    id: `${groupe}${i}-${h}${a}`, stage: "group", group: groupe, homeTeamId: h, awayTeamId: a,
    date: `2026-01-${String(i + 1).padStart(2, "0")}`, time: "16:00", journee: null,
  }));
}

/** Chaque journée : aucune équipe deux fois. */
function verifierJournees(matchs: MatchANumeroter[], journees: Map<string, number>) {
  const parJournee = new Map<number, string[]>();
  for (const m of matchs) {
    const j = m.journee ?? journees.get(m.id);
    if (j == null) continue;
    parJournee.set(j, [...(parJournee.get(j) ?? []), m.homeTeamId!, m.awayTeamId!]);
  }
  for (const [j, equipes] of parJournee) {
    assert.equal(new Set(equipes).size, equipes.length, `journée ${j} : une équipe y joue deux fois`);
  }
  return parJournee;
}

function permutations<T>(l: T[]): T[][] {
  if (l.length <= 1) return [l];
  return l.flatMap((x, i) => permutations([...l.slice(0, i), ...l.slice(i + 1)]).map((p) => [x, ...p]));
}

console.log("toursDuCercle");

cas("4 équipes, 3 tours de 2 matchs, chaque équipe une fois par tour", () => {
  const tours = toursDuCercle(["A", "B", "C", "D"]);
  assert.equal(tours.length, 3);
  for (const t of tours) assert.deepEqual(t.flat().sort(), ["A", "B", "C", "D"]);
});

cas("5 équipes, 5 tours de 2 matchs (un exempt par tour)", () => {
  const tours = toursDuCercle(["A", "B", "C", "D", "E"]);
  assert.equal(tours.length, 5);
  assert.ok(tours.every((t) => t.length === 2));
});

cas("mises à plat, les mêmes paires dans le même ordre que l'ancien roundRobinPairs", () => {
  for (const equipes of [["A", "B", "C", "D"], ["A", "B", "C", "D", "E"], ["A", "B", "C", "D", "E", "F"]]) {
    assert.deepEqual(toursDuCercle(equipes).flat(), ancienRoundRobinPairs(equipes));
  }
});

console.log("rencontresAvecJournee");

cas("aller-retour sur 4 équipes, journées 1 à 6, le retour inverse les camps", () => {
  const r = rencontresAvecJournee(["A", "B", "C", "D"], true);
  assert.deepEqual([...new Set(r.map((x) => x.journee))].sort(), [1, 2, 3, 4, 5, 6]);
  const aller = r.find((x) => x.journee === 1)!;
  assert.ok(r.some((x) => x.journee === 4 && x.home === aller.away && x.away === aller.home));
});

cas("aller simple : une journée par tour, les paires de l'ancien ordre", () => {
  const r = rencontresAvecJournee(["A", "B", "C", "D"], false);
  assert.deepEqual(r.map((x) => [x.home, x.away]), ancienRoundRobinPairs(["A", "B", "C", "D"]));
  assert.deepEqual(r.map((x) => x.journee), [1, 1, 2, 2, 3, 3]);
});

console.log("journeesAttendues");

cas("n − 1 pour n pair, n pour n impair, doublé en aller-retour", () => {
  assert.equal(journeesAttendues(4, false), 3);
  assert.equal(journeesAttendues(5, false), 5);
  assert.equal(journeesAttendues(4, true), 6);
});

console.log("proposerJournees");

const K4: [string, string][] = [["A", "B"], ["A", "C"], ["A", "D"], ["B", "C"], ["B", "D"], ["C", "D"]];

cas("les 720 ordres des 6 matchs d'une poule de 4 donnent 3 journées justes", () => {
  const ordres = permutations(K4);
  assert.equal(ordres.length, 720);
  for (const ordre of ordres) {
    const matchs = datees(ordre);
    const { journees, depassement } = proposerJournees(matchs);
    assert.equal(journees.size, 6, ordre.join(" "));
    assert.equal(depassement, false, ordre.join(" "));
    const parJournee = verifierJournees(matchs, journees);
    assert.deepEqual([...parJournee.keys()].sort(), [1, 2, 3], ordre.join(" "));
  }
});

cas("ne touche jamais une journée déjà posée, et en tient compte", () => {
  const matchs = datees([["C", "D"], ["A", "C"], ["A", "B"]]);
  matchs[2].journee = 2;
  const { journees } = proposerJournees(matchs);
  assert.equal(journees.has(matchs[2].id), false);
  assert.equal(journees.get(matchs[0].id), 1);
  assert.notEqual(journees.get(matchs[1].id), 2);
  verifierJournees(matchs, journees);
});

cas("les matchs sans date passent après les matchs datés", () => {
  const matchs = datees([["A", "B"], ["A", "C"]]);
  matchs[0].date = null;
  const { journees } = proposerJournees(matchs);
  assert.equal(journees.get(matchs[1].id), 1);
  assert.equal(journees.get(matchs[0].id), 2);
});

cas("aller-retour : les retours commencent après le dernier aller", () => {
  // Chaque retour daté juste après son aller.
  const paires = K4.flatMap(([h, a]) => [[h, a], [a, h]] as [string, string][]);
  const matchs = datees(paires);
  const { journees, depassement } = proposerJournees(matchs);
  assert.equal(depassement, false);
  for (let i = 0; i < matchs.length; i++) {
    const j = journees.get(matchs[i].id)!;
    if (i % 2 === 0) assert.ok(j >= 1 && j <= 3, `aller ${matchs[i].id} en J${j}`);
    else assert.ok(j >= 4 && j <= 6, `retour ${matchs[i].id} en J${j}`);
  }
  verifierJournees(matchs, journees);
});

cas("ignore la phase finale et les exhibitions", () => {
  const matchs: MatchANumeroter[] = [
    ...datees([["A", "B"]]),
    { id: "demi", stage: "knockout", group: null, homeTeamId: "A", awayTeamId: "B", date: "2026-02-01", time: null, journee: null },
    { id: "gala", stage: "exhibition", group: null, homeTeamId: "X", awayTeamId: "Y", date: "2026-02-02", time: null, journee: null },
  ];
  const { journees } = proposerJournees(matchs);
  assert.deepEqual([...journees.keys()], [matchs[0].id]);
});

cas("deux poules : chacune numérotée à partir de 1", () => {
  const matchs = [...datees([["A", "B"], ["C", "D"]], "A"), ...datees([["E", "F"], ["G", "H"]], "B")];
  const { journees } = proposerJournees(matchs);
  assert.deepEqual(matchs.map((m) => journees.get(m.id)), [1, 1, 1, 1]);
});

cas("une poule de 6 mal datée qui déborde lève depassement", () => {
  // Les quatre premières équipes jouent tout entre elles d'abord : E et F
  // arrivent ensuite sur des journées déjà pleines, et il en faut une sixième.
  const ordre: [string, string][] = [
    ["A", "B"], ["C", "D"], ["A", "C"], ["B", "D"], ["A", "D"], ["B", "C"], ["E", "F"],
    ["A", "E"], ["B", "E"], ["C", "E"], ["D", "E"], ["A", "F"], ["B", "F"], ["C", "F"], ["D", "F"],
  ];
  const matchs = datees(ordre);
  const { journees, depassement } = proposerJournees(matchs);
  assert.equal(journees.size, 15);
  assert.equal(depassement, true);
  verifierJournees(matchs, journees);
});

console.log("filtreDeJournee");

cas("le filtre tient tant que sa journée existe", () => {
  assert.equal(filtreDeJournee(2, [1, 2, 3]), 2);
  assert.equal(filtreDeJournee(null, [1, 2]), null);
});

cas("une journée qui disparaît lâche le filtre, plutôt qu'un calendrier vide", () => {
  assert.equal(filtreDeJournee(3, [1, 2]), null);
  assert.equal(filtreDeJournee(1, []), null);
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
