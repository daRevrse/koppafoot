/**
 * KOPPAFOOT — Vérification du tirage des emplacements (lib/partenaires).
 * Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-partenaires.ts
 */
import assert from "node:assert/strict";
import {
  ANNONCE_EN_LOGO, SANS_LOGO, SANS_VISUEL, avisLogo, choisirAffiches, logoDe, ordreDuTirage, partenairesDuProgramme,
  refusDuPartenariat,
  type FirestorePartenariat,
} from "@/lib/partenaires";

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
    marque("hibiscus", { type: "partenaire" }),
    marque("cedre"),
    marque("figuier"),
  ], null);
  assert.deepEqual(ids(r).sort(), ["cedre", "figuier", "hibiscus"]);
});

cas("deux partenaires du même emplacement sont tous deux renvoyés", () => {
  const r = choisirAffiches([marque("wassa", { type: "partenaire" }), marque("hibiscus", { type: "partenaire" })], null);
  assert.deepEqual(ids(r).sort(), ["hibiscus", "wassa"]);
});

cas("un partenariat d'avant les annonces (type absent) compte comme partenaire", () => {
  const r = choisirAffiches([marque("ancien", { type: undefined, format: undefined }), marque("cedre")], null);
  assert.deepEqual(ids(r).sort(), ["ancien", "cedre"]);
});

cas("une annonce sans visuel est écartée", () => {
  const r = choisirAffiches([marque("cedre"), marque("vide", { image_url: null })], null);
  assert.deepEqual(ids(r), ["cedre"]);
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
  const r = choisirAffiches([marque("general", { type: "partenaire" }), marque("cedre")], "c1");
  assert.deepEqual(ids(r).sort(), ["cedre", "general"]);
});

console.log("ordreDuTirage");

const melange = [
  marque("cedre"),
  marque("wassa", { type: "partenaire" }),
  marque("figuier"),
  marque("hibiscus", { type: "partenaire" }),
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
  assert.deepEqual([...premiers].sort(), ["hibiscus", "wassa"]);
});

cas("l'ordre des annonces entre elles dépend du tirage", () => {
  const troisiemes = new Set([0, 0.99].map((v) => ordreDuTirage(melange, hasard(v))[2].id));
  assert.deepEqual([...troisiemes].sort(), ["cedre", "figuier"]);
});

cas("la liste reçue n'est pas modifiée", () => {
  const avant = ids(melange);
  ordreDuTirage(melange, hasard(0.5));
  assert.deepEqual(ids(melange), avant);
});

console.log("logoDe");

cas("un partenaire au format logo : son visuel est son logo", () => {
  assert.equal(logoDe({ format: "logo", image_url: "https://x/logo.png", logo_url: null }), "https://x/logo.png");
});

cas("une bannière : le logo envoyé à part, jamais la bannière", () => {
  assert.equal(logoDe({ format: "banniere", image_url: "https://x/banniere.png", logo_url: "https://x/logo.png" }), "https://x/logo.png");
  assert.equal(logoDe({ format: "banniere", image_url: "https://x/banniere.png", logo_url: null }), null);
  assert.equal(logoDe({ format: "banniere", image_url: "https://x/banniere.png" }), null);
});

cas("un partenariat d'avant les formats (format absent) : son visuel est un logo", () => {
  assert.equal(logoDe({ image_url: "https://x/logo.png" }), "https://x/logo.png");
});

console.log("refusDuPartenariat");

const base = {
  type: "partenaire" as const, format: "banniere" as const, emplacements: ["direct" as const], visuel: true, logo: false,
};

cas("une bannière avec son visuel, hors affiche : acceptée sans logo", () => {
  assert.equal(refusDuPartenariat(base), null);
});

cas("une bannière sur l'affiche du joueur de la semaine sans logo : refusée", () => {
  assert.equal(refusDuPartenariat({ ...base, emplacements: ["direct", "affiche_semaine"] }), SANS_LOGO);
});

cas("une bannière sur l'affiche avec son logo : acceptée", () => {
  assert.equal(refusDuPartenariat({ ...base, emplacements: ["affiche_semaine"], logo: true }), null);
});

cas("un partenaire au format logo sur l'affiche : son visuel suffit", () => {
  assert.equal(refusDuPartenariat({ ...base, format: "logo", emplacements: ["affiche_semaine"] }), null);
});

cas("un partenaire au format logo sans image, sur l'affiche : refusé", () => {
  assert.equal(refusDuPartenariat({ ...base, format: "logo", emplacements: ["affiche_semaine"], visuel: false }), SANS_LOGO);
});

cas("les refus d'avant tiennent toujours", () => {
  assert.equal(refusDuPartenariat({ ...base, type: "annonce", format: "logo" }), ANNONCE_EN_LOGO);
  assert.equal(refusDuPartenariat({ ...base, visuel: false }), SANS_VISUEL);
});

console.log("avisLogo");

cas("un logo assez large ne demande rien", () => {
  assert.equal(avisLogo(600, 600), null);
  assert.equal(avisLogo(900, 240), null);
});

cas("un logo trop étroit est signalé", () => {
  assert.match(avisLogo(200, 200) ?? "", /200 px/);
});

console.log("partenairesDuProgramme");

cas("le partenaire de la compétition, avec un logo, à l'affiche ; deux au plus, le plus récent d'abord", () => {
  const p = (id: string, champs: Partial<FirestorePartenariat> = {}) => ({
    id, competition_id: "c1", type: "partenaire" as const, format: "logo" as const, image_url: `https://x/${id}.png`,
    logo_url: null, actif: true, debut: "2026-10-01", fin: "2026-12-31", ...champs,
  });
  const r = partenairesDuProgramme([
    p("ancien", { debut: "2026-09-01" }),
    p("recent", { debut: "2026-10-15" }),
    p("milieu", { debut: "2026-10-05" }),
    p("annonce", { type: "annonce", format: "banniere" }),
    p("general", { competition_id: null }),
    p("autre", { competition_id: "c2" }),
    p("sans-logo", { format: "banniere", logo_url: null }),
    p("fini", { fin: "2026-10-01" }),
    p("eteint", { actif: false }),
  ], "c1", "2026-10-22");
  assert.deepEqual(r.map((x) => x.id), ["recent", "milieu"]);
});

cas("une bannière avec son logo à part compte", () => {
  const r = partenairesDuProgramme([{
    id: "b", competition_id: "c1", type: "partenaire" as const, format: "banniere" as const, image_url: "https://x/b.png",
    logo_url: "https://x/logo.png", actif: true, debut: "2026-10-01", fin: "2026-12-31",
  }], "c1", "2026-10-22");
  assert.deepEqual(r.map((x) => x.id), ["b"]);
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
