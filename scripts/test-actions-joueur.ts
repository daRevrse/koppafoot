/**
 * KOPPAFOOT — Vérification des actions proposées pour un joueur touché sur le
 * terrain de la console (lib/actions-joueur) : sur le banc ou sur la pelouse,
 * gardien ou non, selon la règle du gardien, le ballon et le verrou du jeu.
 * Aucune base, aucun réseau. Des joueurs fictifs.
 *
 * Usage:
 *   npx tsx scripts/test-actions-joueur.ts
 */
import assert from "node:assert/strict";
import { actionsDuJoueur, type JoueurTouche } from "@/lib/actions-joueur";

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

/** Un joueur de champ de A, sur la pelouse, A a le ballon, rien de verrouillé. */
const base: JoueurTouche = {
  playerId: "c1",
  cote: "home",
  surLeTerrain: true,
  equipeConnue: true,
  gardien: { regle: "designe", enPlace: { playerId: "g1", source: "feuille" }, sansGardien: false },
  ballon: "home",
  verrou: null,
};
const cles = (j: Partial<JoueurTouche>) => actionsDuJoueur({ ...base, ...j }).map((a) => a.cle);

console.log("sur le banc");
cas("il entre, ou prend un carton en attendant", () => {
  assert.deepEqual(cles({ surLeTerrain: false }), ["entrer", "yellow_card", "red_card"]);
});
cas("le verrou du jeu ne touche pas le banc", () => {
  const actions = actionsDuJoueur({ ...base, surLeTerrain: false, verrou: "Engagement" });
  assert.ok(actions.every((a) => !a.desactive));
});

console.log("un joueur de champ");
cas("son équipe a le ballon : il peut le perdre, et dribbler", () => {
  assert.deepEqual(cles({}), [
    "goal", "shot_on_target", "shot", "ball_lost", "dribble", "dribble_failed",
    "offside", "foul", "yellow_card", "red_card", "remplacer", "sortie",
  ]);
});
cas("elle ne l'a pas : il peut le gagner, et ne dribble pas", () => {
  assert.deepEqual(cles({ ballon: "away" }), [
    "goal", "shot_on_target", "shot", "ball_won", "offside", "foul", "yellow_card", "red_card", "remplacer", "sortie",
  ]);
});
cas("personne ne l'a : il peut le gagner, et dribbler (la saisie dira qui l'a)", () => {
  assert.ok(cles({ ballon: null }).includes("ball_won"));
  assert.ok(cles({ ballon: null }).includes("dribble"));
});
cas("le but s'appelle « But », en vert", () => {
  const but = actionsDuJoueur(base)[0];
  assert.equal(but.libelle, "But");
  assert.equal(but.ton, "vert");
});

console.log("le gardien (règle du gardien désigné)");
const gardien = { playerId: "g1" };
cas("ni tir, ni dribble, ni hors-jeu ; l'arrêt", () => {
  assert.deepEqual(cles(gardien), [
    "goal", "ball_lost", "save", "foul", "yellow_card", "red_card", "remplacer", "sortie",
  ]);
});
cas("un joueur de champ n'a pas l'arrêt quand un gardien est en place", () => {
  assert.ok(!cles({}).includes("save"));
});
cas("cages vides : tous prennent les gants, personne n'arrête", () => {
  const vides = { gardien: { regle: "designe", enPlace: null, sansGardien: false } as const };
  assert.ok(cles(vides).includes("gants"));
  assert.ok(!cles(vides).includes("save"));
});
cas("« Prendre les gants » se place après la faute, avant les cartons", () => {
  const c = cles({ gardien: { regle: "designe", enPlace: null, sansGardien: false } });
  assert.equal(c.indexOf("gants"), c.indexOf("foul") + 1);
  assert.equal(c.indexOf("yellow_card"), c.indexOf("gants") + 1);
});
cas("un joueur de champ dépanne dans les cages : les autres peuvent les reprendre, pas lui", () => {
  const depanne = { gardien: { regle: "designe", enPlace: { playerId: "c2", source: "gants" }, sansGardien: false } as const };
  assert.ok(cles(depanne).includes("gants"));
  assert.ok(!cles({ ...depanne, playerId: "c2" }).includes("gants"));
});
cas("match sans gardien (case cochée) : ni gants ni arrêt", () => {
  const sans = { gardien: { regle: "designe", enPlace: null, sansGardien: true } as const };
  assert.ok(!cles(sans).includes("gants"));
  assert.ok(!cles(sans).includes("save"));
});
cas("un camp sans équipe ne prend pas les gants", () => {
  assert.ok(!cles({ equipeConnue: false, gardien: { regle: "designe", enPlace: null, sansGardien: false } }).includes("gants"));
});

console.log("un match lancé avant la case (gardien de la feuille)");
cas("aucun gardien déclaré : l'arrêt s'ouvre à tout le monde, et pas de gants", () => {
  const c = cles({ gardien: { regle: "poste", gardienId: null } });
  assert.ok(c.includes("save"));
  assert.ok(c.includes("shot"));
  assert.ok(!c.includes("gants"));
});
cas("un gardien déclaré : l'arrêt est à lui seul", () => {
  const poste = { gardien: { regle: "poste", gardienId: "g1" } as const };
  assert.ok(!cles(poste).includes("save"));
  assert.ok(cles({ ...poste, playerId: "g1" }).includes("save"));
  assert.ok(!cles({ ...poste, playerId: "g1" }).includes("shot"));
});

console.log("le verrou du jeu");
cas("il ferme les actions de jeu, avec sa raison", () => {
  const actions = actionsDuJoueur({ ...base, verrou: "Engagement d'abord" });
  const fermees = actions.filter((a) => a.desactive).map((a) => a.cle);
  assert.deepEqual(fermees, ["goal", "shot_on_target", "shot", "ball_lost", "dribble", "dribble_failed", "offside", "foul"]);
  assert.ok(actions.filter((a) => a.desactive).every((a) => a.desactive === "Engagement d'abord"));
});
cas("cartons, remplacement, sortie et gants restent ouverts", () => {
  const actions = actionsDuJoueur({
    ...base, verrou: "Engagement d'abord", gardien: { regle: "designe", enPlace: null, sansGardien: false },
  });
  for (const cle of ["yellow_card", "red_card", "remplacer", "sortie", "gants"]) {
    assert.ok(!actions.find((a) => a.cle === cle)?.desactive, cle);
  }
});

if (echecs > 0) {
  console.error(`\n${echecs} cas en échec.`);
  process.exit(1);
}
console.log("\nTout est bon.");
