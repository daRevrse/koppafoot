// ============================================
// Le pilote de la console live : ce qui change d'un type de match a l'autre.
//
// IL Y AVAIT DEUX CONSOLES, et elles ne se ressemblaient plus. Celle des
// competitions (LiveMatchConsole) avait la feuille de match obligatoire, le
// verrou anti-double-but, le passeur, le VAR, les remplacements comptes. Celle
// des amicaux (/matches/[id]/manage) avait une grille de joueurs et le strict
// minimum — le verrou du but ne lui est arrive qu'apres coup, et le passeur
// jamais. Deux ecrans pour le meme geste, et chaque correctif porte sur l'un
// manquait a l'autre.
//
// La console est desormais UNE. Ce qui differe n'est pas l'ecran, c'est l'ou
// et le comment on ecrit : une competition vit dans
// `competitions/{cid}/comp_matches/{mid}`, un amical dans `matches/{id}`, et
// leurs effectifs ne viennent pas du meme endroit. C'est exactement ce que ce
// module isole, et rien d'autre.
//
// Le pilote rend le match sous la forme d'un `CompMatch`, y compris pour un
// amical : la console ne connait que cette forme, et lui en apprendre une
// seconde aurait duplique tout le rendu — la meme erreur qu'on repare ici.
// ============================================

import {
  onCompMatch, onCompetition, getCompTeam, setCompMatchLineup,
  initLiveCompMatch, startCompTimer, pauseCompTimer, updateCompPeriod,
  addCompEvent, setCompGoalAssist, setCompFoulVictim, setCompGoalVarStatus,
  finishCompMatch, updateCompMatch,
} from "@/lib/competition-firestore";
import { notifyCompetitionFollowers } from "@/lib/competition-notify";
import {
  DEFAULT_HALF_DURATION, DEFAULT_TEAM_SIZE, halfDuration, teamSize,
} from "@/lib/competition-format";
import type { TypeEvenement } from "@/lib/evenements";
import {
  onMatchLive, getParticipationsForMatch, getGhostPlayersByTeam,
  setMatchLineup, setMatchOnPitch, addMatchLiveEvent, setMatchGoalAssist,
  setMatchFoulVictim, initLiveMatch, startMatchTimer, pauseMatchTimer,
  updateMatchPeriod, updateMatchStatus, setPenaltyShootout,
} from "@/lib/firestore";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";
import type {
  CompMatch, CompPlayer, Competition, GoalVarStatus, LineupEntry, Match,
} from "@/types";

export type Cote = "home" | "away";

/** Les regles de jeu que la console applique : titulaires, et horloge. */
export interface ReglesDuJeu {
  titulairesMax: number;
  dureeMiTempsMin: number;
}

/** Un evenement tel que la console demande de l'ecrire. */
export interface EvenementAEcrire {
  type: TypeEvenement;
  side: Cote;
  team_id: string;
  period: number;
  minute: number;
  player_id?: string | null;
  player_name?: string | null;
  detail?: string | null;
  victim_player_id?: string | null;
  victim_player_name?: string | null;
}

export interface PiloteConsole {
  /** Ce que la console tient : un match de competition, ou un amical. */
  genre: "competition" | "amical";

  onMatch(cb: (m: CompMatch | null) => void): () => void;
  /** La competition, quand il y en a une. Un amical n'en a pas : rend null. */
  onCompetition(cb: (c: Competition | null) => void): () => void;

  regles(competition: Competition | null, match: CompMatch | null): ReglesDuJeu;

  /** Les deux effectifs, pour batir la feuille de match. */
  effectifs(match: CompMatch): Promise<{ home: CompPlayer[]; away: CompPlayer[] }>;
  poserFeuille(side: Cote, entries: LineupEntry[], prete: boolean): Promise<void>;

  lancer(surLeTerrain: { home: string[]; away: string[] }): Promise<void>;
  demarrerChrono(): Promise<void>;
  pauserChrono(offsetMs: number): Promise<void>;
  changerPeriode(periode: number): Promise<void>;
  poserSurLeTerrain(side: Cote, ids: string[]): Promise<void>;
  terminer(tab?: { penaltyHome: number; penaltyAway: number }): Promise<void>;

  ajouterEvenement(e: EvenementAEcrire): Promise<string>;
  poserPasseur(eventId: string, p: { playerId: string; playerName: string } | null): Promise<void>;
  poserVictime(eventId: string, v: { playerId: string; playerName: string } | null): Promise<void>;
  /**
   * Le VAR n'existe qu'en competition : absent ici, et la console masque
   * alors ses commandes. Une video-assistance sur un match de quartier n'a
   * personne pour la tenir.
   */
  poserVar?(eventId: string, statut: GoalVarStatus): Promise<void>;

  /** Prevenir les suiveurs. Sans objet sur un amical, qui n'en a pas. */
  notifier(n: { title: string; body: string }, competition: Competition | null): void;
  /** Le lien public du match, pour la notification. */
  lien(competition: Competition | null): string;
  /** Qui a le droit de quitter la console sans la terminer. */
  autoriseAQuitter(uid: string | null, competition: Competition | null, match: CompMatch | null): boolean;
}

// ---- Competition ---------------------------------------------------------------

export function piloteCompetition(cid: string, mid: string): PiloteConsole {
  const lien = (competition: Competition | null) =>
    competition ? `/c/${competition.slug}/matches/${mid}` : "/";

  return {
    genre: "competition",

    onMatch: (cb) => onCompMatch(cid, mid, cb),
    onCompetition: (cb) => onCompetition(cid, cb),

    regles: (competition) => ({
      // La competition arrive une frame apres le match, d'ou les valeurs par
      // defaut : la console doit savoir compter avant de la connaitre.
      titulairesMax: competition ? teamSize(competition.format) : DEFAULT_TEAM_SIZE,
      dureeMiTempsMin: competition ? halfDuration(competition.format) : DEFAULT_HALF_DURATION,
    }),

    effectifs: async (match) => {
      const [home, away] = await Promise.all([
        match.homeTeamId ? getCompTeam(cid, match.homeTeamId) : Promise.resolve(null),
        match.awayTeamId ? getCompTeam(cid, match.awayTeamId) : Promise.resolve(null),
      ]);
      return { home: home?.players ?? [], away: away?.players ?? [] };
    },

    poserFeuille: (side, entries, prete) => setCompMatchLineup(cid, mid, side, entries, prete),

    lancer: async ({ home, away }) => {
      await initLiveCompMatch(cid, mid);
      await updateCompMatch(cid, mid, { home_on_pitch: home, away_on_pitch: away });
    },

    demarrerChrono: () => startCompTimer(cid, mid),
    pauserChrono: (ms) => pauseCompTimer(cid, mid, ms),
    changerPeriode: (p) => updateCompPeriod(cid, mid, p),

    poserSurLeTerrain: (side, ids) =>
      updateCompMatch(cid, mid, { [side === "home" ? "home_on_pitch" : "away_on_pitch"]: ids }),

    terminer: (tab) => finishCompMatch(cid, mid, tab),

    ajouterEvenement: (e) => addCompEvent(cid, mid, e),
    poserPasseur: (id, p) => setCompGoalAssist(cid, mid, id, p),
    poserVictime: (id, v) => setCompFoulVictim(cid, mid, id, v),
    poserVar: (id, s) => setCompGoalVarStatus(cid, mid, id, s),

    notifier: (n, competition) =>
      notifyCompetitionFollowers({ cid, title: n.title, body: n.body, link: lien(competition) }),
    lien: (competition) => lien(competition),

    autoriseAQuitter: (uid, competition) =>
      !!(uid && competition && competition.organizerIds.includes(uid)),
  };
}

// ---- Amical --------------------------------------------------------------------

/** Le NvN d'un amical, ecrit « 5v5 ». Onze faute de mieux. */
function tailleDEquipe(format: Match["format"] | undefined): number {
  const n = Number.parseInt(String(format ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TEAM_SIZE;
}

/**
 * Un amical dans la forme d'un match de competition.
 *
 * La console ne connait que `CompMatch` : c'est le prix a payer pour n'avoir
 * qu'une console, et il est bien plus faible que celui de deux rendus.
 * `amicalVersCompMatch` (friendlies-shared) fait deja ce travail pour le
 * tableau du Direct, mais laisse les feuilles vides — le tableau n'en a pas
 * besoin, la console si.
 */
function amicalEnCompMatch(m: Match): CompMatch {
  return {
    id: m.id,
    competitionId: FRIENDLY_COMP_ID,
    stage: "group",
    group: null,
    round: null,
    bracketSlot: null,
    homeSource: null,
    awaySource: null,
    homeTeamId: m.homeTeamId ?? null,
    awayTeamId: m.awayTeamId ?? null,
    homeTeamName: m.homeTeamName,
    awayTeamName: m.awayTeamName,
    homeTeamLogo: null,
    awayTeamLogo: null,
    bannerUrl: null,
    date: m.date,
    time: m.time,
    venueName: m.venueName,
    venueCity: m.venueCity,
    // Un amical connait « upcoming », que la competition appelle « scheduled ».
    status: m.status === "live" ? "live" : m.status === "completed" ? "completed" : "scheduled",
    scoreHome: m.scoreHome,
    scoreAway: m.scoreAway,
    penaltyHome: m.penaltyHome,
    penaltyAway: m.penaltyAway,
    winnerTeamId: null,
    forfeitByTeamId: null,
    feedsIntoMatchId: null,
    feedsIntoSlot: null,
    homeLineup: m.homeLineup,
    awayLineup: m.awayLineup,
    homeLineupReady: m.homeLineupReady ?? false,
    awayLineupReady: m.awayLineupReady ?? false,
    homeOnPitch: m.homeOnPitch,
    awayOnPitch: m.awayOnPitch,
    liveState: m.liveState ?? null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  } as CompMatch;
}

export function piloteAmical(matchId: string): PiloteConsole {
  // Le match brut, garde de cote : la console lit un `CompMatch`, mais le
  // format de jeu et les managers n'y survivent pas a la conversion.
  let brut: Match | null = null;

  const lien = () => `/matches/${matchId}`;

  return {
    genre: "amical",

    onMatch: (cb) =>
      onMatchLive(matchId, (m: Match | null) => {
        brut = m;
        cb(m ? amicalEnCompMatch(m) : null);
      }),

    // Un amical n'appartient a aucune competition. La console s'en sert pour
    // le bandeau d'entrainement et le format ; ni l'un ni l'autre ici.
    onCompetition: (cb) => { cb(null); return () => {}; },

    regles: () => ({
      titulairesMax: tailleDEquipe(brut?.format),
      // Un amical ne stocke pas de duree : la mi-temps reglementaire fait foi,
      // comme dans l'ancienne console.
      dureeMiTempsMin: DEFAULT_HALF_DURATION,
    }),

    /**
     * L'effectif d'un amical vient de DEUX sources : les joueurs avec un
     * compte, qui confirment leur presence (`participations`), et ceux sans
     * compte, poses sur l'equipe par leur manager (`ghost_players`). Les deux
     * tiennent la meme place sur le terrain, ils sont donc ramenes a la meme
     * forme — celle d'une ligne d'effectif de competition.
     */
    effectifs: async (match) => {
      const participations = await getParticipationsForMatch(matchId);
      const [fantomesHome, fantomesAway] = await Promise.all([
        match.homeTeamId ? getGhostPlayersByTeam(match.homeTeamId) : Promise.resolve([]),
        match.awayTeamId ? getGhostPlayersByTeam(match.awayTeamId) : Promise.resolve([]),
      ]);

      const pour = (teamId: string | null, fantomes: Awaited<ReturnType<typeof getGhostPlayersByTeam>>): CompPlayer[] => [
        ...participations
          .filter((p) => p.teamId === teamId && p.status === "confirmed")
          .map((p) => ({
            id: p.playerId,
            name: p.playerName,
            number: p.squadNumber ?? "",
            user_id: p.playerId,
            // Le poste choisi par son manager pour CE match. Seuls les joueurs
            // sans compte en portaient un ici : la console repliait donc tous
            // les autres sur un 4-3-3 par ordre de feuille, alors que la fiche
            // du match, elle, lisait le poste. Meme terrain, meme placement.
            position: p.matchPosition ?? undefined,
          })),
        ...fantomes.map((g) => ({
          id: g.id,
          name: `${g.firstName} ${g.lastName}`.trim(),
          number: g.squadNumber ?? "",
          position: g.position,
        })),
      ];

      return {
        home: pour(match.homeTeamId, fantomesHome),
        away: pour(match.awayTeamId, fantomesAway),
      };
    },

    poserFeuille: (side, entries, prete) => setMatchLineup(matchId, side, entries, prete),

    lancer: async ({ home, away }) => {
      await initLiveMatch(matchId);
      await setMatchOnPitch(matchId, "home", home);
      await setMatchOnPitch(matchId, "away", away);
    },

    demarrerChrono: () => startMatchTimer(matchId),
    pauserChrono: (ms) => pauseMatchTimer(matchId, ms),
    changerPeriode: (p) => updateMatchPeriod(matchId, p),
    poserSurLeTerrain: (side, ids) => setMatchOnPitch(matchId, side, ids),

    terminer: async (tab) => {
      if (tab) await setPenaltyShootout(matchId, tab.penaltyHome, tab.penaltyAway);
      await updateMatchStatus(matchId, "completed");
    },

    ajouterEvenement: (e) => addMatchLiveEvent(matchId, e),
    poserPasseur: (id, p) => setMatchGoalAssist(matchId, id, p),
    poserVictime: (id, v) => setMatchFoulVictim(matchId, id, v),
    // Pas de `poserVar` : personne ne tient une video-assistance sur un
    // match entre copains, et la console masque ses commandes sans lui.

    // Un amical n'a pas de suiveurs a prevenir : ceux que ca concerne sont sur
    // le terrain, ou sur la touche.
    notifier: () => {},
    lien: () => lien(),

    autoriseAQuitter: (uid) =>
      !!uid && !!brut && (
        brut.managerId === uid
        || brut.awayManagerId === uid
        || (brut.moderatorIds ?? []).includes(uid)
      ),
  };
}
