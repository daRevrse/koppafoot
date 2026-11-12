/**
 * KOPPAFOOT — Vérification du nettoyage des villes (lib/villes).
 * Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-villes.ts
 */
import assert from "node:assert/strict";
import { cleVille, memeVille, normaliserVille, normaliserVilleOuNull, villesDistinctes } from "@/lib/villes";

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

cas("les cinq Lomé de la prod deviennent une seule", () => {
  for (const v of ["Lomé", "Lomé ", "Lome", "lome", "LOME", "LOMÉ", "  lomé  "]) {
    assert.equal(normaliserVille(v), "Lomé", JSON.stringify(v));
  }
});

cas("une ville connue retrouve son trait d'union", () => {
  assert.equal(normaliserVille("porto novo"), "Porto-Novo");
  assert.equal(normaliserVille("BOBO-DIOULASSO"), "Bobo-Dioulasso");
});

cas("une ville inconnue tapée d'une seule casse passe en casse de titre", () => {
  assert.equal(normaliserVille("kipe"), "Kipe");
  assert.equal(normaliserVille("SAINT LOUIS"), "Saint Louis");
});

cas("une ville inconnue en casse mixte est gardée telle quelle", () => {
  assert.equal(normaliserVille("Kipe"), "Kipe");
  assert.equal(normaliserVille("McAllen"), "McAllen");
});

cas("espaces multiples ramenées à une", () => {
  assert.equal(normaliserVille("Saint   Louis "), "Saint Louis");
});

cas("vide et absent donnent une chaîne vide, ou null", () => {
  assert.equal(normaliserVille(""), "");
  assert.equal(normaliserVille("   "), "");
  assert.equal(normaliserVille(null), "");
  assert.equal(normaliserVilleOuNull(" "), null);
  assert.equal(normaliserVilleOuNull("lome"), "Lomé");
});

cas("un chiffre ne gêne pas", () => {
  assert.equal(normaliserVille("lomé 2"), "Lomé 2");
});

cas("la clé ignore accents, casse, espaces et traits d'union", () => {
  assert.equal(cleVille("Lomé "), "lome");
  assert.equal(cleVille("Porto-Novo"), cleVille("porto novo"));
  assert.ok(memeVille("LOME", "Lomé"));
  assert.ok(!memeVille("", ""));
  assert.ok(!memeVille("Lomé", "Kara"));
});

cas("villesDistinctes regroupe et trie", () => {
  assert.deepEqual(villesDistinctes(["Lomé", "lome", "LOME ", null, "", "Bamako", "kara"]), ["Bamako", "Kara", "Lomé"]);
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
