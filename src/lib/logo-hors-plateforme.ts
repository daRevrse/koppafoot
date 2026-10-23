// ============================================
// Le logo d'une équipe hors plateforme, sur un amical.
//
// Un adversaire qui n'a pas de fiche chez nous n'avait pas d'écusson : le
// match portait `null` de son côté, et les affiches, le Direct et la fiche
// montraient son initiale. L'administration (amical ajouté à la main) et le
// manager (amical contre un adversaire hors plateforme) peuvent désormais lui
// en donner un (POST /api/matches/[mid]/logo-adversaire).
//
// LE CAMP HORS PLATEFORME EST CELUI SANS ÉQUIPE : son identifiant est vide,
// à domicile quand le manager se déplace, à l'extérieur quand il reçoit ou
// quand l'administration programme le match.
//
// Module pur : aucun SDK.
// ============================================

export function coteHorsPlateforme(
  d: { home_team_id?: string | null; away_team_id?: string | null },
): "home" | "away" | null {
  const domicile = Boolean(d.home_team_id);
  const exterieur = Boolean(d.away_team_id);
  if (domicile && !exterieur) return "away";
  if (exterieur && !domicile) return "home";
  return null;
}
