import { accorder, type Genre } from "@/lib/genre";
import type { EvolutionRole } from "@/types";

// L'onglet Évolution : l'écran où un compte choisit son rôle (ChoixDuRole du
// site), puis, le rôle choisi, celui de sa fiche. Les mots du site.

export const ROLES: {
  role: EvolutionRole;
  /** Le titre au masculin, au féminin. */
  titre: [string, string];
  phrase: string;
  /** Le nom de l'espace, tel qu'on l'annonce en l'activant. */
  espace: string;
  /** Ce que le formulaire d'activation demande, dit en une ligne. */
  formulaire: string;
}[] = [
  { role: "player", titre: ["Joueur", "Joueuse"], phrase: "Tu joues dans une équipe, ou tu veux en rejoindre une.", espace: "Espace joueur", formulaire: "Ton profil sportif" },
  { role: "manager", titre: ["Manager", "Manager"], phrase: "Tu diriges une équipe et son effectif.", espace: "Espace manager", formulaire: "Ton profil de manager" },
  { role: "referee", titre: ["Arbitre", "Arbitre"], phrase: "Tu tiens le sifflet.", espace: "Espace arbitre", formulaire: "Ta fiche d'arbitre" },
];

/** Le nom du rôle pour ce compte : « Joueuse » pour une joueuse, et « Joueur, joueuse » tant qu'on ne sait pas. */
export function nomDuRole([m, f]: [string, string], genre: Genre | null | undefined): string {
  if (genre) return accorder(genre, m, f);
  return m === f ? m : `${m}, ${f.toLowerCase()}`;
}

/** Le titre de l'onglet : « Évolution » sans rôle, le nom du rôle ensuite. */
export function titreDeLOnglet(profil: { evolutionRole?: EvolutionRole | null; gender?: Genre | null } | null): string {
  const r = ROLES.find((x) => x.role === profil?.evolutionRole);
  return r ? accorder(profil?.gender ?? null, r.titre[0], r.titre[1]) : "Évolution";
}

/**
 * Les champs qu'un titulaire peut écrire en changeant de rôle, et rien
 * d'autre (`isRoleEvolution` dans firestore.rules) : une clé de plus, et la
 * règle rejette l'activation entière.
 */
export const CHAMPS_DU_ROLE = [
  "user_type", "evolution_role", "position", "skill_level", "strong_foot", "team_name", "location_city", "updated_at",
  "license_level", "license_number", "gender",
] as const;

export interface ChampsDActivation {
  genre: Genre;
  ville: string;
  poste: string;
  pied: string;
  equipe: string;
  licence: string;
  numero: string;
}

/** Ce que l'activation écrit dans le compte, comme `activer` de ChoixDuRole : un champ vide n'est pas écrit. */
export function patchDActivation(role: EvolutionRole, c: ChampsDActivation): Record<string, string> {
  const patch: Record<string, string> = {
    evolution_role: role,
    user_type: role,
    location_city: c.ville.trim(),
    gender: c.genre,
  };
  if (role === "player") {
    if (c.poste) patch.position = c.poste;
    if (c.pied) patch.strong_foot = c.pied;
  } else if (role === "referee") {
    if (c.licence) patch.license_level = c.licence;
    if (c.numero.trim()) patch.license_number = c.numero.trim();
  } else if (c.equipe.trim()) {
    patch.team_name = c.equipe.trim();
  }
  return patch;
}
