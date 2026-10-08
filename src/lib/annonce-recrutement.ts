// ============================================
// L'annonce de recrutement dans la Tribune : ce qui se décide sans réseau.
//
// Le manager qui recrute peut le dire dans la Tribune, sous son nom : « On
// cherche un gardien ». La publication porte une carte de l'équipe et un
// bouton « Demander à rejoindre », qui envoie la même demande que le mercato.
//
// PAR LE SERVEUR (/api/tribune/recruitment), parce qu'une annonce parle au
// nom d'une équipe : le serveur vérifie que l'appelant en est bien le
// manager et que l'équipe recrute vraiment, et il tient la cadence.
//
// UNE ANNONCE PAR SEMAINE ET PAR ÉQUIPE. Sans limite, couper et rouvrir le
// recrutement suffirait à remonter en tête du fil à volonté. Dans la
// semaine, rouvrir le recrutement rouvre la dernière annonce au lieu d'en
// publier une autre ; passé la semaine, une nouvelle annonce remplace
// l'ancienne, qui se ferme.
//
// Module pur : la route, la page de l'équipe et la suite de tests s'en servent.
// ============================================

export const POSTES_RECHERCHES = ["gardien", "defenseur", "milieu", "attaquant"] as const;
export type PosteRecherche = (typeof POSTES_RECHERCHES)[number];

export const LIBELLE_POSTE: Record<PosteRecherche, string> = {
  gardien: "Gardien",
  defenseur: "Défenseur",
  milieu: "Milieu",
  attaquant: "Attaquant",
};

/** Le mot du manager : une annonce, pas une lettre. */
export const MESSAGE_ANNONCE_MAX = 280;

export const DELAI_ENTRE_ANNONCES_MS = 7 * 24 * 60 * 60 * 1000;

/** Les postes reçus, gardés s'ils existent, sans doublon, dans l'ordre du terrain. */
export function postesValides(brut: unknown): PosteRecherche[] {
  if (!Array.isArray(brut)) return [];
  return POSTES_RECHERCHES.filter((p) => brut.includes(p));
}

/** Le mot du manager, ou `null` s'il n'en a pas écrit. Tronqué, jamais refusé. */
export function messageDeLAnnonce(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const m = brut.trim().slice(0, MESSAGE_ANNONCE_MAX).trim();
  return m || null;
}

/** « gardien et milieu », « défenseur, milieu et attaquant ». */
export function listeDesPostes(postes: PosteRecherche[]): string {
  const mots = postes.map((p) => LIBELLE_POSTE[p].toLowerCase());
  if (mots.length <= 1) return mots.join("");
  return `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;
}

/**
 * Le texte de la publication : le mot du manager s'il en a écrit un, sinon
 * une phrase faite des postes recherchés.
 */
export function texteDeLAnnonce(equipe: string, postes: PosteRecherche[], message: string | null): string {
  if (message) return message;
  const cherche = postes.length ? ` On cherche : ${listeDesPostes(postes)}.` : "";
  return `${equipe} recrute !${cherche} Envoie ta demande depuis la Tribune.`;
}

/** La dernière annonce de l'équipe, telle que la route la relit. */
export interface DerniereAnnonce {
  postId: string;
  publieeLe: number;
  close: boolean;
}

export type DecisionAnnonce =
  | { action: "publier"; fermer: string | null }
  | { action: "rouvrir"; postId: string }
  | { action: "refuser"; postId: string; possibleLe: number };

/**
 * Publier, rouvrir ou refuser.
 *
 * - aucune annonce, ou la dernière a plus d'une semaine : on publie (et on
 *   ferme l'ancienne si elle était encore ouverte) ;
 * - la dernière a moins d'une semaine et elle est fermée : on la rouvre ;
 * - elle a moins d'une semaine et elle est ouverte : elle est déjà en ligne.
 */
export function decisionAnnonce(derniere: DerniereAnnonce | null, maintenant: number): DecisionAnnonce {
  if (!derniere || maintenant - derniere.publieeLe >= DELAI_ENTRE_ANNONCES_MS) {
    return { action: "publier", fermer: derniere && !derniere.close ? derniere.postId : null };
  }
  if (derniere.close) return { action: "rouvrir", postId: derniere.postId };
  return { action: "refuser", postId: derniere.postId, possibleLe: derniere.publieeLe + DELAI_ENTRE_ANNONCES_MS };
}
