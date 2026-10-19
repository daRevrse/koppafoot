/**
 * KOPPAFOOT — Vérification du consentement à l'image (lib/consentement-image).
 * Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-consentement-image.ts
 */
import assert from "node:assert/strict";
import {
  aDemanderAuJoueur, consentementPour, estMineur, etatDuConsentement, lireConsentement, photoAutorisee,
} from "@/lib/consentement-image";

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

const JOUR = "2026-10-19";
const PHOTO = "https://exemple.test/photo-1.jpg";
const AUTRE = "https://exemple.test/photo-2.jpg";
const oui = (photo = PHOTO) => consentementPour(photo, "oui", "u1", "2026-10-01T10:00:00.000Z");
const non = (photo = PHOTO) => consentementPour(photo, "non", "u1", "2026-10-01T10:00:00.000Z");

console.log("L'âge");

cas("seize ans, mineur", () => assert.equal(estMineur("2009-10-20", JOUR), true));
cas("dix-huit ans ce jour-là, majeur", () => assert.equal(estMineur("2008-10-19", JOUR), false));
cas("sans date, on ne le dit pas mineur", () => assert.equal(estMineur(null, JOUR), false));
cas("une date illisible ne dit rien non plus", () => assert.equal(estMineur("bientôt", JOUR), false));

console.log("\nL'état du consentement");

cas("un oui pour la photo en place : la photo passe", () => {
  const s = { photo: PHOTO, consentement: oui() };
  assert.equal(etatDuConsentement(s, JOUR), "oui");
  assert.equal(photoAutorisee(s, JOUR), PHOTO);
});

cas("un oui pour une ANCIENNE photo ne vaut rien pour la nouvelle", () => {
  const s = { photo: AUTRE, consentement: oui(PHOTO) };
  assert.equal(etatDuConsentement(s, JOUR), "aucun");
  assert.equal(photoAutorisee(s, JOUR), null);
});

cas("un non : pas de photo", () => {
  const s = { photo: PHOTO, consentement: non() };
  assert.equal(etatDuConsentement(s, JOUR), "non");
  assert.equal(photoAutorisee(s, JOUR), null);
});

cas("un mineur qui a dit oui garde l'avatar", () => {
  const s = { photo: PHOTO, consentement: oui(), dateNaissance: "2010-05-01" };
  assert.equal(etatDuConsentement(s, JOUR), "mineur");
  assert.equal(photoAutorisee(s, JOUR), null);
});

cas("sans photo, rien à autoriser", () => {
  assert.equal(etatDuConsentement({ photo: null, consentement: oui() }, JOUR), "aucun");
});

cas("sans réponse, c'est non", () => {
  assert.equal(photoAutorisee({ photo: PHOTO, consentement: undefined }, JOUR), null);
});

console.log("\nLe modal du joueur");

cas("une photo sans réponse : on demande", () => {
  assert.equal(aDemanderAuJoueur({ photo: PHOTO, consentement: null }, JOUR), true);
});

cas("une réponse pour cette photo : on ne redemande pas", () => {
  assert.equal(aDemanderAuJoueur({ photo: PHOTO, consentement: non() }, JOUR), false);
});

cas("une nouvelle photo : on redemande", () => {
  assert.equal(aDemanderAuJoueur({ photo: AUTRE, consentement: non(PHOTO) }, JOUR), true);
});

cas("un mineur n'est jamais demandé", () => {
  assert.equal(aDemanderAuJoueur({ photo: PHOTO, consentement: null, dateNaissance: "2012-01-01" }, JOUR), false);
});

cas("sans photo, rien à demander", () => {
  assert.equal(aDemanderAuJoueur({ photo: null, consentement: null }, JOUR), false);
});

console.log("\nLa lecture");

cas("une réponse inconnue est rejetée", () => {
  assert.equal(lireConsentement({ reponse: "peut-être", le: "x", par: "u1", photo: PHOTO }), null);
});

cas("une réponse sans photo est rejetée", () => {
  assert.equal(lireConsentement({ reponse: "oui", le: "x", par: "u1" }), null);
});

cas("une réponse complète se lit", () => {
  assert.deepEqual(lireConsentement(oui()), oui());
});

if (echecs > 0) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout passe.");
