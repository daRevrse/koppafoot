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
  | "offside";

/**
 * Ceux qu'on saisit en touchant un joueur.
 *
 * `substitution` n'en est pas : elle se saisit a deux joueurs, celui qui sort
 * et celui qui entre, et elle a son propre enchainement.
 */
export type TypeEvenementJoueur =
  | "goal" | "yellow_card" | "red_card" | "save" | "foul" | "offside";

/** Les mineurs : l'historique du match, et rien d'autre. Aucune notification. */
const MINEURS = new Set<TypeEvenement>(["save", "foul", "offside"]);

export function estMineur(type: TypeEvenement): boolean {
  return MINEURS.has(type);
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
