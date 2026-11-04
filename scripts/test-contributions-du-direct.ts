/**
 * KOPPAFOOT — Vérification des buts et passes crédités à la fin d'un match
 * couvert en direct (lib/contributions-du-direct). Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-contributions-du-direct.ts
 */
import assert from "node:assert/strict";
import { contributionsDuDirect } from "@/lib/contributions-du-direct";
import { OWN_GOAL_DETAIL } from "@/lib/evenements";

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

cas("un but et sa passe créditent le buteur et le passeur", () => {
  const c = contributionsDuDirect([
    { type: "goal", player_id: "kafui", assist_player_id: "ekoue" },
    { type: "goal", player_id: "ekoue", assist_player_id: "selom" },
    { type: "goal", player_id: "ekoue" },
  ]);
  assert.deepEqual(c.buts, { kafui: 1, ekoue: 2 });
  assert.deepEqual(c.passes, { ekoue: 1, selom: 1 });
});

cas("un but refusé par la VAR n'apporte ni but ni passe ; vérifié ou en cours, si", () => {
  const c = contributionsDuDirect([
    { type: "goal", player_id: "a", assist_player_id: "b", var_status: "cancelled" },
    { type: "goal", player_id: "a", assist_player_id: "b", var_status: "checking" },
    { type: "goal", player_id: "a", assist_player_id: "b", var_status: "confirmed" },
  ]);
  assert.deepEqual(c.buts, { a: 2 });
  assert.deepEqual(c.passes, { b: 2 });
});

cas("un but contre son camp ne crédite ni son auteur ni un passeur", () => {
  const c = contributionsDuDirect([{ type: "goal", player_id: "a", assist_player_id: "b", detail: OWN_GOAL_DETAIL }]);
  assert.deepEqual(c, { buts: {}, passes: {} });
});

cas("on ne se fait pas la passe ; les autres événements ne comptent pas", () => {
  const c = contributionsDuDirect([
    { type: "goal", player_id: "a", assist_player_id: "a" },
    { type: "yellow_card", player_id: "b", assist_player_id: "c" },
    { type: "goal", player_id: null, assist_player_id: "d" },
  ]);
  assert.deepEqual(c.buts, { a: 1 });
  assert.deepEqual(c.passes, { d: 1 });
});

cas("pas de direct, rien", () => {
  assert.deepEqual(contributionsDuDirect(undefined), { buts: {}, passes: {} });
});

if (echecs > 0) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
