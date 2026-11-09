/**
 * KOPPAFOOT — Vérification du joueur de la semaine publié
 * (lib/joueur-semaine-publie). Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-joueur-semaine-publie.ts
 */
import assert from "node:assert/strict";
import {
  adresseDeLAffiche, cheminDuJoueur, finDeLaDiapositive, joueurDuDirect, lireJoueurDeLaSemaine,
  nomEnPhrase, noteEnTexte, periodeDeLaSemaine, resumeDuJoueur, texteDuPartage, type JoueurDeLaSemaine,
} from "@/lib/joueur-semaine-publie";

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

const doc = (x: Record<string, unknown> = {}) => ({
  nom: "EKOUÉ BAWA",
  uid: "u-ekoue",
  equipes: [{ nom: "Avenir d'Adakpamé", logo: "https://exemple/logo.png" }, { nom: "" }],
  matchs: 2,
  buts: 3,
  passes: 1,
  note: 9.2,
  homme_du_match: 1,
  lignes: [{ jour: "DIM. 1 NOV.", affiche: "AVENIR D'ADAKPAMÉ 3–1 OLYMPIQUE DE TOKOIN", buts: 2, passes: 1, homme: true }, { jour: "" }],
  photo: "https://exemple/photo.png",
  publie_le_jour: "2026-11-02",
  version: "abc123",
  ...x,
});

const elu = (lundi: string, publieLe: string): JoueurDeLaSemaine =>
  lireJoueurDeLaSemaine(lundi, doc({ publie_le_jour: publieLe }))!;

console.log("Lecture d'un document");

cas("un document complet se relit, la semaine se recalcule depuis son lundi", () => {
  const j = lireJoueurDeLaSemaine("2026-10-26", doc());
  assert.ok(j);
  assert.equal(j.dimanche, "2026-11-01");
  assert.equal(j.numero, 44);
  assert.equal(j.uid, "u-ekoue");
  assert.deepEqual(j.equipes, [{ nom: "Avenir d'Adakpamé", logo: "https://exemple/logo.png" }]);
  assert.equal(j.note, 9.2);
  assert.equal(j.hommeDuMatch, 1);
  assert.equal(j.photo, "https://exemple/photo.png");
  // Une ligne sans jour est écartée, les autres se relisent.
  assert.deepEqual(j.lignes, [{ jour: "DIM. 1 NOV.", affiche: "AVENIR D'ADAKPAMÉ 3–1 OLYMPIQUE DE TOKOIN", buts: 2, passes: 1, homme: true }]);
});

cas("une élection d'avant les lignes et la photo se relit quand même", () => {
  const j = lireJoueurDeLaSemaine("2026-10-26", doc({ note: undefined, homme_du_match: undefined, lignes: undefined, photo: undefined }))!;
  assert.equal(j.note, null);
  assert.equal(j.hommeDuMatch, 0);
  assert.deepEqual(j.lignes, []);
  assert.equal(j.photo, null);
});

cas("un identifiant qui n'est pas un jour, un nom ou une version absents : rien", () => {
  assert.equal(lireJoueurDeLaSemaine("semaine-44", doc()), null);
  assert.equal(lireJoueurDeLaSemaine("2026-10-26", doc({ nom: "" })), null);
  assert.equal(lireJoueurDeLaSemaine("2026-10-26", doc({ version: undefined })), null);
  assert.equal(lireJoueurDeLaSemaine("2026-10-26", undefined), null);
});

cas("un joueur sans compte garde un uid nul, des compteurs bricolés tombent à zéro", () => {
  const j = lireJoueurDeLaSemaine("2026-10-26", doc({ uid: null, buts: -2, passes: "3" }))!;
  assert.equal(j.uid, null);
  assert.equal(j.buts, 0);
  assert.equal(j.passes, 0);
});

console.log("La diapositive du Direct");

cas("publiée un lundi, elle tient jusqu'au dimanche", () => {
  const j = elu("2026-10-26", "2026-11-02");
  assert.equal(finDeLaDiapositive(j), "2026-11-08");
  assert.equal(joueurDuDirect([j], "2026-11-02")?.lundi, "2026-10-26");
  assert.equal(joueurDuDirect([j], "2026-11-08")?.lundi, "2026-10-26");
  assert.equal(joueurDuDirect([j], "2026-11-09"), null);
});

cas("publiée un jeudi, elle ne déborde pas sur la semaine suivante", () => {
  const j = elu("2026-10-26", "2026-11-05");
  assert.equal(joueurDuDirect([j], "2026-11-08")?.lundi, "2026-10-26");
  assert.equal(joueurDuDirect([j], "2026-11-09"), null);
});

cas("seul le plus récent des élus compte, même s'il arrive en second", () => {
  const ancien = elu("2026-10-19", "2026-10-26");
  const recent = elu("2026-10-26", "2026-11-02");
  assert.equal(joueurDuDirect([ancien, recent], "2026-11-03")?.lundi, "2026-10-26");
  // L'ancien n'est plus dans sa semaine : rien, et non pas lui en repli.
  assert.equal(joueurDuDirect([ancien, elu("2026-10-26", "2026-10-26")], "2026-11-03"), null);
});

cas("pas d'élu, pas de diapositive ; ni avant le jour de la publication", () => {
  assert.equal(joueurDuDirect([], "2026-11-03"), null);
  assert.equal(joueurDuDirect([elu("2026-10-26", "2026-11-04")], "2026-11-03"), null);
});

console.log("Les textes");

cas("le résumé : buts et passes, au singulier comme au pluriel, sinon ses matchs", () => {
  assert.equal(resumeDuJoueur({ buts: 2, passes: 1, matchs: 1 }), "2 buts · 1 passe");
  assert.equal(resumeDuJoueur({ buts: 1, passes: 0, matchs: 3 }), "1 but");
  assert.equal(resumeDuJoueur({ buts: 0, passes: 0, matchs: 3 }), "3 matchs");
  assert.equal(resumeDuJoueur({ buts: 0, passes: 2, matchs: 1 }, "en"), "2 assists");
  assert.equal(resumeDuJoueur({ buts: 0, passes: 0, matchs: 2 }, "en"), "2 matches");
});

cas("les capitales de l'affiche s'adoucissent, un nom déjà écrit reste tel quel", () => {
  assert.equal(nomEnPhrase("EKOUÉ BAWA"), "Ekoué Bawa");
  assert.equal(nomEnPhrase("JEAN-PAUL D'ALMEIDA"), "Jean-Paul D'Almeida");
  assert.equal(nomEnPhrase("Kafui MENSAH"), "Kafui MENSAH");
});

cas("le genre : lu quand il est valable, null pour une élection d'avant ce champ", () => {
  assert.equal(lireJoueurDeLaSemaine("2026-10-26", doc())!.genre, null);
  assert.equal(lireJoueurDeLaSemaine("2026-10-26", doc({ genre: "female" }))!.genre, "female");
  assert.equal(lireJoueurDeLaSemaine("2026-10-26", doc({ genre: "autre" }))!.genre, null);
});

cas("la période, à cheval sur deux mois ou non", () => {
  assert.equal(periodeDeLaSemaine({ lundi: "2026-10-26", dimanche: "2026-11-01" }), "26 oct. – 1 nov.");
  assert.equal(periodeDeLaSemaine({ lundi: "2026-11-02", dimanche: "2026-11-08" }), "2–8 nov.");
  assert.equal(periodeDeLaSemaine({ lundi: "2026-10-26", dimanche: "2026-11-01" }, "en"), "Oct 26 – Nov 1");
});

cas("le partage : le texte, le chemin vers l'élu, l'affiche versionnée", () => {
  const j = elu("2026-10-26", "2026-11-02");
  assert.equal(texteDuPartage(j), "Ekoué Bawa, joueur de la semaine 44 sur KoppaFoot ⚽");
  assert.equal(texteDuPartage({ ...j, genre: "female" }), "Ekoué Bawa, joueuse de la semaine 44 sur KoppaFoot ⚽");
  assert.equal(cheminDuJoueur(j.lundi), "/top-players#joueur-semaine-2026-10-26");
  assert.equal(adresseDeLAffiche(j, "vertical"), "/api/joueur-semaine/2026-10-26/affiche?format=vertical&v=abc123");
});

cas("la note, à une décimale, à la française ou à l'anglaise", () => {
  assert.equal(noteEnTexte(9.2), "9,2");
  assert.equal(noteEnTexte(8), "8,0");
  assert.equal(noteEnTexte(6.75, "en"), "6.8");
});

if (echecs > 0) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
