/**
 * KOPPAFOOT — Vérification de l'animation de la vidéo d'annonce d'un match
 * chaud (lib/video-annonce). Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-annonce.ts
 */
import assert from "node:assert/strict";
import { CLES_ANNONCE, DUREE_ANNONCE, etatCalqueAnnonce } from "@/lib/video-annonce";

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

const L = 1080;
const calque = (cle: string, left = 100, top = 500, w = 380, h = 420) => ({ cle, left, top, w, h });

cas("huit secondes", () => {
  assert.equal(DUREE_ANNONCE, 8);
});

cas("à la fin, tout est en place", () => {
  for (const cle of CLES_ANNONCE) {
    const e = etatCalqueAnnonce(calque(cle), DUREE_ANNONCE, L);
    assert.deepEqual([e.dx, e.dy, e.opacite, e.devoile, e.zoom], [0, 0, 1, 1, 1], cle);
  }
});

cas("au départ, l'écusson de gauche est hors champ à gauche, celui de droite à droite", () => {
  const g = calque("camp-0", 60, 700, 380, 420);
  const d = calque("camp-1", 640, 700, 380, 420);
  const eg = etatCalqueAnnonce(g, 0, L);
  const ed = etatCalqueAnnonce(d, 0, L);
  assert.ok(g.left + eg.dx + g.w <= 0, `gauche à ${g.left + eg.dx}`);
  assert.ok(d.left + ed.dx >= L, `droite à ${d.left + ed.dx}`);
});

cas("le titre arrive avant les écussons, les infos après", () => {
  const titreEnPlace = [...Array(81).keys()].map((i) => i / 10).find((t) => etatCalqueAnnonce(calque("titre"), t, L).dx === 0)!;
  const campEnPlace = [...Array(81).keys()].map((i) => i / 10).find((t) => etatCalqueAnnonce(calque("camp-0"), t, L).dx === 0)!;
  const infosVisibles = [...Array(81).keys()].map((i) => i / 10).find((t) => etatCalqueAnnonce(calque("infos"), t, L).opacite > 0)!;
  assert.ok(titreEnPlace < campEnPlace, `titre ${titreEnPlace} / écusson ${campEnPlace}`);
  assert.ok(campEnPlace <= infosVisibles, `écusson ${campEnPlace} / infos ${infosVisibles}`);
});

cas("le fond est là dès la première image", () => {
  assert.deepEqual(etatCalqueAnnonce(calque("fond", 0, 0, L, 1920), 0, L), { dx: 0, dy: 0, opacite: 1, devoile: 1, zoom: 1 });
});

cas("tout est en place au tiers de la vidéo : le reste se lit", () => {
  for (const cle of CLES_ANNONCE) {
    const e = etatCalqueAnnonce(calque(cle), 4, L);
    assert.deepEqual([e.dx, e.dy, e.opacite], [0, 0, 1], cle);
  }
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
