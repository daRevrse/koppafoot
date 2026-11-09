/**
 * KOPPAFOOT — Vérification de l'animation de la vidéo d'annonce d'un match
 * chaud (lib/video-annonce). Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-annonce.ts
 */
import assert from "node:assert/strict";
import { CLES_ACCROCHE, CLES_ANNONCE, DUREE_ANNONCE, FIN_ACCROCHE, etatCalqueAnnonce } from "@/lib/video-annonce";

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

const estAccroche = (cle: string) => (CLES_ACCROCHE as readonly string[]).includes(cle);
const AFFICHE = CLES_ANNONCE.filter((cle) => !estAccroche(cle));
/** Visible à l'écran : opaque, et pas sorti du cadre. */
const visible = (cle: string, t: number) => {
  const c = calque(cle);
  const e = etatCalqueAnnonce(c, t, L);
  return e.opacite > 0 && c.left + e.dx + c.w > 0 && c.left + e.dx < L;
};

cas("dix secondes", () => {
  assert.equal(DUREE_ANNONCE, 10);
});

cas("à la fin, l'affiche est en place et l'accroche est partie", () => {
  for (const cle of AFFICHE) {
    const e = etatCalqueAnnonce(calque(cle), DUREE_ANNONCE, L);
    assert.deepEqual([e.dx, e.dy, e.opacite, e.devoile, e.zoom, e.echelle], [0, 0, 1, 1, 1, 1], cle);
  }
  for (const cle of CLES_ACCROCHE) assert.equal(etatCalqueAnnonce(calque(cle), DUREE_ANNONCE, L).opacite, 0, cle);
});

cas("la flamme et sa lueur sont là dès la première image (la vignette)", () => {
  assert.equal(etatCalqueAnnonce(calque("lueur", 0, 0, L, 1920), 0, L).opacite, 1);
  const f = etatCalqueAnnonce(calque("flamme"), 0, L);
  assert.equal(f.opacite, 1);
  assert.ok(f.echelle! > 0.5 && f.echelle! < 1, `échelle ${f.echelle}`);
});

cas("l'accroche tient l'écran seule : ses deux lignes en place, rien de l'affiche", () => {
  for (const t of [1, 1.5, FIN_ACCROCHE]) {
    for (const cle of ["accroche-0", "accroche-1"]) {
      const e = etatCalqueAnnonce(calque(cle), t, L);
      assert.deepEqual([e.dx, e.dy, e.opacite], [0, 0, 1], `${cle} à ${t}`);
    }
    for (const cle of AFFICHE) if (cle !== "fond") assert.equal(visible(cle, t), false, `${cle} à ${t}`);
  }
});

cas("« MATCH À NE PAS » entre par la gauche, « MANQUER » par la droite", () => {
  const g = calque("accroche-0", 140, 800, 800, 130);
  const d = calque("accroche-1", 120, 950, 840, 250);
  assert.ok(g.left + etatCalqueAnnonce(g, 0, L).dx + g.w <= 0);
  assert.ok(d.left + etatCalqueAnnonce(d, 0, L).dx >= L);
});

cas("l'accroche est partie avant que le titre n'arrive", () => {
  const titreVisible = [...Array(101).keys()].map((i) => i / 10).find((t) => visible("titre", t))!;
  for (const cle of ["flamme", "accroche-0", "accroche-1"]) {
    assert.equal(etatCalqueAnnonce(calque(cle), titreVisible, L).opacite, 0, `${cle} à ${titreVisible}`);
  }
});

cas("le bandeau « À ne pas manquer » prend le relais de l'accroche, en tête de l'affiche", () => {
  const debut = [...Array(101).keys()].map((i) => i / 10).find((t) => visible("bandeau", t))!;
  assert.ok(debut >= FIN_ACCROCHE && debut <= FIN_ACCROCHE + 0.3, `bandeau à ${debut}`);
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
  const titreEnPlace = [...Array(101).keys()].map((i) => i / 10).find((t) => etatCalqueAnnonce(calque("titre"), t, L).dx === 0)!;
  const campEnPlace = [...Array(101).keys()].map((i) => i / 10).find((t) => etatCalqueAnnonce(calque("camp-0"), t, L).dx === 0)!;
  const infosVisibles = [...Array(101).keys()].map((i) => i / 10).find((t) => etatCalqueAnnonce(calque("infos"), t, L).opacite > 0)!;
  assert.ok(titreEnPlace < campEnPlace, `titre ${titreEnPlace} / écusson ${campEnPlace}`);
  assert.ok(campEnPlace <= infosVisibles, `écusson ${campEnPlace} / infos ${infosVisibles}`);
});

cas("le fond est là dès la première image", () => {
  assert.deepEqual(etatCalqueAnnonce(calque("fond", 0, 0, L, 1920), 0, L), { dx: 0, dy: 0, opacite: 1, devoile: 1, zoom: 1, echelle: 1 });
});

cas("l'affiche est en place à six secondes : le reste se lit", () => {
  for (const cle of AFFICHE) {
    const e = etatCalqueAnnonce(calque(cle), 6, L);
    assert.deepEqual([e.dx, e.dy, e.opacite, e.echelle], [0, 0, 1, 1], cle);
  }
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
