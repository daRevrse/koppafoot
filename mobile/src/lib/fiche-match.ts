// ============================================
// La fiche d'un match, sans écran.
//
// Le site a deux pages : la rencontre de compétition
// (app/(app)/c/[slug]/matches/[mid]) et l'amical (app/(app)/matches/[id]).
// L'application n'a qu'un écran : les deux sources se convertissent ici en
// une même FICHE, et les composants ne savent pas s'ils montrent un amical.
//
// Les règles d'affichage (onglets, période) sont reprises de ces deux pages ;
// chaque fonction renvoie à la ligne d'origine. Le récit, les buteurs, la
// minute, eux, ne sont pas recopiés : ils viennent des modules partagés.
// ============================================

import { buteursDuMatch, buteursRenseignes, type ButeursDuMatch } from "@/lib/buteurs";
import { DEFAULT_HALF_DURATION, extraTimeDuration, halfDuration } from "@/lib/competition-format";
import type { Deroule } from "@/lib/fil-du-match";
import { FOOT } from "@/i18n/foot";
import { minuteEnDirect } from "@/lib/minute-du-match";
import { etatDeLaSeance, SEANCE_VIDE } from "@/lib/tirs-au-but";
import type { Competition, CompMatch, CompTeam, LineupEntry, Match } from "@/types";

const f = FOOT.fr;

export type Onglet = "feed" | "tchat" | "infos" | "lineups" | "stats" | "standings" | "h2h";
export type StatutFiche = "scheduled" | "live" | "completed" | "cancelled";

export interface CampDeFiche {
  teamId: string | null;
  nom: string;
  logo: string | null;
  score: number | null;
  /** « V », « N », « D », du plus ancien au plus récent (la forme arrive en PR B). */
  forme: ("V" | "N" | "D")[];
  lineup: LineupEntry[];
  formation: string | null;
}

export interface Fiche {
  /** Pour les liens, le partage, et les règles qui diffèrent d'une page à l'autre. */
  genre: "competition" | "amical";
  id: string;
  statut: StatutFiche;
  domicile: CampDeFiche;
  exterieur: CampDeFiche;
  date: string | null;
  heure: string | null;
  lieu: { nom: string | null; ville: string | null };
  competition: { id: string; nom: string; logo: string | null; slug: string | null; sousTitre: string | null } | null;
  liveState: CompMatch["liveState"];
  penaltyHome: number | null;
  penaltyAway: number | null;
  buteurs: ButeursDuMatch;
  mvp: { nom: string | null; playerId: string | null; userId: string | null; teamId: string | null };
  dureeMiTemps: number;
  dureeProlongation?: number;
  /** Le chemin de la page web, pour le partage et « Voir sur le site ». */
  lienSite: string;
}

const mvpDe = (m: Pick<CompMatch, "mvpPlayerName" | "mvpPlayerId" | "mvpUserId" | "mvpTeamId">) => ({
  nom: m.mvpPlayerName ?? null,
  playerId: m.mvpPlayerId ?? null,
  userId: m.mvpUserId ?? null,
  teamId: m.mvpTeamId ?? null,
});

/**
 * Une rencontre de compétition.
 *
 * L'ÉCUSSON VIENT DE LA FICHE DE L'ÉQUIPE, la copie du match ensuite : la
 * copie se périme (page compétition du site, `ecusson`).
 */
export function ficheDepuisCompetition(match: CompMatch, competition: Competition, equipes: CompTeam[]): Fiche {
  const ecusson = (teamId: string | null, copie: string | null): string | null => {
    const deLaFiche = teamId ? equipes.find((e) => e.id === teamId)?.logoUrl : null;
    return deLaFiche ?? copie;
  };
  const dureeMiTemps = competition.format ? halfDuration(competition.format) : DEFAULT_HALF_DURATION;
  // Le tour, sinon la poule (page compétition, `roundLabel`).
  const sousTitre = match.stage === "exhibition"
    ? f.matchExhibition
    : match.round
      ? f.tour(match.round)
      : match.group
        ? `Poule ${match.group}`
        : null;
  const events = match.liveState?.events ?? [];
  return {
    genre: "competition",
    id: match.id,
    statut: match.status,
    domicile: {
      teamId: match.homeTeamId, nom: match.homeTeamName, logo: ecusson(match.homeTeamId, match.homeTeamLogo),
      score: match.scoreHome, forme: [], lineup: match.homeLineup ?? [], formation: match.homeFormation ?? null,
    },
    exterieur: {
      teamId: match.awayTeamId, nom: match.awayTeamName, logo: ecusson(match.awayTeamId, match.awayTeamLogo),
      score: match.scoreAway, forme: [], lineup: match.awayLineup ?? [], formation: match.awayFormation ?? null,
    },
    date: match.date,
    heure: match.time,
    lieu: { nom: match.venueName, ville: match.venueCity },
    competition: {
      id: competition.id, nom: competition.name, logo: competition.logoUrl, slug: competition.slug ?? null, sousTitre,
    },
    liveState: match.liveState,
    penaltyHome: match.penaltyHome,
    penaltyAway: match.penaltyAway,
    buteurs: buteursDuMatch(events, match.homeTeamId, undefined, dureeMiTemps),
    mvp: mvpDe(match),
    dureeMiTemps,
    dureeProlongation: competition.format ? extraTimeDuration(competition.format) : undefined,
    lienSite: `/c/${competition.slug}/matches/${match.id}`,
  };
}

/**
 * Un amical. Tout statut d'avant le coup d'envoi (proposé, à venir, en
 * retard…) se lit comme un match programmé.
 *
 * Un score renseigné après coup porte ses buteurs à part (page amicale,
 * `buteursDuHero`).
 */
export function ficheDepuisAmical(match: Match): Fiche {
  const statut: StatutFiche =
    match.status === "live" || match.status === "completed" || match.status === "cancelled" ? match.status : "scheduled";
  const events = match.liveState?.events ?? [];
  return {
    genre: "amical",
    id: match.id,
    statut,
    domicile: {
      teamId: match.homeTeamId, nom: match.homeTeamName, logo: match.homeTeamLogo ?? null,
      score: match.scoreHome ?? null, forme: [], lineup: match.homeLineup ?? [], formation: match.homeFormation ?? null,
    },
    exterieur: {
      teamId: match.awayTeamId, nom: match.awayTeamName, logo: match.awayTeamLogo ?? null,
      score: match.scoreAway ?? null, forme: [], lineup: match.awayLineup ?? [], formation: match.awayFormation ?? null,
    },
    date: match.date ?? null,
    heure: match.time ?? null,
    lieu: { nom: match.venueName ?? null, ville: match.venueCity ?? null },
    competition: null,
    liveState: match.liveState ?? null,
    penaltyHome: match.penaltyHome ?? null,
    penaltyAway: match.penaltyAway ?? null,
    buteurs: match.recordedAt
      ? buteursRenseignes(match.recordedScorers ?? [], match.isHome ? "home" : "away")
      : buteursDuMatch(events, match.homeTeamId, undefined, DEFAULT_HALF_DURATION),
    mvp: mvpDe(match),
    dureeMiTemps: DEFAULT_HALF_DURATION,
    lienSite: `/matches/${match.id}`,
  };
}

const commence = (fiche: Fiche) => fiche.statut === "live" || fiche.statut === "completed";
const nbFaits = (fiche: Fiche) => fiche.liveState?.events?.length ?? 0;

export interface DonneesDesOnglets {
  tchatVisible: boolean;
  hasStats: boolean;
  hasStandings: boolean;
  hasH2H: boolean;
}

/** Les onglets à montrer : ceux qui ont quelque chose à dire. */
export function ongletsDeLaFiche(fiche: Fiche, d: DonneesDesOnglets): Onglet[] {
  if (fiche.genre === "amical") {
    // Page amicale, `<MatchTabs tabs=…>` : le fil toujours, la compo en dernier.
    return [
      "feed",
      ...(d.tchatVisible ? (["tchat"] as const) : []),
      "infos",
      ...(d.hasStats ? (["stats"] as const) : []),
      "lineups",
    ];
  }
  // Page compétition, `TABS` : la compo toujours, même vide (elle dit alors
  // qu'elle est à venir) ; le reste seulement avec quelque chose derrière.
  return ([
    ["feed", commence(fiche) || nbFaits(fiche) > 0],
    ["tchat", d.tchatVisible],
    ["infos", true],
    ["lineups", true],
    ["stats", d.hasStats],
    ["standings", d.hasStandings],
    ["h2h", d.hasH2H],
  ] as const).filter(([, on]) => on).map(([o]) => o);
}

/**
 * L'onglet ouvert tant qu'on n'en a choisi aucun : Infos avant le coup
 * d'envoi, le fil dès qu'il y a un fil.
 */
export function ongletParDefaut(fiche: Fiche, hasStats: boolean): Onglet {
  const mvp = !!fiche.mvp.nom;
  if (fiche.genre === "amical") return fiche.statut === "live" || fiche.statut === "completed" || mvp ? "feed" : "infos";
  return fiche.statut === "live" || hasStats || mvp ? "feed" : "infos";
}

/** Le choix de l'utilisateur, tant qu'il est encore à l'écran ; l'onglet par défaut sinon. */
export function ongletAffiche(choix: Onglet | null, onglets: Onglet[], parDefaut: Onglet): Onglet {
  return choix && onglets.includes(choix) ? choix : parDefaut;
}

const PERIODES: Record<number, string> = {
  1: "1ère Mi-temps", 2: "Mi-temps", 3: "2ème Mi-temps", 4: "Terminé",
  5: "Pause", 6: "Prolongation", 7: "Pause", 8: "Prolongation", 9: "Tirs au but",
};

/**
 * Ce que dit le tableau sous le score (page compétition, `periodLabel`).
 * « Terminé » l'emporte sur la période ; un direct ouvert avant que le
 * chrono ne tourne est un coup d'envoi imminent, pas une première mi-temps
 * figée à 00:00.
 */
export function libellePeriode(fiche: Fiche, maintenant: number = Date.now()): string {
  if (fiche.statut === "completed") return f.termine;
  if (fiche.statut === "cancelled") return f.annule;
  const minute = fiche.statut === "live" && fiche.liveState
    ? minuteEnDirect({ status: "live", liveState: fiche.liveState }, fiche.dureeMiTemps, maintenant)
    : null;
  if (minute?.genre === "avant") return "Coup d'envoi imminent";
  if (minute?.genre === "interrompu") return "Match interrompu";
  if (minute?.genre === "tirs") {
    const seance = etatDeLaSeance(fiche.liveState?.tirsAuBut ?? SEANCE_VIDE);
    return `Tirs au but · ${seance.score.home}-${seance.score.away}`;
  }
  return PERIODES[fiche.liveState?.currentPeriod ?? 0] ?? f.aVenir;
}

const deuxChiffres = (n: number) => String(n).padStart(2, "0");

/**
 * Le chrono du tableau, « 37:12 » : celui du serveur qui tourne, sinon la
 * valeur figée. Rien avant le coup d'envoi ni pendant la séance de tirs au but.
 */
export function chronoAffiche(fiche: Fiche, maintenant: number = Date.now()): string | null {
  const ls = fiche.liveState;
  if (fiche.statut !== "live" || !ls) return null;
  const minute = minuteEnDirect({ status: "live", liveState: ls }, fiche.dureeMiTemps, maintenant);
  if (minute?.genre === "avant" || minute?.genre === "tirs") return null;
  const ms = ls.isTimerRunning && ls.timerStartAt
    ? maintenant - new Date(ls.timerStartAt).getTime() + (ls.timerOffset || 0)
    : ls.timerOffset || 0;
  const secondes = Math.max(0, Math.floor(ms / 1000));
  return `${deuxChiffres(Math.floor(secondes / 60))}:${deuxChiffres(secondes % 60)}`;
}

/** Le panneau du quatrième arbitre, pour la mi-temps en cours. */
export function additionnelEnCours(fiche: Fiche): number | null {
  const ls = fiche.liveState;
  if (fiche.statut !== "live" || !ls) return null;
  if (ls.currentPeriod === 1) return ls.addedTime?.first ?? null;
  if (ls.currentPeriod === 3) return ls.addedTime?.second ?? null;
  return null;
}

/** Le déroulé, d'où le fil tire ses repères (page compétition, `deroule`). */
export function derouleDeLaFiche(fiche: Fiche): Deroule {
  return {
    commence: commence(fiche),
    termine: fiche.statut === "completed",
    periode: fiche.liveState?.currentPeriod ?? 0,
    heure: fiche.heure,
    score: fiche.statut === "completed"
      ? { home: fiche.domicile.score ?? 0, away: fiche.exterieur.score ?? 0 }
      : null,
    tab: fiche.penaltyHome != null && fiche.penaltyAway != null
      ? { home: fiche.penaltyHome, away: fiche.penaltyAway }
      : null,
    dureeMiTemps: fiche.dureeMiTemps,
    dureeProlongation: fiche.dureeProlongation,
  };
}
