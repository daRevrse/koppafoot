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

// ---- Le penalty obtenu, et ce qu'il devient ---------------------------------

/**
 * L'ISSUE D'UN PENALTY, PARCE QU'UN PENALTY ACCORDE NE RESTE PAS EN L'AIR.
 *
 * Il etait un compteur de plus : un appui sur la barre d'equipe, une ligne
 * dans le fil, fin. Or « penalty a la 67e » ne veut rien dire tout seul — ce
 * qui compte est ce qu'il DEVIENT, et c'etait justement la seule chose que la
 * console ne demandait jamais. Le public lisait « Penalty », puis un but
 * quelque part plus bas que rien ne reliait au penalty, ou bien rien du tout
 * et il ne saurait jamais s'il avait ete rate, arrete, ou retire.
 *
 * QUATRE SORTIES, ET IL N'Y EN A PAS UNE CINQUIEME. Il est marque, rate,
 * arrete, ou il n'a jamais eu lieu parce que la VAR a retire l'obtention.
 * Tant qu'aucune des quatre n'est posee, le penalty est EN ATTENTE, et c'est
 * un etat qui se voit : la console le porte a l'ecran et le reclame.
 *
 * ELLE VIT DANS `detail`, comme le but contre son camp. Aucun champ neuf :
 * `detail` est deja ce qui qualifie un evenement, il traverse deja les quatre
 * convertisseurs de la base vers l'application, et un penalty n'en avait
 * aucun usage. Un `detail` vide se lit donc « pas encore tire » — exactement
 * l'etat d'attente, sans avoir a l'ecrire nulle part.
 *
 * ON N'A PAS PRIS `var_status`, et c'est delibere. Celui-la est la mecanique
 * du TABLEAU D'AFFICHAGE d'un but : il deplace le score, et il n'existe qu'en
 * competition. Un penalty retire n'a aucun score a deplacer, et un amical —
 * qui n'a pas de VAR — doit lui aussi pouvoir sortir de l'attente.
 */
export type IssuePenalty = "marque" | "rate" | "arrete" | "retire";

export const ISSUES_PENALTY: readonly IssuePenalty[] = [
  "marque", "rate", "arrete", "retire",
] as const;

/** Le bouton de la console : ce que le scoreur choisit. */
export const LIBELLE_ISSUE_PENALTY: Record<IssuePenalty, string> = {
  marque: "Marqué",
  rate: "Raté",
  arrete: "Arrêté",
  retire: "Retiré",
};

/**
 * La ligne du fil, une fois l'issue connue.
 *
 * « Penalty retiré » et non « retiré par la VAR » : le fil est le meme pour
 * une competition et pour un amical du dimanche, ou personne ne tient de
 * video-assistance. C'est la console, qui sait de quel match il s'agit, qui
 * nomme la VAR quand elle existe.
 */
export const RECIT_ISSUE_PENALTY: Record<IssuePenalty, string> = {
  marque: "Penalty marqué",
  rate: "Penalty raté",
  arrete: "Penalty arrêté",
  retire: "Penalty retiré",
};

/** L'issue portee par un `detail`, ou `null` tant qu'il n'y en a pas. */
export function issuePenalty(detail: string | null | undefined): IssuePenalty | null {
  const t = String(detail ?? "");
  return (ISSUES_PENALTY as readonly string[]).includes(t) ? (t as IssuePenalty) : null;
}

/** Un penalty accorde dont personne n'a encore dit ce qu'il est devenu. */
export function penaltyEnAttente(e: { type: TypeEvenement; detail?: string | null }): boolean {
  return e.type === "penalty" && issuePenalty(e.detail) === null;
}

/**
 * Le penalty converti ne se raconte pas deux fois.
 *
 * Il produit un but, et ce but porte `PENALTY_GOAL_DETAIL` : la ligne « But
 * sur penalty » dit deja tout, a la meme minute. Garder les deux ferait lire
 * « Penalty » puis « But sur penalty » a trois centimetres d'intervalle, pour
 * une seule frappe. Les trois autres issues, elles, n'ont pas de but pour les
 * porter : elles gardent leur ligne.
 */
export function penaltyDitParSonBut(e: { type: TypeEvenement; detail?: string | null }): boolean {
  return e.type === "penalty" && issuePenalty(e.detail) === "marque";
}

/**
 * Ce que porte le `detail` d'un but marque sur penalty.
 *
 * Il ne change rien a ce qu'un but vaut — ni au score, ni au classement des
 * buteurs, ni a la fiche du joueur — et c'est voulu : un but sur penalty est
 * un but. Il ne change que la facon dont le fil le nomme.
 */
export const PENALTY_GOAL_DETAIL = "pen";
