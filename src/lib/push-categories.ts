import type { NotificationType } from "@/types";

// ============================================
// Les catégories de notification push.
//
// POURQUOI DES CATÉGORIES, et pas un seul interrupteur. Un seul interrupteur
// n'offre qu'un arbitrage : tout ou rien. Quelqu'un que les mouvements
// d'effectif agacent coupe alors AUSSI les convocations, c'est-à-dire la seule
// chose pour laquelle il avait accepté les notifications. Le produit perd le
// canal entier sur une gêne mineure.
//
// Ce fichier n'a pas de directive « use client » exprès : le réglage se règle
// dans le navigateur mais se FILTRE sur le serveur, au moment de l'envoi. Les
// deux côtés doivent donc lire la même table, sans quoi une case décochée à
// l'écran laisserait passer les messages.
//
// L'ABSENCE DE PRÉFÉRENCE VAUT OUI. Aucun compte existant n'a ce champ : le
// défaut inverse couperait d'un coup les notifications de tout le monde, un
// réglage n'est pas une migration.
// ============================================

export type PushCategory =
  /** Ce qui m'est adressé à moi : invitation, demande, défi, convocation,
   *  réponse à une candidature. */
  | "perso"
  /** La vie d'une équipe dont je fais partie. */
  | "equipe"
  /** La vie de ce que je suis, sans en faire partie. */
  | "suivis"
  /** Le direct des compétitions que je suis : coup d'envoi, buts, fin. */
  | "competitions"
  /** Ce que la plateforme diffuse, campagnes et messages d'administration. */
  | "annonces";

/** L'ordre d'affichage dans le menu, du plus personnel au plus diffus. */
export const CATEGORIES_PUSH: PushCategory[] = [
  "perso",
  "equipe",
  "suivis",
  "competitions",
  "annonces",
];

export type PushPrefs = Partial<Record<PushCategory, boolean>>;

/**
 * De quel casier relève une notification.
 *
 * La table part des types déjà écrits dans `NotificationType` plutôt que d'en
 * inventer de nouveaux : chaque envoi existant tombe donc quelque part, et un
 * type ajouté plus tard sans catégorie passera par le défaut (tout envoyer),
 * ce qui est le comportement d'avant ce fichier.
 */
export function categorieDuType(type: NotificationType): PushCategory {
  switch (type) {
    case "invitation":
    case "join_request":
    case "match_challenge":
    case "participation_request":
      return "perso";
    case "team_activity":
      return "equipe";
    case "follow_activity":
      return "suivis";
    case "admin_message":
      return "annonces";
  }
}

/**
 * Cette notification a-t-elle le droit de partir ?
 *
 * Sans catégorie (un envoi qu'on n'a pas encore classé) et sans préférence
 * enregistrée, la réponse est oui : le filtre ne doit jamais faire taire plus
 * que ce que l'utilisateur a explicitement décoché.
 */
export function pushAutorise(prefs: PushPrefs | undefined, categorie?: PushCategory): boolean {
  if (!categorie || !prefs) return true;
  return prefs[categorie] !== false;
}
