import type { Competition, CompMatch, Match } from "@/types";

// Partagé entre le serveur et le navigateur, donc AUCUN import de
// firebase-admin ici. Le lecteur qui remplit ces matchs vit dans
// friendlies-admin.ts, et le tableau du Direct (composant client) n'a besoin
// que du fanion : importer l'un depuis l'autre tirerait le SDK serveur dans
// le bundle client.

/**
 * L'identifiant de la compétition synthétique qui regroupe les amicaux.
 *
 * Il n'existe dans aucune collection : c'est un fanion. Le tableau du Direct
 * groupe ses lignes par compétition, et un amical n'appartient à aucune,
 * ce rattachement lui évite un second chemin de rendu pour des matchs qui
 * s'affichent exactement pareil. Les endroits qui mènent ailleurs (le lien
 * du match, l'en-tête du groupe, l'annuaire) testent ce fanion.
 */
export const FRIENDLY_COMP_ID = "__amicaux__";

export const FRIENDLY_COMPETITION: Competition = {
  id: FRIENDLY_COMP_ID,
  name: "Matchs amicaux",
  slug: FRIENDLY_COMP_ID,
  logoUrl: null,
  bannerUrl: null,
  status: "group_stage",
  organizerName: null,
  startDate: null,
  endDate: null,
  venueCity: null,
  updatedAt: "",
} as Competition;


type Row = Record<string, unknown>;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v : null;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Les statuts d'un amical et ceux d'un match de compétition ne portent pas les
 * mêmes mots : « upcoming » d'un côté, « scheduled » de l'autre. Le tableau ne
 * connaît que les seconds.
 */
export function statutAmicalVersCompetition(v: unknown): CompMatch["status"] | null {
  switch (v) {
    case "live": return "live";
    case "completed": return "completed";
    case "cancelled": return "cancelled";
    case "upcoming": return "scheduled";
    // « challenge », « pending », « draft », « delayed » : un match qui n'est
    // pas encore accepté n'a rien à faire sur un tableau public.
    default: return null;
  }
}

/**
 * L'état du direct, en camelCase.
 *
 * Il était laissé à `null` : le tableau du Direct calcule sa minute de jeu
 * dessus, donc un amical couvert en direct s'affichait figé à 0′ pendant que
 * son score, lui, avançait. Le chronomètre est ce qui distingue un match qu'on
 * regarde d'une ligne de résultat.
 */
function etatDuDirect(v: unknown): Match["liveState"] {
  if (!v || typeof v !== "object") return null;
  const ls = v as Row;
  const events = Array.isArray(ls.events) ? (ls.events as Row[]) : [];
  return {
    currentPeriod: typeof ls.current_period === "number" ? ls.current_period : 0,
    timerStartAt: str(ls.timer_start_at),
    timerOffset: typeof ls.timer_offset === "number" ? ls.timer_offset : 0,
    isTimerRunning: ls.is_timer_running === true,
    events: events.map((e) => ({
      id: String(e.id ?? ""),
      type: e.type as NonNullable<Match["liveState"]>["events"][number]["type"],
      period: typeof e.period === "number" ? e.period : 0,
      minute: typeof e.minute === "number" ? e.minute : 0,
      teamId: String(e.team_id ?? ""),
      playerId: str(e.player_id) ?? undefined,
      playerName: str(e.player_name) ?? undefined,
      detail: str(e.detail) ?? undefined,
      assistPlayerId: str(e.assist_player_id),
      assistPlayerName: str(e.assist_player_name),
      contestedByManagerId: str(e.contested_by_manager_id),
      contestationReason: str(e.contestation_reason),
      varStatus: (e.var_status ?? null) as NonNullable<Match["liveState"]>["events"][number]["varStatus"],
      createdAt: String(e.created_at ?? ""),
    })),
  };
}

/**
 * Le jour où le match a EU LIEU, et non celui où on l'avait prévu.
 *
 * Le tableau du Direct groupe par jour. Un amical terminé y entrait à sa date
 * programmée : un match prévu samedi et joué mercredi s'affichait sous samedi,
 * c'est-à-dire nulle part pour qui regarde le tableau du jour. `completed_at`
 * est la seule date qui soit un fait plutôt qu'une intention.
 *
 * Accepte les trois formes qui circulent : Timestamp Firestore (SDK admin ou
 * navigateur), objet sérialisé `{seconds}`, ou chaîne ISO.
 */
function jourDeLaRencontre(datePrevue: string, completedAt: unknown): string {
  const d = (() => {
    if (!completedAt) return null;
    const v = completedAt as { toDate?: () => Date; seconds?: number };
    if (typeof v.toDate === "function") return v.toDate();
    if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
    if (typeof completedAt === "string") {
      const parsed = new Date(completedAt);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  })();
  if (!d) return datePrevue;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Un document `matches` rendu dans la forme du tableau du Direct.
 *
 * Partagé serveur/navigateur À DESSEIN : le premier affichage vient du rendu
 * serveur, les mises à jour viennent d'un écouteur Firestore côté client, et
 * les deux doivent produire exactement la même ligne. Deux conversions
 * séparées auraient dérivé au premier champ ajouté.
 *
 * Renvoie `null` quand le match n'a rien à faire sur un tableau public.
 */
export function amicalVersCompMatch(id: string, d: Row): CompMatch | null {
  const status = statutAmicalVersCompetition(d.status);
  if (!status) return null;
  const date = str(d.date);
  if (!date) return null;

  return {
    id,
    competitionId: FRIENDLY_COMP_ID,
    stage: "group",
    group: null,
    round: null,
    bracketSlot: null,
    homeSource: null,
    awaySource: null,
    homeTeamId: str(d.home_team_id),
    awayTeamId: str(d.away_team_id),
    homeTeamName: str(d.home_team_name) ?? "Équipe",
    awayTeamName: str(d.away_team_name) ?? "Équipe",
    // Un amical n'a pas de blason dans le modèle de données.
    homeTeamLogo: null,
    awayTeamLogo: null,
    bannerUrl: null,
    // Terminé : le jour où il s'est joué. Sinon, celui où il est prévu.
    date: status === "completed" ? jourDeLaRencontre(date, d.completed_at) : date,
    time: str(d.time),
    venueName: str(d.venue_name),
    venueCity: str(d.venue_city),
    status,
    scoreHome: num(d.score_home),
    scoreAway: num(d.score_away),
    // La séance, quand la rencontre s'y est décidée : sans elle, le tableau
    // affiche un nul sur un match qu'une équipe a passé.
    penaltyHome: num(d.penalty_home),
    penaltyAway: num(d.penalty_away),
    winnerTeamId: null,
    forfeitByTeamId: null,
    feedsIntoMatchId: null,
    feedsIntoSlot: null,
    homeLineup: [],
    awayLineup: [],
    homeLineupReady: false,
    awayLineupReady: false,
    homeOnPitch: [],
    awayOnPitch: [],
    liveState: etatDuDirect(d.live_state),
    createdAt: "",
    updatedAt: "",
  } as CompMatch;
}
