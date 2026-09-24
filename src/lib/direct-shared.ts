// ============================================
// Le Direct, ce qui ne dépend d'aucun écran.
//
// La minute d'un match en cours, l'adresse de sa page, l'ordre des
// compétitions sur le tableau : trois règles qui vivaient dans DirectHomeV2
// et que l'application mobile doit appliquer À L'IDENTIQUE. Deux copies,
// c'est deux minutes différentes pour le même match le jour où l'une bouge.
//
// Module sans SDK : il se lit du serveur, du navigateur et de l'application
// (qui résout `@/` vers ce `src/`). N'y importer ni Firebase, ni Next, ni React.
// ============================================

import type { Competition, CompMatch } from "@/types";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";
import { isWorldComp } from "@/lib/world-board-shared";

/** One competition with ALL its fixtures, the Direct feed reads across them. */
export interface CompetitionFeed {
  competition: Competition;
  matches: CompMatch[];
}

/** Un match et la compétition sous laquelle le tableau le range. */
export type Entry = { match: CompMatch; competition: Competition };

/**
 * Live minute off the shared live_state clock (same math as LiveMatchConsole).
 *
 * `maintenant` n'existe que pour les tests : l'horloge du match est celle du
 * serveur (`timerStartAt` + `timerOffset`), jamais un compteur local.
 */
export function liveMinute(m: CompMatch, maintenant: number = Date.now()): number {
  const ls = m.liveState;
  if (!ls) return 0;
  if (m.status === "live" && ls.isTimerRunning && ls.timerStartAt) {
    const elapsed = maintenant - new Date(ls.timerStartAt).getTime() + (ls.timerOffset || 0);
    return Math.floor(elapsed / 60000) + 1;
  }
  return Math.floor((ls.timerOffset || 0) / 60000) + 1;
}

/** Second line of a competition header, the "country" line of the model. */
export function competitionSubtitle(c: Competition): string {
  return c.venueCity ?? c.organizerName ?? "";
}

/**
 * Ou mene l'en-tete d'un groupe. Les amicaux n'ont pas de page de
 * competition : on renvoie vers leur liste.
 */
export function competitionHref(c: Competition): string {
  if (c.id === FRIENDLY_COMP_ID) return "/matches";
  // Une competition mondiale a sa propre page, quand le fournisseur nous a
  // donne son code ; sinon on renvoie vers l'annuaire.
  if (isWorldComp(c.id)) return c.slug ? `/competitions/monde/${c.slug}` : "/competitions";
  return `/c/${c.slug}`;
}

export function matchHref(e: Entry): string {
  // Un amical n'appartient a aucune competition : sa page est /matches/[id].
  // Le fanion vient de FRIENDLY_COMP_ID (voir friendlies-admin).
  if (e.competition.id === FRIENDLY_COMP_ID) return `/matches/${e.match.id}`;
  // Un match du fournisseur externe n'a pas de page detail chez nous : on n'a
  // ni sa feuille de match, ni ses buteurs, ni de console pour le suivre, et
  // une fiche vide vaut moins que la page de sa competition. Il se pronostique
  // en revanche depuis l'affiche du Direct, un pronostic ne demandant qu'un
  // identifiant de match. On renvoie donc vers sa competition.
  if (isWorldComp(e.competition.id)) return competitionHref(e.competition);
  return `/c/${e.competition.slug}/matches/${e.match.id}`;
}

export function entryKey(e: Entry): string {
  return `${e.competition.id}:${e.match.id}`;
}

/** Kickoff sort key, undated fixtures land last. */
export function kickoff(e: Entry): string {
  return `${e.match.date ?? "9999-99-99"}T${e.match.time ?? "99:99"}`;
}

/**
 * L'ORDRE DES COMPÉTITIONS, LE MÊME POUR LE CARROUSEL ET POUR LE TABLEAU.
 *
 * Ce qui se joue maintenant devant, puis LE FOOTBALL D'ICI avant le football
 * mondial, puis l'heure du coup d'envoi.
 *
 * La règle vivait dans le carrousel, dont le commentaire affirmait qu'elle
 * était « comme celle du tableau » — le tableau, lui, ne connaissait que le
 * direct et l'heure. Une soirée de Ligue 1 passait donc devant le tournoi du
 * quartier sur l'écran d'accueil d'un produit qui parle d'abord de lui. Une
 * seule fonction désormais, les deux surfaces ne peuvent plus diverger — et
 * l'application mobile est la troisième.
 */
export function ordreDesCompetitions(a: Entry[], b: Entry[]): number {
  const enCours = (f: Entry[]) => (f.some((e) => e.match.status === "live") ? 0 : 1);
  const dIci = (f: Entry[]) => (isWorldComp(f[0].competition.id) ? 1 : 0);
  return enCours(a) - enCours(b)
    || dIci(a) - dIci(b)
    || kickoff(a[0]).localeCompare(kickoff(b[0]));
}
