/**
 * KOPPAFOOT — Vérification du tirage des emplacements (lib/partenaires).
 * Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-partenaires.ts
 */
import assert from "node:assert/strict";
import { choisirAffiches, ordreDuTirage, type FirestorePartenariat } from "@/lib/partenaires";

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

type Candidat = Pick<FirestorePartenariat, "competition_id" | "type" | "format" | "image_url"> & { id: string };

function marque(id: string, champs: Partial<Candidat> = {}): Candidat {
  return { id, competition_id: null, type: "annonce", format: "banniere", image_url: `https://x/${id}.png`, ...champs };
}

/** Un hasard rejoué : les valeurs données, dans l'ordre, puis la dernière. */
function hasard(...valeurs: number[]): () => number {
  let i = 0;
  return () => valeurs[Math.min(i++, valeurs.length - 1)];
}

const ids = (l: { id: string }[]) => l.map((p) => p.id);

console.log("choisirAffiches");

cas("un partenaire ne fait plus taire les annonces de son emplacement", () => {
  const r = choisirAffiches([
    marque("hope", { type: "partenaire" }),
    marque("cydje"),
    marque("flowkraft"),
  ], null);
  assert.deepEqual(ids(r).sort(), ["cydje", "flowkraft", "hope"]);
});

cas("deux partenaires du même emplacement sont tous deux renvoyés", () => {
  const r = choisirAffiches([marque("wakhen", { type: "partenaire" }), marque("hope", { type: "partenaire" })], null);
  assert.deepEqual(ids(r).sort(), ["hope", "wakhen"]);
});

cas("un partenariat d'avant les annonces (type absent) compte comme partenaire", () => {
  const r = choisirAffiches([marque("ancien", { type: undefined, format: undefined }), marque("cydje")], null);
  assert.deepEqual(ids(r).sort(), ["ancien", "cydje"]);
});

cas("une annonce sans visuel est écartée", () => {
  const r = choisirAffiches([marque("cydje"), marque("vide", { image_url: null })], null);
  assert.deepEqual(ids(r), ["cydje"]);
});

cas("sur la page d'une compétition, ses propres marques passent avant les générales", () => {
  const r = choisirAffiches([
    marque("general", { type: "partenaire" }),
    marque("sponsor", { type: "partenaire", competition_id: "c1" }),
    marque("annonce-c1", { competition_id: "c1" }),
  ], "c1");
  assert.deepEqual(ids(r).sort(), ["annonce-c1", "sponsor"]);
});

cas("une compétition sans marque propre montre les générales", () => {
  const r = choisirAffiches([marque("general", { type: "partenaire" }), marque("cydje")], "c1");
  assert.deepEqual(ids(r).sort(), ["cydje", "general"]);
});

console.log("ordreDuTirage");

const melange = [
  marque("cydje"),
  marque("wakhen", { type: "partenaire" }),
  marque("flowkraft"),
  marque("hope", { type: "partenaire" }),
];

cas("les partenaires passent en tête, quel que soit le tirage", () => {
  for (const v of [0, 0.3, 0.6, 0.99]) {
    const r = ordreDuTirage(melange, hasard(v));
    assert.deepEqual(r.slice(0, 2).map((p) => p.type).sort(), ["partenaire", "partenaire"], `tirage ${v}`);
    assert.deepEqual(r.slice(2).map((p) => p.type), ["annonce", "annonce"], `tirage ${v}`);
  }
});

cas("l'ordre des partenaires entre eux dépend du tirage", () => {
  const premiers = new Set([0, 0.99].map((v) => ordreDuTirage(melange, hasard(v))[0].id));
  assert.deepEqual([...premiers].sort(), ["hope", "wakhen"]);
});

cas("l'ordre des annonces entre elles dépend du tirage", () => {
  const troisiemes = new Set([0, 0.99].map((v) => ordreDuTirage(melange, hasard(v))[2].id));
  assert.deepEqual([...troisiemes].sort(), ["cydje", "flowkraft"]);
});

cas("la liste reçue n'est pas modifiée", () => {
  const avant = ids(melange);
  ordreDuTirage(melange, hasard(0.5));
  assert.deepEqual(ids(melange), avant);
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
