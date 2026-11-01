/**
 * KOPPAFOOT — Vérification du rattachement d'une équipe de compétition aux
 * équipes de son manager (lib/rattachement-equipe). Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-rattachement.ts
 */
import assert from "node:assert/strict";
import {
  FICHES_REPRISES_MAX, choixParDefaut, effectifDepuisCompetition, equipeDepuisCompetition, gereLEquipe,
  lireRattachement, messageDeReprise,
} from "@/lib/rattachement-equipe";
import { planifierImport, proposerImport, type JoueurDuClub } from "@/lib/fusion-import";
import type { CompPlayer } from "@/types";

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

console.log("effectifDepuisCompetition");

/** Des identifiants de fiche prévisibles : g1, g2… */
const compteur = () => {
  let n = 0;
  return () => `g${++n}`;
};

const EFFECTIF: CompPlayer[] = [
  { id: "l1", name: "MENSAH  Koffi", number: "10", position: "Attaquant" },
  { id: "l2", name: "Afi", number: "", position: "Gardien" },
  { id: "l3", name: "Kodjo Amouzou", number: "4", user_id: "uKodjo" },
  { id: "l4", name: "Yawo", number: "7", position: "n'importe quoi" },
  { id: "u_uParti", name: "Parti", number: "9" },
  { id: "ghost_x", name: "Fiche d'un autre club", number: "3" },
  { id: "l5", name: "Déjà rapproché", number: "2", club_ghost_id: "autre" },
  { id: "l6", name: "   ", number: "11" },
];

cas("une fiche par ligne libre, rapprochée de sa ligne ; un compte se compte", () => {
  const r = effectifDepuisCompetition(EFFECTIF, compteur());
  assert.deepEqual(r.fiches.map((f) => f.id), ["g1", "g2", "g3"]);
  assert.equal(r.comptes, 1);
  assert.deepEqual(
    r.effectif.map((l) => [l.id, l.club_ghost_id ?? null]),
    [["l1", "g1"], ["l2", "g2"], ["l3", null], ["l4", "g3"], ["u_uParti", null], ["ghost_x", null], ["l5", "autre"], ["l6", null]],
  );
});

cas("la ligne garde son identifiant, son nom et sa photo ; l'entrée n'est pas modifiée", () => {
  const avant = JSON.stringify(EFFECTIF);
  const avecPhoto: CompPlayer[] = [{ id: "l1", name: "Koffi", number: "10", photo_url: "https://x/k.jpg" }];
  const r = effectifDepuisCompetition([...EFFECTIF, ...avecPhoto], compteur());
  assert.equal(JSON.stringify(EFFECTIF), avant);
  assert.equal(r.effectif[0].name, "MENSAH  Koffi");
  assert.equal(r.effectif.at(-1)!.photo_url, "https://x/k.jpg");
  assert.equal("photo_url" in r.fiches.at(-1)!, false);
});

cas("le nom se coupe au premier mot, et se recolle à l'identique", () => {
  const [koffi, afi] = effectifDepuisCompetition(EFFECTIF, compteur()).fiches;
  assert.equal(koffi.first_name, "MENSAH");
  assert.equal(koffi.last_name, "Koffi");
  assert.equal(`${afi.first_name} ${afi.last_name}`.trim(), "Afi");
});

cas("le poste quand il se lit, sinon milieu ; le dossard, ou rien ; des compteurs à zéro", () => {
  const [koffi, afi, yawo] = effectifDepuisCompetition(EFFECTIF, compteur()).fiches;
  assert.equal(koffi.position, "forward");
  assert.equal(afi.position, "goalkeeper");
  assert.equal(yawo.position, "midfielder");
  assert.equal(koffi.squad_number, "10");
  assert.equal(afi.squad_number, null);
  assert.deepEqual([koffi.goals, koffi.assists, koffi.matches_played], [0, 0, 0]);
});

cas("au-delà du plafond, les lignes restent libres", () => {
  const beaucoup: CompPlayer[] = Array.from({ length: FICHES_REPRISES_MAX + 5 }, (_, i) => ({ id: `l${i}`, name: `Joueur ${i}`, number: "" }));
  const r = effectifDepuisCompetition(beaucoup, compteur());
  assert.equal(r.fiches.length, FICHES_REPRISES_MAX);
  assert.equal(r.effectif.filter((l) => !l.club_ghost_id).length, 5);
});

cas("un effectif vide ne crée rien", () => {
  assert.deepEqual(effectifDepuisCompetition([], compteur()), { effectif: [], fiches: [], comptes: 0 });
});

cas("le « Resynchroniser » qui suit n'a rien à refaire pour ces fiches", () => {
  const r = effectifDepuisCompetition(EFFECTIF, compteur());
  const club: JoueurDuClub[] = r.fiches.map((f) => ({
    genre: "sans_compte", id: f.id, nom: `${f.first_name} ${f.last_name}`.trim(), numero: f.squad_number ?? "",
  }));
  const { propositions, aJour } = proposerImport(r.effectif, club, new Set());
  assert.equal(propositions.length, 0);
  assert.equal(aJour, r.fiches.length);
  const plan = planifierImport(r.effectif, club, {}, new Set());
  assert.equal(plan.ajoutes, 0);
  assert.deepEqual(plan.effectif, r.effectif);
});

console.log("messageDeReprise");

cas("ce qui a été repris, et les comptes à inviter", () => {
  assert.equal(
    messageDeReprise("Team YAS", { fiches: 12, comptes: 3, categorie: "men" }),
    "« Team YAS » est maintenant dans tes équipes, avec 12 joueurs de l'effectif. 3 joueurs ont un compte KoppaFoot : invite-les depuis ton équipe pour qu'ils la rejoignent.",
  );
  assert.equal(
    messageDeReprise("Team YAS", { fiches: 1, comptes: 0, categorie: null }),
    "« Team YAS » est maintenant dans tes équipes, avec 1 joueur de l'effectif.",
  );
  assert.equal(messageDeReprise("Team YAS", { fiches: 0, comptes: 0, categorie: null }), "« Team YAS » est maintenant dans tes équipes.");
});

cas("une équipe féminine parle de joueuses", () => {
  assert.equal(
    messageDeReprise("Les Lionnes", { fiches: 0, comptes: 1, categorie: "women" }),
    "« Les Lionnes » est maintenant dans tes équipes. 1 joueuse a un compte KoppaFoot : invite-la depuis ton équipe pour qu'elle la rejoigne.",
  );
  assert.match(messageDeReprise("Les Lionnes", { fiches: 8, comptes: 2, categorie: "women" }), /8 joueuses .* 2 joueuses .* qu'elles la rejoignent/);
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
