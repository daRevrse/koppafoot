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
import { DEFAULT_HALF_DURATION, extraTimeDuration, halfDuration, matchDuration } from "@/lib/competition-format";
import { couleursDesBarres } from "@/lib/couleurs-equipe";
import { matchsQuiComptent } from "@/lib/exhibition";
import type { Deroule } from "@/lib/fil-du-match";
import { derniersResultats, type ResultatDeForme } from "@/lib/forme";
import { FOOT } from "@/i18n/foot";
import { minuteEnDirect } from "@/lib/minute-du-match";
import { notesDuCamp } from "@/lib/notes";
import { DUREE_MATCH_DEFAUT } from "@/lib/player-stats";
import { computeStandings, pouleDuMatch, type GroupStanding } from "@/lib/poules";
import { marquesDesJoueurs, motifDesMarques } from "@/lib/recit-du-match";
import { aDesStats, lignesStats, type LigneStat } from "@/lib/stats-match";
import { etatDeLaSeance, SEANCE_VIDE } from "@/lib/tirs-au-but";
import type { Competition, CompMatch, CompTeam, LineupEntry, Match } from "@/types";
import { couleurs } from "~/theme";

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

/** Ce que la fiche sait autour du match : la forme, la poule, le face-à-face, les stats. */
export interface ContexteDeFiche {
  /** Les cinq derniers résultats officiels de chaque camp, avant ce match (lib/forme). */
  formes: { domicile: ResultatDeForme[]; exterieur: ResultatDeForme[] };
  /** La poule des deux équipes, en phase de groupes seulement. */
  poule: GroupStanding | null;
  /** Les rencontres terminées entre les deux équipes, dans cette compétition, celle-ci exclue. */
  faceAFace: CompMatch[];
  /** Du point de vue du domicile de CE match. */
  bilanFaceAFace: { home: number; draw: number; away: number };
  stats: LigneStat[];
  aDesStats: boolean;
  /** Chaque camp dans sa couleur, sur les barres (lib/couleurs-equipe, piste sombre). */
  couleurs: { home: string; away: string } | null;
}

/** Ce que `photoDeLaLigne` (lib/photos-sans-compte) lit d'une ligne de feuille. */
export interface LignePhoto {
  id: string;
  user_id: string | null;
  photo_url: string | null;
  club_ghost_id: string | null;
  /** Le club KoppaFoot derrière l'équipe de compétition, d'où viennent les visages sans compte. */
  club: string | null;
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
  mvp: {
    nom: string | null; playerId: string | null; userId: string | null; teamId: string | null;
    /** La note que la console lui a vue (lib/notes), même calcul que le classement. */
    note: { valeur: number | null; faits: number } | null;
    /** « 2 buts, 1 passe » (lib/recit-du-match). */
    motif: string | null;
  };
  contexte: ContexteDeFiche;
  /** De quoi retrouver le visage de chaque ligne des deux feuilles, par identifiant de ligne. */
  lignesPhoto: Record<string, LignePhoto>;
  dureeMiTemps: number;
  dureeProlongation?: number;
  /** Le chemin de la page web, pour le partage et « Voir sur le site ». */
  lienSite: string;
}

type MatchCommun = CompMatch | Match;

/**
 * L'homme du match, sa note et ce qu'il a fait. La note se calcule sur la
 * feuille de SON camp, sur la durée du format (page compétition, `noteDeLHomme`).
 */
function mvpDe(m: MatchCommun, duree: number): Fiche["mvp"] {
  const events = m.liveState?.events ?? [];
  let note: Fiche["mvp"]["note"] = null;
  if (m.mvpPlayerId && m.mvpTeamId) {
    const feuille = m.mvpTeamId === m.homeTeamId ? m.homeLineup ?? [] : m.awayLineup ?? [];
    const n = notesDuCamp(m, feuille, events, m.mvpTeamId, duree).get(m.mvpPlayerId);
    note = n ? { valeur: n.note, faits: n.faits } : null;
  }
  return {
    nom: m.mvpPlayerName ?? null,
    playerId: m.mvpPlayerId ?? null,
    userId: m.mvpUserId ?? null,
    teamId: m.mvpTeamId ?? null,
    note,
    motif: m.mvpPlayerId ? motifDesMarques(marquesDesJoueurs(events)[m.mvpPlayerId], "fr") : null,
  };
}

/** Les compteurs du match, comme la fiche du site et la console (lib/stats-match). */
function statsDe(m: MatchCommun): { stats: LigneStat[]; aDesStats: boolean } {
  const events = m.liveState?.events ?? [];
  const possession = m.liveState?.possession ?? null;
  const chronoTourne = m.status === "live" && !!m.liveState?.isTimerRunning;
  return {
    stats: lignesStats(
      events, m.homeTeamId, m.awayTeamId, { home: m.scoreHome ?? 0, away: m.scoreAway ?? 0 }, possession, chronoTourne,
    ),
    aDesStats: aDesStats(events, possession, chronoTourne),
  };
}

/**
 * Une rencontre de compétition.
 *
 * L'ÉCUSSON VIENT DE LA FICHE DE L'ÉQUIPE, la copie du match ensuite : la
 * copie se périme (page compétition du site, `ecusson`).
 */
export function ficheDepuisCompetition(
  match: CompMatch,
  competition: Competition,
  equipes: CompTeam[],
  /** Les autres matchs de la compétition : la forme, la poule, le face-à-face. */
  matchs: CompMatch[] = [],
): Fiche {
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
  const equipeDe = (teamId: string | null) => (teamId ? equipes.find((e) => e.id === teamId) : undefined);

  // La forme, avant ce match ; une exhibition n'y entre pas (lib/exhibition).
  const officiels = matchsQuiComptent(matchs);
  const formes = {
    domicile: derniersResultats(officiels, match.homeTeamId, match),
    exterieur: derniersResultats(officiels, match.awayTeamId, match),
  };
  // Ni la phase finale ni un match d'exhibition n'ont de poule à montrer.
  const poule = match.stage === "group" && competition.format
    ? pouleDuMatch(computeStandings(matchs, equipes, competition.format), match.homeTeamId, match.awayTeamId)
    : null;
  // Face-à-face : les rencontres terminées entre ces deux équipes (page compétition, `h2h`).
  const faceAFace = match.homeTeamId && match.awayTeamId
    ? matchs.filter((m) =>
        m.id !== match.id
        && m.status === "completed"
        && m.scoreHome !== null && m.scoreAway !== null
        && ((m.homeTeamId === match.homeTeamId && m.awayTeamId === match.awayTeamId)
          || (m.homeTeamId === match.awayTeamId && m.awayTeamId === match.homeTeamId)))
    : [];
  const bilanFaceAFace = { home: 0, draw: 0, away: 0 };
  for (const m of faceAFace) {
    const nousADomicile = m.homeTeamId === match.homeTeamId;
    const nous = (nousADomicile ? m.scoreHome : m.scoreAway) ?? 0;
    const eux = (nousADomicile ? m.scoreAway : m.scoreHome) ?? 0;
    if (nous > eux) bilanFaceAFace.home += 1;
    else if (nous < eux) bilanFaceAFace.away += 1;
    else bilanFaceAFace.draw += 1;
  }

  // Le visage de chaque ligne : le compte, la photo posée sur la ligne
  // d'effectif, sinon celle de sa fiche au club (page compétition, `photosParLigne`).
  const lignesPhoto: Record<string, LignePhoto> = {};
  const camps: [string | null, LineupEntry[]][] = [
    [match.homeTeamId, match.homeLineup ?? []],
    [match.awayTeamId, match.awayLineup ?? []],
  ];
  for (const [teamId, lignes] of camps) {
    const equipe = equipeDe(teamId);
    for (const e of lignes) {
      const effectif = equipe?.players.find((p) => p.id === e.playerId);
      lignesPhoto[e.playerId] = {
        id: e.playerId,
        user_id: e.userId ?? null,
        photo_url: effectif?.photo_url ?? null,
        club_ghost_id: effectif?.club_ghost_id ?? null,
        club: equipe?.claimedByTeamId ?? null,
      };
    }
  }

  return {
    genre: "competition",
    id: match.id,
    statut: match.status,
    domicile: {
      teamId: match.homeTeamId, nom: match.homeTeamName, logo: ecusson(match.homeTeamId, match.homeTeamLogo),
      score: match.scoreHome, forme: formes.domicile.map((r) => r.resultat),
      lineup: match.homeLineup ?? [], formation: match.homeFormation ?? null,
    },
    exterieur: {
      teamId: match.awayTeamId, nom: match.awayTeamName, logo: ecusson(match.awayTeamId, match.awayTeamLogo),
      score: match.scoreAway, forme: formes.exterieur.map((r) => r.resultat),
      lineup: match.awayLineup ?? [], formation: match.awayFormation ?? null,
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
    mvp: mvpDe(match, competition.format ? matchDuration(competition.format) : DUREE_MATCH_DEFAUT),
    contexte: {
      formes, poule, faceAFace, bilanFaceAFace, ...statsDe(match),
      couleurs: couleursDesBarres(
        equipeDe(match.homeTeamId)?.color ?? null, equipeDe(match.awayTeamId)?.color ?? null, couleurs.surfaceHaute,
      ),
    },
    lignesPhoto,
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
    mvp: mvpDe(match, DUREE_MATCH_DEFAUT),
    // Un amical n'a ni poule, ni compétition où chercher une forme ou un face-à-face.
    contexte: {
      formes: { domicile: [], exterieur: [] }, poule: null, faceAFace: [], bilanFaceAFace: { home: 0, draw: 0, away: 0 },
      couleurs: null, ...statsDe(match),
    },
    lignesPhoto: Object.fromEntries(
      [...(match.homeLineup ?? []), ...(match.awayLineup ?? [])].map((e) => [
        e.playerId,
        { id: e.playerId, user_id: e.userId ?? null, photo_url: null, club_ghost_id: null, club: null },
      ]),
    ),
    dureeMiTemps: DEFAULT_HALF_DURATION,
    lienSite: `/matches/${match.id}`,
  };
}

const commence = (fiche: Fiche) => fiche.statut === "live" || fiche.statut === "completed";
const nbFaits = (fiche: Fiche) => fiche.liveState?.events?.length ?? 0;

/** Ce que la fiche ne sait pas encore d'elle-même : le tchat (PR C). */
export interface DonneesDesOnglets {
  tchatVisible: boolean;
}

/** Les onglets à montrer : ceux qui ont quelque chose à dire. */
export function ongletsDeLaFiche(fiche: Fiche, d: DonneesDesOnglets): Onglet[] {
  const { contexte } = fiche;
  if (fiche.genre === "amical") {
    // Page amicale, `<MatchTabs tabs=…>` : le fil toujours, la compo en dernier.
    return [
      "feed",
      ...(d.tchatVisible ? (["tchat"] as const) : []),
      "infos",
      ...(contexte.aDesStats ? (["stats"] as const) : []),
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
    ["stats", contexte.aDesStats],
    ["standings", !!contexte.poule && contexte.poule.rows.length > 0],
    ["h2h", contexte.faceAFace.length > 0],
  ] as const).filter(([, on]) => on).map(([o]) => o);
}

/**
 * L'onglet ouvert tant qu'on n'en a choisi aucun : Infos avant le coup
 * d'envoi, le fil dès qu'il y a un fil.
 */
export function ongletParDefaut(fiche: Fiche): Onglet {
  const hasStats = fiche.contexte.aDesStats;
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

/**
 * Le texte qui accompagne le lien partagé : le rendez-vous avant, le score
 * pendant et après (pages du site, `partagerLeMatch`).
 */
export function texteDePartage(fiche: Fiche): string {
  const affiche = `${fiche.domicile.nom} — ${fiche.exterieur.nom}`;
  const score = `${fiche.domicile.score ?? 0}-${fiche.exterieur.score ?? 0}`;
  const comp = fiche.competition ? ` — ${fiche.competition.nom}` : "";
  if (fiche.statut === "live") return `${affiche}, ${score} en direct${comp}`;
  if (fiche.statut === "completed") return `${affiche}, score final ${score}${comp}`;
  const quand = [fiche.date, fiche.heure].filter(Boolean).join(" à ");
  return `${affiche}${quand ? `, le ${quand}` : ""}${comp}`;
}

const VINGT_QUATRE_HEURES = 24 * 3_600_000;

/**
 * Le temps qui reste avant le coup d'envoi, dans les dernières vingt-quatre
 * heures seulement : au-delà, le jour suffit (MatchHero, `useCompteARebours`).
 */
export function resteAvantCoupDEnvoi(fiche: Fiche, maintenant: number = Date.now()): number | null {
  if (fiche.statut !== "scheduled" || !fiche.date || !fiche.heure) return null;
  const coupDEnvoi = new Date(`${fiche.date}T${fiche.heure}:00`).getTime();
  if (Number.isNaN(coupDEnvoi)) return null;
  const reste = coupDEnvoi - maintenant;
  return reste > 0 && reste <= VINGT_QUATRE_HEURES ? reste : null;
}

/** « 01:30:05 » (hooks/useCompteARebours du site, `formatCompteARebours`). */
export function formatCompteARebours(ms: number): string {
  const secondes = Math.floor(ms / 1000);
  return [Math.floor(secondes / 3600), Math.floor((secondes % 3600) / 60), secondes % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
