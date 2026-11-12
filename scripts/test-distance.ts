/**
 * KOPPAFOOT — Vérification de « Près de moi » (lib/carte : distanceKm,
 * distanceLisible, parDistance). Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-distance.ts
 */
import assert from "node:assert/strict";
import { distanceKm, distanceLisible, parDistance, type Position } from "@/lib/carte";

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

const LOME: Position = { lat: 6.1319, lng: 1.2228 };
const KARA: Position = { lat: 9.5511, lng: 1.1861 };
const COTONOU: Position = { lat: 6.3703, lng: 2.3912 };

cas("Lomé–Kara ≈ 380 km à vol d'oiseau", () => {
  const d = distanceKm(LOME, KARA);
  assert.ok(d > 370 && d < 390, String(d));
});

cas("Lomé–Cotonou ≈ 131 km", () => {
  const d = distanceKm(LOME, COTONOU);
  assert.ok(d > 125 && d < 137, String(d));
});

cas("un point est à zéro de lui-même, et la distance est symétrique", () => {
  assert.equal(distanceKm(LOME, LOME), 0);
  assert.equal(distanceKm(LOME, KARA), distanceKm(KARA, LOME));
});

cas("libellés lisibles", () => {
  assert.equal(distanceLisible(0.02), "à 100 m");
  assert.equal(distanceLisible(0.43), "à 400 m");
  assert.equal(distanceLisible(0.97), "à 1 km");
  assert.equal(distanceLisible(2.34), "à 2,3 km");
  assert.equal(distanceLisible(18.4), "à 18 km");
  assert.equal(distanceLisible(381.2), "à 381 km");
});

cas("parDistance range du plus proche au plus loin, sans position à la fin", () => {
  const terrains = [
    { nom: "sans", p: null },
    { nom: "kara", p: KARA },
    { nom: "lome", p: { lat: 6.14, lng: 1.23 } },
    { nom: "sans2", p: null },
    { nom: "cotonou", p: COTONOU },
  ];
  const r = parDistance(terrains, LOME, (t) => t.p);
  assert.deepEqual(r.map((x) => x.element.nom), ["lome", "cotonou", "kara", "sans", "sans2"]);
  assert.equal(r[3].km, null);
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
