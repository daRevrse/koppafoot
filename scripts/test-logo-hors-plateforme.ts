/**
 * KOPPAFOOT — Vérification du camp hors plateforme d'un match
 * (lib/logo-hors-plateforme). Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-logo-hors-plateforme.ts
 */
import assert from "node:assert/strict";
import { coteHorsPlateforme } from "@/lib/logo-hors-plateforme";

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

cas("l'adversaire hors plateforme à l'extérieur (l'admin, ou un manager qui reçoit)", () => {
  assert.equal(coteHorsPlateforme({ home_team_id: "t1", away_team_id: "" }), "away");
});

cas("l'adversaire hors plateforme à domicile (un manager qui se déplace)", () => {
  assert.equal(coteHorsPlateforme({ home_team_id: "", away_team_id: "t1" }), "home");
  assert.equal(coteHorsPlateforme({ home_team_id: null, away_team_id: "t1" }), "home");
});

cas("deux clubs de la plateforme : pas de camp hors plateforme", () => {
  assert.equal(coteHorsPlateforme({ home_team_id: "t1", away_team_id: "t2" }), null);
});

cas("deux camps vides : un document abîmé, on ne devine pas", () => {
  assert.equal(coteHorsPlateforme({ home_team_id: "", away_team_id: "" }), null);
  assert.equal(coteHorsPlateforme({}), null);
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
