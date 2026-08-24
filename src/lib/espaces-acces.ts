import { isOrganizer, isSuperAdmin, isVenueOwner } from "@/lib/hats";
import type { EvolutionRole, UserProfile } from "@/types";

// ============================================
// À quels espaces un compte a accès.
//
// POURQUOI CE N'EST PAS « QUEL RÔLE A-T-IL CHOISI ». Un rôle n'est qu'une des
// deux façons d'ouvrir un espace. Les casquettes — organisateur, propriétaire
// de terrain — s'obtiennent par candidature, se cumulent, et n'ont rien à
// voir avec le rôle ; la console live s'ouvre parce qu'on modère une
// compétition, sans casquette ni rôle. Lire la seule colonne « rôle » revenait
// donc à ne voir qu'une partie de ce que les gens peuvent réellement faire.
//
// LE CALCUL RÉUTILISE lib/hats, celui-là même dont se sert la navigation du
// produit (voir hooks/useEspaces). Le recopier ici aurait produit, tôt ou
// tard, une administration qui affiche un accès que le produit n'ouvre pas —
// ou l'inverse, ce qui est pire, personne n'allant vérifier.
//
// LA MODÉRATION NE SE LIT PAS SUR LE COMPTE : elle vit dans
// `competitions.moderator_ids`. L'appelant fournit donc l'ensemble des
// modérateurs, qu'il lit une fois pour toute sa liste plutôt qu'une requête
// par ligne.
// ============================================

export type EspaceAcces =
  | "joueur"
  | "manager"
  | "arbitre"
  | "organisateur"
  | "terrains"
  | "live"
  | "administration";

export const ESPACE_LABELS: Record<EspaceAcces, string> = {
  joueur: "Joueur",
  manager: "Manager",
  arbitre: "Arbitre",
  organisateur: "Organisateur",
  terrains: "Terrains",
  live: "Console live",
  administration: "Administration",
};

/**
 * Le rôle qu'un compte porte réellement.
 *
 * DEUX SIGNAUX, comme pour les casquettes (voir lib/hats). `evolution_role`
 * est le rôle ACTIVÉ, choisi dans Évolution. `user_type` est ce qui a été dit
 * à l'inscription, et c'est tout ce que portent les comptes créés avant
 * qu'Évolution existe. Ne lire que le premier fait apparaître « Aucun » sur
 * des joueurs, des managers et des arbitres qui se sont bel et bien déclarés.
 *
 * L'ordre compte : ce qu'on a activé prime sur ce qu'on avait déclaré, un
 * compte qui change de rôle dans Évolution ne doit pas rester ce qu'il était.
 * Les autres valeurs de `user_type` — organisateur, propriétaire, admin — ne
 * sont pas des rôles et ne remontent jamais ici, ce sont des casquettes.
 */
export function roleEffectif(
  user: Pick<UserProfile, "evolutionRole" | "userType">,
): EvolutionRole | null {
  if (user.evolutionRole) return user.evolutionRole;
  const type = user.userType;
  return type === "player" || type === "manager" || type === "referee" ? type : null;
}

/**
 * Le rôle est-il HÉRITÉ plutôt qu'activé ?
 *
 * La distinction n'est pas cosmétique : la navigation du produit n'ouvre
 * l'espace d'un rôle que s'il a été activé (voir hooks/useEspaces). Un compte
 * hérité se déclare donc manager sans que le produit lui ouvre quoi que ce
 * soit — c'est exactement la population qu'une relance doit aller chercher, et
 * il faut pouvoir la voir.
 */
export function roleHerite(
  user: Pick<UserProfile, "evolutionRole" | "userType">,
): boolean {
  return !user.evolutionRole && roleEffectif(user) !== null;
}

/** Ce qui vient du rôle, à ne pas confondre avec ce qui vient d'une casquette. */
const ESPACE_DU_ROLE: Record<string, EspaceAcces> = {
  player: "joueur",
  manager: "manager",
  referee: "arbitre",
};

/**
 * Les espaces qu'un compte peut ouvrir, dans l'ordre où on les lit : ce qu'il
 * EST sur le terrain d'abord, ce qu'il FAIT ensuite.
 *
 * Une liste vide n'est pas une anomalie de données : c'est un compte qui n'a
 * jamais choisi de rôle et ne s'est porté candidat à rien. Il ne voit que le
 * tableau des scores, ce qui est le cas de la plus grande partie des
 * inscrits — et c'est précisément ce que cette fonction sert à rendre
 * visible.
 */
export function espacesDuCompte(
  user: UserProfile,
  moderateurs?: Set<string>,
): EspaceAcces[] {
  const espaces: EspaceAcces[] = [];

  const duRole = user.evolutionRole ? ESPACE_DU_ROLE[user.evolutionRole] : null;
  if (duRole) espaces.push(duRole);

  if (isOrganizer(user)) espaces.push("organisateur");
  if (moderateurs?.has(user.uid)) espaces.push("live");
  if (isVenueOwner(user)) espaces.push("terrains");
  if (isSuperAdmin(user)) espaces.push("administration");

  return espaces;
}
