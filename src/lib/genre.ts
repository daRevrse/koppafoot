// ============================================
// Le genre d'un compte, et la catégorie d'une équipe ou d'une compétition.
//
// LE PRODUIT PARLAIT DE TOUT LE MONDE AU MASCULIN. Une gardienne était
// « Gardien », une joueuse élue « Homme du match », une arbitre « convoqué »,
// et un manager d'équipe féminine n'avait aucun moyen de chercher des
// joueuses au mercato. Il manquait deux informations, pas une :
//
//   - le GENRE d'une personne (Homme, Femme), qui accorde ce qu'on dit d'elle ;
//   - la CATÉGORIE d'une équipe ou d'une compétition (masculine, féminine,
//     mixte), qui dit qui y joue.
//
// La seconde rattrape la première là où elle manque : les joueurs sans compte
// d'une équipe féminine n'ont pas de genre enregistré, mais ce sont des
// joueuses. Voir `genreDuJoueur`.
//
// Sans directive : lu par le serveur (notifications, e-mails) comme par le
// navigateur, et par l'application mobile.
// ============================================

import type { Langue } from "@/i18n/config";

/** Ce que le compte a déclaré. Écrit tel quel dans `users.gender`. */
export type Genre = "male" | "female";

export const GENRES: readonly Genre[] = ["male", "female"] as const;

/** Qui joue dans une équipe ou une compétition. Écrit dans `category`. */
export type Categorie = "men" | "women" | "mixed";

export const CATEGORIES: readonly Categorie[] = ["men", "women", "mixed"] as const;

/** Une valeur lue en base, ou rien : un compte d'avant n'a pas de genre. */
export function lireGenre(brut: unknown): Genre | null {
  return brut === "male" || brut === "female" ? brut : null;
}

export function lireCategorie(brut: unknown): Categorie | null {
  return brut === "men" || brut === "women" || brut === "mixed" ? brut : null;
}

/**
 * Le mot accordé au genre de la personne.
 *
 * LE MASCULIN QUAND ON NE SAIT PAS, comme la langue le fait d'elle-même :
 * c'est ce que le produit écrivait pour tout le monde jusqu'ici, et un compte
 * de spectateur n'a pas à déclarer quoi que ce soit.
 */
export function accorder<T>(genre: Genre | null | undefined, masculin: T, feminin: T): T {
  return genre === "female" ? feminin : masculin;
}

/**
 * Le genre à retenir pour quelqu'un sur une feuille de match ou un effectif.
 *
 * Le sien s'il l'a dit ; sinon celui de son équipe, quand elle est féminine :
 * la plupart des lignes d'effectif n'ont pas de compte derrière, et une
 * équipe féminine aligne des joueuses. Une équipe mixte ne dit rien de
 * chacun, et une masculine rien de plus que le défaut.
 */
export function genreDuJoueur(
  genre: Genre | null | undefined,
  categorie: Categorie | null | undefined,
): Genre | null {
  if (genre) return genre;
  return categorie === "women" ? "female" : null;
}

export const LIBELLES_GENRE: Record<Langue, Record<Genre, string>> = {
  fr: { male: "Homme", female: "Femme" },
  en: { male: "Man", female: "Woman" },
};

/** « Masculin », « Féminin », « Mixte » : ce qu'on écrit à côté d'un nom d'équipe. */
export const LIBELLES_CATEGORIE: Record<Langue, Record<Categorie, string>> = {
  fr: { men: "Masculin", women: "Féminin", mixed: "Mixte" },
  en: { men: "Men", women: "Women", mixed: "Mixed" },
};

/**
 * Faut-il un badge à côté du nom ? Pas pour une équipe masculine : c'est ce
 * que tout le monde suppose déjà, et un badge sur neuf équipes sur dix ne
 * distinguerait plus rien. Féminin et mixte, oui.
 */
export function categorieAffichee(categorie: Categorie | null | undefined): categorie is "women" | "mixed" {
  return categorie === "women" || categorie === "mixed";
}

/**
 * Une personne de ce genre peut-elle jouer dans cette catégorie ? Sert aux
 * filtres et aux avertissements, JAMAIS à un refus : le manager et
 * l'organisateur restent juges, et un genre non déclaré ne ferme rien.
 */
export function compatible(genre: Genre | null | undefined, categorie: Categorie | null | undefined): boolean {
  if (!genre || !categorie || categorie === "mixed") return true;
  return categorie === "women" ? genre === "female" : genre === "male";
}

// ---- Ce qu'on est, accordé -------------------------------------------------

/** Les rôles Evolution et les casquettes, par leur clé dans le produit. */
export type Titre = "player" | "manager" | "referee" | "organizer" | "scorer" | "venue_owner";

const TITRES: Record<Langue, Record<Titre, [string, string]>> = {
  fr: {
    player: ["Joueur", "Joueuse"],
    manager: ["Manager", "Manager"],
    referee: ["Arbitre", "Arbitre"],
    organizer: ["Organisateur", "Organisatrice"],
    scorer: ["Scoreur", "Scoreuse"],
    venue_owner: ["Propriétaire de terrain", "Propriétaire de terrain"],
  },
  en: {
    player: ["Player", "Player"],
    manager: ["Manager", "Manager"],
    referee: ["Referee", "Referee"],
    organizer: ["Organiser", "Organiser"],
    scorer: ["Scorer", "Scorer"],
    venue_owner: ["Pitch owner", "Pitch owner"],
  },
};

/** « Joueuse », « Organisatrice », « Arbitre ». */
export function titre(t: Titre, genre: Genre | null | undefined, langue: Langue = "fr"): string {
  const [m, f] = TITRES[langue][t];
  return accorder(genre, m, f);
}

/**
 * Un compte à rôle doit avoir dit son genre : son titre, son poste et les
 * messages qu'il reçoit s'accordent, et un manager d'équipe féminine le
 * cherche au mercato. Un spectateur, lui, n'a rien à déclarer.
 */
export function genreRequis(compte: {
  gender?: Genre | null;
  evolutionRole?: string | null;
  isOrganizer?: boolean;
  isVenueOwner?: boolean;
  isScorer?: boolean;
} | null | undefined): boolean {
  if (!compte || compte.gender) return false;
  return !!(compte.evolutionRole || compte.isOrganizer || compte.isVenueOwner || compte.isScorer);
}
