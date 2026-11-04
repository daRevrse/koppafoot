/**
 * KOPPAFOOT — Vérification de la feuille pendant le match (lib/banc) : qui est
 * sur la pelouse, qui peut entrer en compétition et en amical, qui est averti,
 * et le plafond de changements. Aucune base, aucun réseau. Des joueurs fictifs.
 *
 * Usage:
 *   npx tsx scripts/test-banc.ts
 */
import assert from "node:assert/strict";
import { avertis, leBanc, remplacementsEpuises, surLaPelouse } from "@/lib/banc";
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

type Fait = NonNullable<CompMatch["liveState"]>["events"][number];

const ligne = (playerId: string, role: "starter" | "substitute"): LineupEntry =>
  ({ playerId, name: playerId, number: "", role });

let n = 0;
function fait(f: Partial<Fait> & Pick<Fait, "type">): Fait {
  n += 1;
  return { id: `e${n}`, period: 1, minute: n, teamId: "A", createdAt: "", ...f } as Fait;
}

// A : trois titulaires, deux remplaçants.
const feuille = [ligne("t1", "starter"), ligne("t2", "starter"), ligne("t3", "starter"), ligne("r1", "substitute"), ligne("r2", "substitute")];
const ids = (l: LineupEntry[]) => l.map((e) => e.playerId);

console.log("surLaPelouse");
cas("les lignes présentes, dans l'ordre de la feuille et non de la pelouse", () => {
  assert.deepEqual(ids(surLaPelouse(feuille, ["r1", "t1"])), ["t1", "r1"]);
});
cas("un identifiant inconnu de la feuille n'apparaît pas", () => {
  assert.deepEqual(ids(surLaPelouse(feuille, ["t1", "fantome"])), ["t1"]);
});

console.log("leBanc, en compétition (sans retour)");
cas("avant tout changement : les remplaçants, et eux seuls", () => {
  assert.deepEqual(ids(leBanc(feuille, ["t1", "t2", "t3"], [], false)), ["r1", "r2"]);
});
cas("un titulaire sorti ne revient pas", () => {
  const faits = [fait({ type: "substitution", playerId: "r1", outPlayerId: "t1" })];
  assert.deepEqual(ids(leBanc(feuille, ["r1", "t2", "t3"], faits, false)), ["r2"]);
});
cas("un remplaçant entré puis ressorti ne revient pas non plus", () => {
  const faits = [
    fait({ type: "substitution", playerId: "r1", outPlayerId: "t1" }),
    fait({ type: "substitution", playerId: "r2", outPlayerId: "r1" }),
  ];
  assert.deepEqual(ids(leBanc(feuille, ["r2", "t2", "t3"], faits, false)), []);
});
cas("une sortie sans remplaçant vaut sortie", () => {
  const faits = [
    fait({ type: "substitution", playerId: "r1", outPlayerId: "t1" }),
    fait({ type: "sortie", playerId: "r1" }),
  ];
  assert.deepEqual(ids(leBanc(feuille, ["t2", "t3"], faits, false)), ["r2"]);
});
cas("un remplaçant exclu depuis le banc n'entre pas", () => {
  const faits = [fait({ type: "red_card", playerId: "r2" })];
  assert.deepEqual(ids(leBanc(feuille, ["t1", "t2", "t3"], faits, false)), ["r1"]);
});

console.log("leBanc, en amical (retour autorisé)");
cas("toute la feuille hors de la pelouse, titulaire parti souffler compris", () => {
  const faits = [fait({ type: "substitution", playerId: "r1", outPlayerId: "t1" })];
  assert.deepEqual(ids(leBanc(feuille, ["r1", "t2", "t3"], faits, true)), ["t1", "r2"]);
});
cas("un exclu ne revient pas, même entre copains", () => {
  const faits = [fait({ type: "red_card", playerId: "t1" })];
  assert.deepEqual(ids(leBanc(feuille, ["t2", "t3"], faits, true)), ["r1", "r2"]);
});

console.log("avertis");
cas("les joueurs qui ont un jaune, une fois chacun", () => {
  const faits = [
    fait({ type: "yellow_card", playerId: "t1" }),
    fait({ type: "yellow_card", playerId: "t1" }),
    fait({ type: "yellow_card", playerId: "r2" }),
    fait({ type: "red_card", playerId: "t2" }),
    fait({ type: "yellow_card" }),
  ];
  assert.deepEqual([...avertis(faits)].sort(), ["r2", "t1"]);
});

console.log("remplacementsEpuises");
const trois = [
  fait({ type: "substitution", teamId: "A", playerId: "r1", outPlayerId: "t1" }),
  fait({ type: "substitution", teamId: "A", playerId: "r2", outPlayerId: "t2" }),
  fait({ type: "substitution", teamId: "B", playerId: "x", outPlayerId: "y" }),
  fait({ type: "sortie", teamId: "A", playerId: "t3" }),
];
cas("le plafond compte les changements du camp, et eux seuls", () => {
  assert.equal(remplacementsEpuises(trois, "A", 3), false);
  assert.equal(remplacementsEpuises(trois, "A", 2), true);
  assert.equal(remplacementsEpuises(trois, "B", 2), false);
});
cas("sans plafond (amical), jamais épuisés", () => {
  assert.equal(remplacementsEpuises(trois, "A", null), false);
});
cas("un plafond à zéro interdit le premier changement", () => {
  assert.equal(remplacementsEpuises([], "A", 0), true);
});

if (echecs > 0) {
  console.error(`\n${echecs} cas en échec.`);
  process.exit(1);
}
console.log("\nTout est bon.");
