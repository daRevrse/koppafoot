import type { CompMatch } from "@/types";

// ============================================
// Peut-on supprimer ce match du calendrier ?
//
// L'organisateur n'avait AUCUN moyen de retirer un match : un doublon, un
// match ajouté par erreur restaient au calendrier pour de bon. La suppression
// s'ouvre, sauf la ou elle reecrirait la competition :
//
//   — EN DIRECT : quelqu'un le couvre en ce moment.
//   — JOUE : son resultat compte au classement de la poule, et dans les
//     statistiques des joueurs. C'est la regle deja appliquee aux equipes
//     (voir deleteCompTeam) ; un score faux se corrige, il ne s'efface pas.
//   — RELIE AU TABLEAU FINAL : il recoit des qualifies ou envoie son
//     vainqueur au tour suivant. Le supprimer casserait le tableau, qui se
//     gere depuis sa propre page.
//
// Module pur : la page le lit pour expliquer un refus, la couche de donnees
// pour l'appliquer.
// ============================================

/** Pourquoi ce match ne peut pas etre supprime, ou `null` s'il le peut. */
export function raisonDeNePasSupprimer(match: CompMatch, matchs: CompMatch[]): string | null {
  if (match.status === "live") {
    return "Ce match est en cours : il ne peut pas être supprimé.";
  }
  if (match.status === "completed") {
    return "Ce match a été joué : le supprimer retirerait son résultat du classement. Corrige le score avec « Score & buteurs ».";
  }
  const relieAuTableau =
    !!match.feedsIntoMatchId
    || !!match.homeSource
    || !!match.awaySource
    || matchs.some((m) => m.id !== match.id && m.feedsIntoMatchId === match.id);
  if (relieAuTableau) {
    return "Ce match fait partie du tableau final : il se gère depuis la page Tableau final.";
  }
  return null;
}
