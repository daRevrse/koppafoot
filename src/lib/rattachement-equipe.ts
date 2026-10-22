import { lireCategorie } from "@/lib/genre";

// ============================================
// Rattacher une équipe de compétition aux équipes de son manager.
//
// DEUX SORTES D'ÉQUIPES. Celle d'une compétition (`comp_teams`) n'existe que
// dans son tournoi ; celle d'un manager (`teams`) est la sienne, celle que
// liste « Mes équipes ». Le lien de l'une à l'autre est
// `comp_teams.claimed_by_team_id`. Une inscription le pose ; l'invitation à
// diriger une équipe créée par l'organisateur ne le posait pas : le manager
// en devenait propriétaire, mais l'équipe restait prisonnière du tournoi et
// n'apparaissait jamais dans « Mes équipes ».
//
// DÉCIDÉ LE 2026-10-22 : à l'acceptation, le manager choisit — lier à une de
// ses équipes, ou créer l'équipe dans ses équipes. Lier ne recopie pas
// l'effectif : la page de l'équipe de compétition le propose ensuite
// (« Rattachée à… · Resynchroniser », lib/club-import-server), avec les
// rapprochements à confirmer.
//
// Module pur : aucun SDK.
// ============================================

export type Rattachement =
  | { type: "aucun" }
  | { type: "nouvelle" }
  | { type: "existante"; equipeId: string };

/**
 * Ce que le corps de la demande choisit : rien (l'ancien comportement),
 * « nouvelle », ou l'identifiant d'une équipe. `null` pour une valeur
 * bricolée : la route répond 400.
 */
export function lireRattachement(brut: unknown): Rattachement | null {
  if (brut === undefined || brut === null) return { type: "aucun" };
  if (brut === "nouvelle") return { type: "nouvelle" };
  if (typeof brut === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(brut)) return { type: "existante", equipeId: brut };
  return null;
}

/** L'appelant gère-t-il cette équipe : son manager, ou un adjoint à qui il a délégué ? */
export function gereLEquipe(
  equipe: { manager_id?: string | null; staff_manager_ids?: string[] | null },
  uid: string,
): boolean {
  return equipe.manager_id === uid || (equipe.staff_manager_ids ?? []).includes(uid);
}

/** Sans ville connue, celle où joue presque toute la plateforme ; le manager la corrige ensuite. */
const VILLE_PAR_DEFAUT = "Lomé";

/**
 * L'équipe à créer dans les équipes du manager, depuis son équipe de
 * compétition : le document que POST /api/teams écrirait, sans les dates.
 * Personne n'y est membre : les joueurs de l'effectif de compétition
 * rejoignent l'équipe comme toujours, par invitation, et pas à leur insu.
 */
export function equipeDepuisCompetition(
  e: { nom: string; logo: string | null; ville: string | null; categorie: unknown },
  uid: string,
): Record<string, unknown> {
  const categorie = lireCategorie(e.categorie);
  return {
    name: e.nom.trim().slice(0, 80),
    manager_id: uid,
    city: (e.ville ?? "").trim().slice(0, 80) || VILLE_PAR_DEFAUT,
    description: "",
    level: "amateur",
    looking_for: [],
    member_ids: [],
    max_members: 25,
    color: "emerald",
    logo_url: e.logo ?? null,
    wins: 0, losses: 0, draws: 0, matches_played: 0,
    is_recruiting: true,
    ...(categorie ? { category: categorie } : {}),
  };
}

const nomCompare = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Le choix proposé d'abord : une équipe du manager qui porte le même nom
 * (accents, casse et ponctuation mis à part), sinon créer l'équipe.
 */
export function choixParDefaut(equipes: { id: string; name: string }[], nomCompetition: string): string {
  const cible = nomCompare(nomCompetition);
  return equipes.find((e) => nomCompare(e.name) === cible)?.id ?? "nouvelle";
}
