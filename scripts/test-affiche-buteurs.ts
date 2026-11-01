/**
 * KOPPAFOOT — Vérification de l'affiche des meilleurs buteurs
 * (lib/buteurs-affiche) : le choix lu dans l'adresse, les matchs comptés, les
 * journées proposées, le classement et ses ex aequo. Aucune base, aucun
 * réseau. Des joueurs fictifs.
 *
 * Usage:
 *   npx tsx scripts/test-affiche-buteurs.ts
 */
import assert from "node:assert/strict";
import {
  BUTEURS_PAR_AFFICHE, classementDeLAffiche, journeesJouees, lireChoixDesButeurs, matchsDuChoix, momentDesButeurs,
} from "@/lib/buteurs-affiche";
import { OWN_GOAL_DETAIL } from "@/lib/evenements";
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

const but = (playerId: string, playerName: string, teamId: string, p: Partial<Evenement> = {}): Evenement =>
  ({ id: Math.random().toString(36).slice(2), type: "goal", teamId, playerId, playerName, period: 1, minute: 10, createdAt: "", ...p } as Evenement);

const match = (id: string, p: Partial<CompMatch>, buts: Evenement[] = []): CompMatch =>
  ({
    id, stage: "group", group: "A", journee: 1, status: "completed", date: "2026-10-18", time: "14:00",
    liveState: { currentPeriod: 4, timerStartAt: null, timerOffset: 0, isTimerRunning: false, events: buts },
    ...p,
  } as unknown as CompMatch);

const MATCHS: CompMatch[] = [
  match("j1-a", { journee: 1 }, [but("k", "Koffi Mensah", "A"), but("k", "Koffi Mensah", "A"), but("y", "Yawo Tepe", "B")]),
  match("j1-b", { journee: 1 }, [but("s", "Sena Kpodar", "C"), but("x", "Csc", "D", { detail: OWN_GOAL_DETAIL })]),
  match("j2-a", { journee: 2, date: "2026-10-25" }, [but("y", "Yawo Tepe", "B"), but("y", "Yawo Tepe", "B")]),
  match("j2-b", { journee: 2, date: "2026-10-25" }, [but("a", "Afi Lawson", "D", { varStatus: "cancelled" })]),
  match("j3", { journee: 3, date: "2026-11-01", status: "scheduled" }),
  match("demi", { stage: "knockout", group: null, journee: null, round: "semi", date: "2026-12-13" }, [but("s", "Sena Kpodar", "C")]),
  match("expo", { stage: "exhibition", group: null, journee: null }, [but("k", "Koffi Mensah", "A")]),
];

console.log("lireChoixDesButeurs");

cas("une journée, ou à ce jour", () => {
  assert.deepEqual(lireChoixDesButeurs(new URLSearchParams("journee=2")), { journee: 2 });
  assert.deepEqual(lireChoixDesButeurs(new URLSearchParams("a-ce-jour=1&v=abc")), { aCeJour: true });
});

cas("une adresse bricolée est refusée", () => {
  for (const q of ["", "journee=0", "journee=-1", "journee=2.5", "journee=abcd", "journee=1234", "a-ce-jour=oui", "journee=2&a-ce-jour=1"]) {
    assert.equal(lireChoixDesButeurs(new URLSearchParams(q)), null, q);
  }
});

console.log("\nmatchsDuChoix et journeesJouees");

cas("après la journée 2 : les matchs de poule des journées 1 et 2", () => {
  assert.deepEqual(matchsDuChoix(MATCHS, { journee: 2 }).map((m) => m.id), ["j1-a", "j1-b", "j2-a", "j2-b"]);
});

cas("à ce jour : tout, phase finale comprise", () => {
  assert.equal(matchsDuChoix(MATCHS, { aCeJour: true }).length, MATCHS.length);
});

cas("seules les journées commencées se proposent", () => {
  assert.deepEqual(journeesJouees(MATCHS), [1, 2]);
  assert.deepEqual(journeesJouees([...MATCHS, match("j3-direct", { journee: 3, status: "live" })]), [1, 2, 3]);
});

console.log("\nclassementDeLAffiche");

cas("après la journée 1 : Koffi 2, puis Sena et Yawo ex aequo à la 2e place", () => {
  const c = classementDeLAffiche(MATCHS, { journee: 1 });
  assert.deepEqual(c.map((l) => [l.rang, l.playerName, l.goals]), [
    [1, "Koffi Mensah", 2],
    [2, "Sena Kpodar", 1],
    [2, "Yawo Tepe", 1],
  ]);
});

cas("après la journée 2 : Yawo passe devant ; ni contre son camp ni but annulé", () => {
  const c = classementDeLAffiche(MATCHS, { journee: 2 });
  assert.deepEqual(c.map((l) => [l.rang, l.playerName, l.goals]), [
    [1, "Yawo Tepe", 3],
    [2, "Koffi Mensah", 2],
    [3, "Sena Kpodar", 1],
  ]);
});

cas("à ce jour : la phase finale compte, l'exhibition non", () => {
  const c = classementDeLAffiche(MATCHS, { aCeJour: true });
  assert.deepEqual(c.map((l) => [l.rang, l.playerName, l.goals]), [
    [1, "Yawo Tepe", 3],
    [2, "Koffi Mensah", 2],
    [2, "Sena Kpodar", 2],
  ]);
});

cas("dix lignes au plus", () => {
  const beaucoup = [match("gros", { journee: 1 }, Array.from({ length: 14 }, (_, i) => but(`p${i}`, `Joueur ${String(i).padStart(2, "0")}`, "A")))];
  const c = classementDeLAffiche(beaucoup, { journee: 1 });
  assert.equal(c.length, BUTEURS_PAR_AFFICHE);
  assert.ok(c.every((l) => l.rang === 1));
});

cas("aucun but : aucune ligne", () => {
  assert.deepEqual(classementDeLAffiche([match("vide", {})], { journee: 1 }), []);
});

cas("le surtitre", () => {
  assert.equal(momentDesButeurs({ journee: 3 }), "APRÈS LA JOURNÉE 3");
  assert.equal(momentDesButeurs({ aCeJour: true }), "À CE JOUR");
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
