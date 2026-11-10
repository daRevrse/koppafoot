/**
 * KOPPAFOOT — Vérification du déroulé que la console pilote (lib/deroule) :
 * ce que les camps attendent ballon mort, le bouton du bandeau selon l'état du
 * jeu, et ce que devient la fin du temps de jeu. Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-deroule.ts
 */
import assert from "node:assert/strict";
import {
  CONSIGNE_ENGAGEMENT, CONSIGNE_REPRISE, apresLeTempsDeJeu, attenteDesCamps, boutonDuDeroule,
  estUnePeriodeDeJeu,
} from "@/lib/deroule";
import { JEU_AVANT, type Jeu, type RaisonBalleMorte } from "@/lib/etat-du-jeu";

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

const EN_JEU: Jeu = { balle: "en_jeu", raison: null, engage: null, premier: "home" };
const mort = (raison: RaisonBalleMorte, engage: Jeu["engage"] = null): Jeu =>
  ({ balle: "morte", raison, engage, premier: "home" });

const bouton = (jeu: Jeu, autre: Partial<Parameters<typeof boutonDuDeroule>[0]> = {}) =>
  boutonDuDeroule({ jeu, periode: 1, ballon: null, penaltyEnAttente: false, feuillesRouvrables: false, ...autre });

console.log("estUnePeriodeDeJeu");
cas("les deux mi-temps et les deux prolongations", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(estUnePeriodeDeJeu), [1, 3, 6, 8]);
  assert.equal(estUnePeriodeDeJeu(null), false);
  assert.equal(estUnePeriodeDeJeu(undefined), false);
});

console.log("attenteDesCamps");
cas("ballon en jeu, interruption, penalty : personne n'attend", () => {
  assert.equal(attenteDesCamps(EN_JEU), null);
  assert.equal(attenteDesCamps(mort("interruption")), null);
  assert.equal(attenteDesCamps(mort("penalty")), null);
});
cas("arrêt de jeu : les deux camps peuvent repartir", () => {
  assert.deepEqual(attenteDesCamps(mort("arret")), { cotes: ["home", "away"], libelle: "Repart" });
});
cas("après un but : seul le camp qui engage attend", () => {
  assert.deepEqual(attenteDesCamps(mort("but", "away")), { cotes: ["away"], libelle: "Engage" });
});
cas("au coup d'envoi, personne n'est désigné : les deux attendent", () => {
  assert.deepEqual(attenteDesCamps(JEU_AVANT), { cotes: ["home", "away"], libelle: "Engage" });
});

console.log("boutonDuDeroule");
cas("ballon en jeu, en période : l'arrêt de jeu", () => {
  assert.deepEqual(bouton(EN_JEU), { type: "arret_de_jeu" });
});
cas("ballon en jeu hors période : rien", () => {
  assert.equal(bouton(EN_JEU, { periode: 2 }), null);
});
cas("avant le coup d'envoi : les feuilles tant que rien n'est arrivé", () => {
  assert.deepEqual(bouton(JEU_AVANT, { feuillesRouvrables: true }), { type: "avant", feuilles: true });
  assert.deepEqual(bouton(JEU_AVANT), { type: "avant", feuilles: false });
});
cas("but, mi-temps, pause : l'engagement du camp attendu, sinon la consigne", () => {
  for (const raison of ["but", "mi_temps", "pause"] as const) {
    assert.deepEqual(bouton(mort(raison, "away")), { type: "engagement", camp: "away" }, raison);
    assert.deepEqual(bouton(mort(raison)), { type: "consigne", texte: CONSIGNE_ENGAGEMENT }, raison);
  }
});
cas("arrêt de jeu : la reprise du camp qui a le ballon, sinon la consigne", () => {
  assert.deepEqual(bouton(mort("arret"), { ballon: "home" }), { type: "reprise", camp: "home" });
  assert.deepEqual(bouton(mort("arret")), { type: "consigne", texte: CONSIGNE_REPRISE });
});
cas("penalty : rouvrir son issue tant qu'il attend", () => {
  assert.deepEqual(bouton(mort("penalty"), { penaltyEnAttente: true }), { type: "penalty" });
  assert.deepEqual(bouton(mort("penalty")), { type: "consigne", texte: CONSIGNE_REPRISE });
});
cas("interruption : reprendre le match", () => {
  assert.deepEqual(bouton(mort("interruption")), { type: "reprendre_le_match" });
});
cas("séance de tirs au but : rien, la séance a son propre écran", () => {
  assert.equal(bouton(mort("tirs_au_but")), null);
});

console.log("apresLeTempsDeJeu");
const fin = (m: Partial<Parameters<typeof apresLeTempsDeJeu>[0]>) =>
  apresLeTempsDeJeu({ stage: "knockout", scoreHome: 1, scoreAway: 1, periode: 3, prolongationMin: 15, ...m });
cas("hors élimination directe, ou avec un vainqueur : la fin", () => {
  assert.equal(fin({ stage: "group" }), "fin");
  assert.equal(fin({ stage: null }), "fin");
  assert.equal(fin({ scoreHome: 2 }), "fin");
});
cas("égalité à la fin de la seconde mi-temps, prolongations prévues : les prolongations", () => {
  assert.equal(fin({}), "prolongations");
});
cas("égalité sans prolongations au règlement : les tirs au but", () => {
  assert.equal(fin({ prolongationMin: null }), "tirs_au_but");
  assert.equal(fin({ prolongationMin: 0 }), "tirs_au_but");
});
cas("égalité après les prolongations : les tirs au but", () => {
  assert.equal(fin({ periode: 8 }), "tirs_au_but");
});

if (echecs > 0) {
  console.error(`\n${echecs} cas en échec.`);
  process.exit(1);
}
console.log("\nTout est bon.");
