// ============================================
// Ce qu'un match peut enregistrer, en un seul endroit.
//
// La liste vivait recopiee a quatre endroits : deux fois dans les types
// (le match amical et le match de competition), deux fois dans
// `competition-firestore`. Quatre copies qui divergeaient deja — celles de
// `competition-firestore` ignoraient `period_start` et `period_end`, que la
// console ecrit pourtant.
//
// TROIS NOUVEAUX, TOUS MINEURS : l'arret, la faute, le hors-jeu. Mineurs a un
// sens precis ici, ils ne partent pas en notification. On reveille le telephone
// d'un supporter pour un but ou une expulsion, pas pour un hors-jeu a la 12e.
// Ils vivent dans l'historique du match, et ils alimentent les classements :
// l'arret est la seule chose qu'un gardien produise et qu'on sache compter.
//
// PUIS SIX AUTRES, QUI NE RACONTENT RIEN : le tir, le tir cadre, le corner,
// la touche, le coup franc, le penalty obtenu. Ils existent pour les
// statistiques et pour la note des joueurs, pas pour le recit — une touche
// n'a jamais interesse personne, et il y en a quarante par match. D'ou la
// troisieme categorie ci-dessous, `estStatistique` : le fil public rend TOUT
// ce qui n'est pas un repere de periode, et les y laisser noierait les buts.
// ============================================

export type TypeEvenement =
  // Les majeurs, ceux qui changent le tableau d'affichage ou le nombre de
  // joueurs sur le terrain. Ils partent en notification.
  | "goal"
  | "yellow_card"
  | "red_card"
  | "substitution"
  // Les reperes de deroule, poses par la console elle-meme.
  | "period_start"
  | "period_end"
  // Les mineurs, saisis joueur par joueur, jamais notifies.
  | "save"
  | "foul"
  | "offside"
  // Le penalty obtenu : jamais notifie, mais il fait partie du recit.
  | "penalty"
  // Les comptables : ni notification, ni fil. Des compteurs, et rien d'autre.
  | "shot"
  | "shot_on_target"
  | "corner"
  | "throw_in"
  | "free_kick";

/**
 * Ceux qu'on saisit en touchant un joueur.
 *
 * `substitution` n'en est pas : elle se saisit a deux joueurs, celui qui sort
 * et celui qui entre, et elle a son propre enchainement.
 */
export type TypeEvenementJoueur =
  | "goal" | "yellow_card" | "red_card" | "save" | "foul" | "offside"
  | "shot" | "shot_on_target";

/**
 * Ceux qui n'appartiennent a personne.
 *
 * Un corner est obtenu par une equipe, pas par un joueur — demander lequel
 * couterait un geste de plus pour une reponse que le scoreur n'a pas. Ils se
 * saisissent depuis le bandeau d'equipe de la console, en un seul appui.
 */
export type TypeEvenementEquipe =
  | "corner" | "throw_in" | "free_kick" | "penalty";

export const EVENEMENTS_EQUIPE: readonly TypeEvenementEquipe[] = [
  "corner", "free_kick", "throw_in", "penalty",
] as const;

/** Les mineurs : l'historique du match, et rien d'autre. Aucune notification. */
const MINEURS = new Set<TypeEvenement>([
  "save", "foul", "offside", "penalty",
  "shot", "shot_on_target", "corner", "throw_in", "free_kick",
]);

export function estMineur(type: TypeEvenement): boolean {
  return MINEURS.has(type);
}

/**
 * Les comptables : ils n'entrent meme pas dans le fil.
 *
 * `estMineur` dit « ne reveille pas les telephones » ; celui-ci dit « ne le
 * raconte pas du tout ». Un tir cadre est un fait de match, mais il y en a
 * vingt-cinq, et vingt-cinq lignes de plus dans le fil enterrent le seul but
 * de la rencontre. Ils ressortent en statistiques et dans la note du joueur,
 * ou leur nombre est precisement ce qui a du sens.
 */
const COMPTABLES = new Set<TypeEvenement>([
  "shot", "shot_on_target", "corner", "throw_in", "free_kick",
]);

export function estStatistique(type: TypeEvenement): boolean {
  return COMPTABLES.has(type);
}

export const LIBELLE_EVENEMENT: Record<TypeEvenement, string> = {
  goal: "But",
  yellow_card: "Carton jaune",
  red_card: "Carton rouge",
  substitution: "Remplacement",
  period_start: "Début de période",
  period_end: "Fin de période",
  save: "Arrêt",
  foul: "Faute",
  offside: "Hors-jeu",
  penalty: "Penalty obtenu",
  shot: "Tir",
  shot_on_target: "Tir cadré",
  corner: "Corner",
  throw_in: "Touche",
  free_kick: "Coup franc",
};

/**
 * L'emoji de l'historique. Pas d'icone composant ici : ce module est lu par
 * les types, donc par le serveur comme par le navigateur, et il ne doit
 * dependre d'aucune bibliotheque de rendu.
 */
export const EMOJI_EVENEMENT: Record<TypeEvenement, string> = {
  goal: "⚽",
  yellow_card: "🟨",
  red_card: "🟥",
  substitution: "🔄",
  period_start: "▶️",
  period_end: "⏸️",
  save: "🧤",
  foul: "⚠️",
  offside: "🚩",
  penalty: "🎯",
  shot: "👟",
  shot_on_target: "🥅",
  corner: "⛳",
  throw_in: "🙌",
  free_kick: "🧱",
};

/**
 * La faute se saisit a deux : l'auteur, puis sa victime dans le camp d'en
 * face. C'est le seul evenement joueur qui traverse la ligne mediane, d'ou ce
 * drapeau plutot qu'un test en dur dans la console.
 */
export function demandeUneVictime(type: TypeEvenementJoueur): boolean {
  return type === "foul";
}

/**
 * Ce que porte le `detail` d'un but contre son camp.
 *
 * Il vit ici, et non dans `competition-firestore`, parce que le classement en
 * a besoin et qu'il doit tourner cote serveur : ce module n'importe aucun SDK,
 * celui-la tire tout le client Firebase avec lui.
 */
export const OWN_GOAL_DETAIL = "csc";
