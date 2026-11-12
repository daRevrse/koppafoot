import { normaliserVille } from "@/lib/villes";
import { accorder, type Genre } from "@/lib/genre";
import type { EvolutionRole } from "@/types";
import type { ChampsEquipe } from "~/lib/equipe-api";

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
    location_city: normaliserVille(c.ville),
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

/** Ce que l'activation fait de l'équipe nommée dans le formulaire du manager. */
export type EquipeDeLActivation =
  | { genre: "rien" }
  | { genre: "deja"; nom: string }
  | { genre: "sans-ville" }
  | { genre: "creer"; champs: ChampsEquipe };

const memeNom = (a: string, b: string) =>
  a.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase() === b.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * L'ÉQUIPE NOMMÉE À L'ACTIVATION EST CRÉÉE. Le nom n'allait que dans
 * `team_name` du profil (comme sur le site), et le manager tombait ensuite sur
 * « Tu ne diriges pas encore d'équipe ». La création passe par la même route
 * que « Créer mon équipe », avec les réglages par défaut de son formulaire ;
 * pas de doublon d'une équipe qu'on gère déjà, et pas sans ville (le serveur
 * la refuse).
 */
export function equipeDeLActivation(
  role: EvolutionRole,
  c: ChampsDActivation,
  nomsDejaGeres: string[],
): EquipeDeLActivation {
  const nom = c.equipe.trim().replace(/\s+/g, " ");
  if (role !== "manager" || !nom) return { genre: "rien" };
  if (nomsDejaGeres.some((n) => memeNom(n, nom))) return { genre: "deja", nom };
  const ville = normaliserVille(c.ville);
  if (!ville) return { genre: "sans-ville" };
  return {
    genre: "creer",
    champs: {
      name: nom, city: ville, level: "amateur", category: c.genre === "female" ? "women" : "men",
      color: "emerald", description: "", maxMembers: 14,
    },
  };
}
