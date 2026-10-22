/**
 * KOPPAFOOT — Vérification du rattachement d'une équipe de compétition aux
 * équipes de son manager (lib/rattachement-equipe). Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-rattachement.ts
 */
import assert from "node:assert/strict";
import { choixParDefaut, equipeDepuisCompetition, gereLEquipe, lireRattachement } from "@/lib/rattachement-equipe";

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

console.log("lireRattachement");

cas("rien : l'ancien comportement, sans lien", () => {
  assert.deepEqual(lireRattachement(undefined), { type: "aucun" });
  assert.deepEqual(lireRattachement(null), { type: "aucun" });
});

cas("« nouvelle », ou l'identifiant d'une équipe existante", () => {
  assert.deepEqual(lireRattachement("nouvelle"), { type: "nouvelle" });
  assert.deepEqual(lireRattachement("abcDEF123"), { type: "existante", equipeId: "abcDEF123" });
});

cas("un identifiant bricolé est refusé", () => {
  for (const x of ["", "a/b", "x".repeat(200), 42, { id: "a" }, ".."]) assert.equal(lireRattachement(x), null, JSON.stringify(x));
});

console.log("gereLEquipe");

cas("le manager, ou un adjoint délégué ; personne d'autre", () => {
  assert.equal(gereLEquipe({ manager_id: "u1" }, "u1"), true);
  assert.equal(gereLEquipe({ manager_id: "u2", staff_manager_ids: ["u1"] }, "u1"), true);
  assert.equal(gereLEquipe({ manager_id: "u2", staff_manager_ids: [] }, "u1"), false);
  assert.equal(gereLEquipe({ manager_id: "u2", member_ids: ["u1"] } as never, "u1"), false);
});

console.log("equipeDepuisCompetition");

cas("le nom, le logo, la ville de la compétition, la catégorie ; le manager est l'appelant", () => {
  const d = equipeDepuisCompetition({ nom: "  Team YAS ", logo: "https://x/yas.png", ville: "Lomé", categorie: "women" }, "u1");
  assert.equal(d.name, "Team YAS");
  assert.equal(d.logo_url, "https://x/yas.png");
  assert.equal(d.city, "Lomé");
  assert.equal(d.category, "women");
  assert.equal(d.manager_id, "u1");
  assert.deepEqual(d.member_ids, []);
  assert.equal(d.is_recruiting, true);
});

cas("sans ville ni catégorie lisible : une ville par défaut, pas de catégorie", () => {
  const d = equipeDepuisCompetition({ nom: "Team YAS", logo: null, ville: null, categorie: "autre" }, "u1");
  assert.equal(d.city, "Lomé");
  assert.equal("category" in d, false);
  assert.equal(d.logo_url, null);
});

console.log("choixParDefaut");

cas("une équipe du même nom, accents et casse mis à part, est proposée d'abord", () => {
  const miennes = [{ id: "k", name: "KOPPA F.C." }, { id: "y", name: "team yas" }];
  assert.equal(choixParDefaut(miennes, "Team YAS"), "y");
  assert.equal(choixParDefaut([{ id: "e", name: "Étoile de Bè" }], "ETOILE DE BE"), "e");
});

cas("sinon, créer l'équipe", () => {
  assert.equal(choixParDefaut([{ id: "k", name: "KOPPA F.C." }], "Team YAS"), "nouvelle");
  assert.equal(choixParDefaut([], "Team YAS"), "nouvelle");
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
