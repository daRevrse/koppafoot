"use client";

import {
  castPrediction, getMyPrediction, pourcentages, type PredictionCounts,
} from "@/lib/predictions";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModal";
import TirsAuBut from "@/components/match/TirsAuBut";
import {
  useState, useEffect, useMemo, useCallback, useSyncExternalStore,
} from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Flame, ChevronLeft, ChevronRight, ChevronDown, Star, Trophy,
  MapPin, CalendarDays, Goal, Handshake,
} from "lucide-react";
import {
  onCompMatches, listCompTeams, computePlayerContributions,
} from "@/lib/competition-firestore";
import { stageLabel } from "@/lib/competition-format";
import type { CompetitionFeed } from "@/lib/competition-admin";
import { FRIENDLY_COMP_ID, FRIENDLY_COMPETITION, amicalVersCompMatch } from "@/lib/friendlies-shared";
import { onLiveFriendlies } from "@/lib/firestore";
import { isWorldComp } from "@/lib/world-board-shared";
import type { FootballCompetition } from "@/lib/football-data";
import type { Competition, CompMatch, CompMatchRound, CompTeam } from "@/types";

// ============================================
// DirectHomeV2, the live-score home, a scores board rather than a timeline.
//
// Reading order, top to bottom:
//   1. the competition filter, then a day-driven fixture list grouped by
//      competition and collapsible;
//   2. a rail beside it carrying the affiche, the featured match with its
//      pronostic, cycling on its own until someone votes or pages, then the
//      week's top offensive contributions.
//
// On a phone the affiche comes first, then the board, then the rankings,
// which is why the board sits between the two rail cards rather than after
// both.
// ============================================

type Entry = { match: CompMatch; competition: Competition };
type ListTab = "all" | "favs" | "comps";
type StatusChip = "live" | "finished" | "upcoming";
type Pick = "home" | "draw" | "away";

const LIST_TABS: { key: ListTab; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "favs", label: "Favoris" },
  { key: "comps", label: "Compétitions" },
];

const ROUND_LABELS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  final: "Finale",
  third_place: "Petite finale",
};

// Local-only preferences: a favourite and a pronostic are a device thing,
// not account data, no rules, no writes, and they work signed out.
const FAV_KEY = "kf:direct:favs";
const COMP_FAV_KEY = "kf:direct:compfavs";
const PICK_KEY = "kf:direct:picks";

// Le nombre d'affiches du carrousel. Cinq points de pagination se lisent d'un
// coup d'oeil ; au-dela on ne sait plus ou l'on en est.
const AFFICHES_MAX = 5;

// ---- date helpers -------------------------------------------------------------

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(key: string, delta: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

/** "Aujourd'hui" / "Demain" / "Hier", else "sam. 23 août". */
function dayLabel(key: string): string {
  const today = dayKey(new Date());
  if (key === today) return "Aujourd'hui";
  if (key === addDays(today, 1)) return "Demain";
  if (key === addDays(today, -1)) return "Hier";
  try {
    return new Date(`${key}T00:00:00`).toLocaleDateString("fr-FR", {
      weekday: "short", day: "numeric", month: "short",
    });
  } catch {
    return key;
  }
}

/** Live minute off the shared live_state clock (same math as LiveMatchConsole). */
function liveMinute(m: CompMatch): number {
  const ls = m.liveState;
  if (!ls) return 0;
  if (m.status === "live" && ls.isTimerRunning && ls.timerStartAt) {
    const elapsed = Date.now() - new Date(ls.timerStartAt).getTime() + (ls.timerOffset || 0);
    return Math.floor(elapsed / 60000) + 1;
  }
  return Math.floor((ls.timerOffset || 0) / 60000) + 1;
}

// Prefer the live team-doc crest (always current) over the match's
// denormalised snapshot (stale if the logo was uploaded after the fixture).
function logoFor(
  teamsById: Map<string, CompTeam>,
  teamId: string | null,
  fallback: string | null,
): string | null {
  return (teamId ? teamsById.get(teamId)?.logoUrl : null) ?? fallback;
}

/** Second line of a competition header, the "country" line of the model. */
function competitionSubtitle(c: Competition): string {
  return c.venueCity ?? c.organizerName ?? "";
}

/**
 * Ou mene l'en-tete d'un groupe. Les amicaux n'ont pas de page de
 * competition : on renvoie vers leur liste.
 */
function competitionHref(c: Competition): string {
  if (c.id === FRIENDLY_COMP_ID) return "/matches";
  // Une competition mondiale a sa propre page, quand le fournisseur nous a
  // donne son code ; sinon on renvoie vers l'annuaire.
  if (isWorldComp(c.id)) return c.slug ? `/competitions/monde/${c.slug}` : "/competitions";
  return `/c/${c.slug}`;
}

function matchHref(e: Entry): string {
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

function entryKey(e: Entry): string {
  return `${e.competition.id}:${e.match.id}`;
}

/** Kickoff sort key, undated fixtures land last. */
function kickoff(e: Entry): string {
  return `${e.match.date ?? "9999-99-99"}T${e.match.time ?? "99:99"}`;
}

/** Who actually won, once the match is over (penalties included). */
function finalOutcome(m: CompMatch): Pick | null {
  if (m.status !== "completed") return null;
  if (m.winnerTeamId && m.homeTeamId && m.winnerTeamId === m.homeTeamId) return "home";
  if (m.winnerTeamId && m.awayTeamId && m.winnerTeamId === m.awayTeamId) return "away";
  const h = m.scoreHome ?? 0;
  const a = m.scoreAway ?? 0;
  return h > a ? "home" : h < a ? "away" : "draw";
}

// ---- crests -------------------------------------------------------------------

function Crest({ name, logo, size = 20 }: { name: string; logo?: string | null; size?: number }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-emerald-50 font-black text-emerald-600 ring-1 ring-emerald-100"
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.38) }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function CompCrest({ competition, size = 24 }: { competition: Competition; size?: number }) {
  if (competition.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={competition.logoUrl}
        alt=""
        className="shrink-0 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center bg-amber-50"
      style={{ width: size, height: size }}
    >
      <Trophy size={Math.round(size * 0.55)} className="text-amber-500" />
    </span>
  );
}

// ---- device-local preferences --------------------------------------------------

/**
 * A tiny localStorage-backed store read through useSyncExternalStore: the
 * server snapshot is empty and the device value only arrives on subscribe,
 * which is how browser-only state stays out of the hydrated HTML without a
 * mismatch (and without a setState-in-effect).
 */
function createLocalStore<T>(
  key: string,
  empty: T,
  revive: (raw: string) => T,
  serialize: (value: T) => string,
) {
  let cache = empty;   // snapshots must be referentially stable
  let loaded = false;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener: () => void) {
      if (!loaded) {
        loaded = true;
        try {
          const raw = localStorage.getItem(key);
          if (raw) cache = revive(raw);
        } catch {
          /* private mode / corrupted value, the store just stays empty */
        }
      }
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    get: () => cache,
    getServer: () => empty,
    set(next: T) {
      cache = next;
      try {
        localStorage.setItem(key, serialize(next));
      } catch {
        /* ignore */
      }
      listeners.forEach((l) => l());
    },
  };
}

const favStore = createLocalStore<Set<string>>(
  FAV_KEY,
  new Set(),
  (raw) => new Set(JSON.parse(raw) as string[]),
  (value) => JSON.stringify([...value]),
);

// Starring a competition is the useful star: it pins the competition to the
// top of the directory AND pulls all of its matches into Favoris, so a
// supporter follows a whole tournament in one tap rather than match by match.
const compFavStore = createLocalStore<Set<string>>(
  COMP_FAV_KEY,
  new Set(),
  (raw) => new Set(JSON.parse(raw) as string[]),
  (value) => JSON.stringify([...value]),
);

const pickStore = createLocalStore<Record<string, Pick>>(
  PICK_KEY,
  {},
  (raw) => JSON.parse(raw) as Record<string, Pick>,
  (value) => JSON.stringify(value),
);

function useFavourites() {
  const favs = useSyncExternalStore(favStore.subscribe, favStore.get, favStore.getServer);

  const toggle = useCallback((id: string) => {
    const next = new Set(favStore.get());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    favStore.set(next);
  }, []);

  return [favs, toggle] as const;
}

function useCompFavourites() {
  const favs = useSyncExternalStore(
    compFavStore.subscribe, compFavStore.get, compFavStore.getServer,
  );

  const toggle = useCallback((id: string) => {
    const next = new Set(compFavStore.get());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    compFavStore.set(next);
  }, []);

  return [favs, toggle] as const;
}

/**
 * Les pronostics donnés depuis l'accueil.
 *
 * LE VOTE N'ÉTAIT ÉCRIT NULLE PART. Ce store ne tenait qu'une trace locale :
 * l'affiche se souvenait du camp choisi, les barres restaient à 33/33/33 pour
 * l'éternité, et le pronostic n'existait pour personne d'autre — pas même pour
 * son auteur sur un autre appareil. Le sondage du rail, lui, écrivait bien
 * dans `match_predictions` : deux surfaces, un seul de ces deux chemins
 * comptait vraiment.
 *
 * Le stockage local RESTE, mais pour ce qu'il sait faire : réafficher tout de
 * suite le camp choisi, sans attendre une lecture. L'écriture, elle, part
 * maintenant vers la base.
 *
 * IL FAUT UN COMPTE, comme partout ailleurs : un pronostic anonyme se
 * remplirait de rechargements de page. On ouvre la fenêtre de connexion au
 * lieu de laisser le clic sans effet.
 */
function usePicks() {
  const picks = useSyncExternalStore(pickStore.subscribe, pickStore.get, pickStore.getServer);
  const { user } = useAuth();
  const { open } = useAuthModal();

  const choose = useCallback(
    async (id: string, pick: Pick) => {
      if (!user) {
        open("Crée ton compte pour donner ton pronostic.");
        return;
      }
      // L'écriture d'abord, la trace locale ensuite : c'est le changement de
      // `picks` qui déclenche la relecture des totaux, et la relire avant que
      // le vote soit posé la renverrait sans lui.
      await castPrediction(id, user.uid, pick).catch(() => {});
      pickStore.set({ ...pickStore.get(), [id]: pick });
    },
    [user, open],
  );

  return [picks, choose] as const;
}

/**
 * Les matchs dont on a déjà tenté de rattraper le pronostic local.
 *
 * Une personne qui a voté AVANT ce correctif a un choix en mémoire locale et
 * rien dans la base. On le repose une fois, au premier affichage de l'affiche,
 * plutôt que de laisser un vote se perdre en silence. `castPrediction` écrit
 * en `merge` sur un identifiant déterministe, donc reposer un vote déjà
 * enregistré ne change rien — mais l'écrire à chaque rendu coûterait une
 * requête par affichage, d'où ce garde-fou.
 */
const pronosticsRattrapes = new Set<string>();

// ---- Competition directory ------------------------------------------------------

/**
 * The "Compétitions" tab: a directory rather than a list.
 *
 * Starred competitions come first as tiles, the ones a supporter actually
 * follows, then everything else grouped by city and folded away, because a
 * flat alphabetical list of every tournament in the country is a phone book,
 * not a shortcut.
 *
 * The star is the same one as the fixture rows, one level up: it pulls the
 * whole competition into Favoris instead of one match at a time.
 */
function CompetitionsDirectory({
  competitions, worldCompetitions, compFavs, onStar,
}: {
  competitions: Competition[];
  worldCompetitions: FootballCompetition[];
  compFavs: Set<string>;
  onStar: (id: string) => void;
}) {
  const [openCities, setOpenCities] = useState<Set<string>>(new Set());

  const starred = competitions.filter((c) => compFavs.has(c.id));

  // Everything else, bucketed by where it is played.
  const byCity = useMemo(() => {
    const map = new Map<string, Competition[]>();
    for (const c of competitions) {
      const city = c.venueCity ?? "Ailleurs";
      const list = map.get(city) ?? [];
      list.push(c);
      map.set(city, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [competitions]);

  const toggleCity = (city: string) => {
    setOpenCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  };

  // Un jour sans competition locale n'est plus une page vide : le football
  // mondial, lui, joue toujours quelque part.
  if (competitions.length === 0 && worldCompetitions.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <Trophy size={24} className="mx-auto text-gray-300" />
        <p className="mt-2 text-[13px] font-bold text-gray-500">
          Aucune compétition publique pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ---- Tiles: what you follow, or what is on if you follow nothing ---- */}
      <div className="px-3 pb-3 pt-1">
        <p className="px-0.5 pb-2 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
          {starred.length > 0 ? "Mes compétitions" : "À suivre"}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(starred.length > 0 ? starred : competitions.slice(0, 6)).map((c) => {
            const isFav = compFavs.has(c.id);
            return (
              <div
                key={c.id}
                className="relative border border-gray-200/70 bg-gray-50/60 transition-colors hover:bg-white"
              >
                <button
                  type="button"
                  onClick={() => onStar(c.id)}
                  aria-label={isFav ? "Ne plus suivre" : "Suivre cette compétition"}
                  aria-pressed={isFav}
                  className="absolute right-1.5 top-1.5 z-10 p-1 transition-colors"
                >
                  <Star
                    size={15}
                    className={isFav ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-gray-400"}
                  />
                </button>
                <Link
                  href={`/c/${c.slug}`}
                  className="flex flex-col items-center gap-2 px-3 py-4 text-center"
                >
                  <CompCrest competition={c} size={34} />
                  <span className="line-clamp-2 text-[12px] font-black leading-tight text-gray-900">
                    {c.name}
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Everything, by city ---- */}
      <p className="border-t border-gray-200/70 px-3.5 pb-1.5 pt-3 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
        Toutes les compétitions
      </p>
      {byCity.map(([city, comps]) => {
        const open = openCities.has(city);
        return (
          <div key={city} className="border-t border-gray-200/70">
            <button
              type="button"
              onClick={() => toggleCity(city)}
              aria-expanded={open}
              className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-gray-50/70"
            >
              <MapPin size={15} className="shrink-0 text-gray-300" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-black text-gray-900">
                {city}
              </span>
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-gray-400">
                {comps.length}
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-gray-300 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>

            {open && comps.map((c) => {
              const isFav = compFavs.has(c.id);
              return (
                <div key={c.id} className="flex items-center gap-2.5 border-t border-gray-200/70 pl-9 pr-2">
                  <Link href={`/c/${c.slug}`} className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5">
                    <CompCrest competition={c} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-gray-900">{c.name}</span>
                      <span className="block truncate text-[11px] font-bold text-gray-400">
                        {c.organizerName ?? competitionSubtitle(c)}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => onStar(c.id)}
                    aria-label={isFav ? "Ne plus suivre" : "Suivre cette compétition"}
                    aria-pressed={isFav}
                    className="shrink-0 p-2"
                  >
                    <Star
                      size={15}
                      className={isFav ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-gray-400"}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ---- Le football mondial ----
          Lu chez football-data.org, cote serveur. Ces competitions-la ne se
          rejoignent pas et ne se mettent pas en favori : on ne fait que les
          suivre, et le lien part vers leur propre espace. D'ou l'absence
          d'etoile, qui n'aurait rien a accrocher. */}
      {worldCompetitions.length > 0 && (
        <>
          <p className="border-t border-gray-200/70 px-3.5 pb-1.5 pt-3 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
            Le football mondial
          </p>
          {worldCompetitions.map((c) => (
            <Link
              key={c.code}
              href={`/competitions/monde/${c.code}`}
              className="flex items-center gap-2.5 border-t border-gray-200/70 px-3.5 py-2.5 transition-colors hover:bg-gray-50/70"
            >
              {c.emblem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.emblem} alt="" className="h-[26px] w-[26px] shrink-0 object-contain" />
              ) : (
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center bg-gray-100 text-gray-400">
                  <Trophy size={14} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-gray-900">{c.name}</span>
                <span className="block truncate text-[11px] font-bold text-gray-400">
                  {[c.area, c.type === "CUP" ? "Coupe" : c.type === "LEAGUE" ? "Championnat" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {c.areaFlag && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.areaFlag} alt="" className="h-4 w-6 shrink-0 object-contain" />
              )}
            </Link>
          ))}
        </>
      )}
    </div>
  );
}

// ---- Fixture list ---------------------------------------------------------------

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-gray-400 transition-colors hover:text-gray-600"
    >
      {label}
      <span className={`relative h-4 w-7 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-gray-200"}`}>
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
            on ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/** One fixture: kickoff column, the two sides stacked, favourite star. */
function MatchRow({
  entry, teamsById, starred, onStar, hideScores,
}: {
  entry: Entry;
  teamsById: Map<string, CompTeam>;
  starred: boolean;
  onStar: () => void;
  hideScores: boolean;
}) {
  const { match } = entry;
  const isLive = match.status === "live";
  const finished = match.status === "completed";
  const scored = (isLive || finished) && !hideScores;
  const home = match.scoreHome ?? 0;
  const away = match.scoreAway ?? 0;
  const hasPens = match.penaltyHome != null && match.penaltyAway != null;

  // The beaten side greys out, the standard scoreboard reading.
  const sideClass = (mine: number, theirs: number) =>
    finished && !hideScores && mine < theirs ? "text-gray-400" : "text-gray-900";

  return (
    <div className="group flex items-stretch gap-1 border-b border-gray-200/70 pl-2 pr-1 transition-colors last:border-0 hover:bg-gray-50/70">
      <Link href={matchHref(entry)} className="flex min-w-0 flex-1 items-center gap-2 py-2">
        {/* Kickoff / live clock */}
        <div className="flex w-10 shrink-0 flex-col items-center justify-center gap-0.5">
          {isLive ? (
            <>
              <span className="text-[11px] font-black tabular-nums text-red-500">
                {liveMinute(match)}′
              </span>
              <span className="h-1 w-1 animate-pulse rounded-full bg-red-500" />
            </>
          ) : (
            <>
              <span className="text-[11px] font-black tabular-nums text-gray-500">
                {finished ? "Fin" : (match.time ?? ",")}
              </span>
              {!finished && <span className="text-[10px] font-bold text-gray-300">-</span>}
            </>
          )}
        </div>

        {/* The two sides, one per line, score right-aligned: a fixture reads
            top-to-bottom here, unlike the single-line row of the old home. */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <Crest name={match.homeTeamName} logo={logoFor(teamsById, match.homeTeamId, match.homeTeamLogo)} />
            <span className={`min-w-0 flex-1 truncate text-[13px] font-bold ${sideClass(home, away)}`}>
              {match.homeTeamName}
            </span>
            {hasPens && scored && (
              <span className="shrink-0 text-[10px] font-bold tabular-nums text-gray-400">
                ({match.penaltyHome})
              </span>
            )}
            <span
              className={`w-3 shrink-0 text-right text-[13px] font-black tabular-nums ${
                isLive ? "text-red-500" : sideClass(home, away)
              }`}
            >
              {scored ? home : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Crest name={match.awayTeamName} logo={logoFor(teamsById, match.awayTeamId, match.awayTeamLogo)} />
            <span className={`min-w-0 flex-1 truncate text-[13px] font-bold ${sideClass(away, home)}`}>
              {match.awayTeamName}
            </span>
            {hasPens && scored && (
              <span className="shrink-0 text-[10px] font-bold tabular-nums text-gray-400">
                ({match.penaltyAway})
              </span>
            )}
            <span
              className={`w-3 shrink-0 text-right text-[13px] font-black tabular-nums ${
                isLive ? "text-red-500" : sideClass(away, home)
              }`}
            >
              {scored ? away : ""}
            </span>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={onStar}
        aria-pressed={starred}
        aria-label={starred ? "Retirer des favoris" : "Suivre ce match"}
        className="flex w-7 shrink-0 items-center justify-center"
      >
        <Star
          size={15}
          className={starred ? "fill-amber-400 text-amber-400" : "text-gray-200 hover:text-amber-400"}
        />
      </button>
    </div>
  );
}

/** A competition and its fixtures for the selected day, collapsible. */
function CompetitionGroup({
  competition, entries, teamsById, favs, onStar, hideScores,
}: {
  competition: Competition;
  entries: Entry[];
  teamsById: Map<string, CompTeam>;
  favs: Set<string>;
  onStar: (key: string) => void;
  hideScores: boolean;
}) {
  const [open, setOpen] = useState(true);
  const stage = stageLabel(competition.competitionType, competition.status);
  // A knockout day reads better by round than by the competition's running
  // stage, "Quart de finale" beats "Phase finale" when the two agree.
  const firstRound = entries[0]?.match.round;
  // « Matchs amicaux, Phase de groupes » : un amical n'a ni poule ni tour. Le
  // rattachement à une compétition synthétique lui faisait hériter d'un libellé
  // d'étape qui ne veut rien dire.
  const heading = competition.id === FRIENDLY_COMP_ID
    ? null
    : firstRound ? ROUND_LABELS[firstRound] : stage;

  return (
    <div className="border-b border-gray-200/70 last:border-0">
      <div className="flex items-center gap-2.5 bg-gray-50/70 px-3 py-2">
        <Link href={competitionHref(competition)} className="flex min-w-0 flex-1 items-center gap-2.5">
          <CompCrest competition={competition} size={26} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-black text-gray-900">
              {competition.name}
              {heading ? `, ${heading}` : ""}
            </span>
            <span className="flex items-center gap-1 truncate text-[11px] font-bold text-gray-400">
              <MapPin size={10} className="shrink-0" />
              {competitionSubtitle(competition)}
            </span>
          </span>
        </Link>
        <span className="shrink-0 text-[11px] font-black tabular-nums text-gray-400">
          {entries.length}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Replier" : "Déplier"}
          className="flex h-6 w-6 shrink-0 items-center justify-center text-gray-400 transition-colors hover:bg-white hover:text-gray-700"
        >
          <ChevronDown size={16} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border border-gray-200/70 bg-white"
          >
            {entries.map((e) => (
              <MatchRow
                key={entryKey(e)}
                entry={e}
                teamsById={teamsById}
                starred={favs.has(entryKey(e))}
                onStar={() => onStar(entryKey(e))}
                hideScores={hideScores}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Spotlight: the featured match, with a pronostic ------------------------------

function PickButton({
  children, selected, correct, missed, disabled, onClick, label, pct,
}: {
  children: React.ReactNode;
  selected: boolean;
  correct: boolean;
  missed: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  /**
   * Le pourcentage de cette issue, une fois le pronostic donne, sinon rien.
   *
   * IL S'AFFICHE DANS LE BOUTON, et non plus sous lui. Voter ouvrait trois
   * barres de plus, une par issue, avec le nom de l'equipe deja lisible
   * au-dessus : le bloc doublait de hauteur pour redire ce qu'on voyait, et
   * poussait le pager hors de l'ecran sur un telephone. Le blason porte deja
   * l'identite de l'issue, il ne lui manquait que son chiffre.
   */
  pct?: number | null;
}) {
  const tone = correct
    ? "border-emerald-500 bg-emerald-50"
    : missed
      ? "border-red-200 bg-red-50"
      : selected
        ? "border-emerald-500 bg-emerald-50"
        : "border-gray-200/70 bg-white hover:border-gray-300";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      // Un aria-label remplace le contenu du bouton : sans le pourcentage
      // dedans, un lecteur d'ecran serait le seul a ne pas connaitre le
      // resultat du vote.
      aria-label={pct == null ? label : `${label}, ${pct} %`}
      className={`flex h-10 items-center justify-center gap-1.5 rounded-full border-2 px-1.5 transition-colors disabled:cursor-default ${tone}`}
    >
      {children}
      {pct != null && (
        <span className="text-[13px] font-black tabular-nums text-gray-900">{pct}%</span>
      )}
    </button>
  );
}

function Spotlight({
  entries, teamsById, picks, onPick,
}: {
  entries: Entry[];
  teamsById: Map<string, CompTeam>;
  picks: Record<string, Pick>;
  onPick: (id: string, p: Pick) => void;
}) {
  const [index, setIndex] = useState(0);
  // Auto-advance stops for good the moment this rail is used, voting on a
  // match, or paging to one, means that match is the one being looked at.
  // Sliding it away a few seconds later would move the pronostic out from
  // under the tap.
  const [locked, setLocked] = useState(false);
  // Les totaux, etiquetes du match qui les a demandes : le carrousel change
  // d'affiche plus vite qu'une reponse reseau, et les pourcentages du match
  // precedent se seraient poses une seconde sur les blasons du suivant.
  const [counts, setCounts] = useState<{ matchId: string; valeurs: PredictionCounts } | null>(null);
  const { user: utilisateur } = useAuth();

  const count = entries.length;

  useEffect(() => {
    if (count < 2 || locked) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 7000);
    return () => clearInterval(t);
  }, [count, locked]);

  const safe = count === 0 ? 0 : index % count;
  const entry = entries[safe];

  // Les comptes ne sont demandes qu'apres le vote : avant, ils n'ont rien a
  // dire qu'on veuille montrer, et c'est une requete de moins par affiche.
  //
  // Place AVANT la sortie anticipee : un hook appele conditionnellement
  // change l'ordre des hooks d'un rendu a l'autre, ce que React interdit.
  const entreeCourante = count === 0 ? null : entries[index % count];
  const idCourant = entreeCourante?.match.id ?? null;
  const choixCourant = idCourant ? picks[idCourant] : undefined;
  const termine = entreeCourante?.match.status === "completed";

  useEffect(() => {
    // Pas de setState synchrone au montage : on sort sans toucher a l'etat,
    // et le rendu lit `parts` a null, ce qui masque simplement le bloc.
    if (!idCourant || !choixCourant || termine) return;
    let vivant = true;

    // `no-store` : la route pose un cache de dix secondes, largement de quoi
    // renvoyer un total d'avant le vote qu'on vient de poser. On veut le
    // chiffre du moment, pas celui d'il y a huit secondes.
    const relire = () =>
      fetch(`/api/matches/${encodeURIComponent(idCourant)}/predictions`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (vivant && d) setCounts({ matchId: idCourant, valeurs: d as PredictionCounts });
        })
        .catch(() => {});

    // Rattrapage des votes d'avant, restés en mémoire locale sans jamais
    // atteindre la base. Une fois par match et par session.
    if (utilisateur && !pronosticsRattrapes.has(idCourant)) {
      pronosticsRattrapes.add(idCourant);
      getMyPrediction(idCourant, utilisateur.uid)
        .then((enBase) =>
          enBase ? null : castPrediction(idCourant, utilisateur.uid, choixCourant),
        )
        .catch(() => {})
        .then(relire);
    } else {
      void relire();
    }

    return () => { vivant = false; };
  }, [idCourant, choixCourant, termine, utilisateur]);

  if (!entry) return null;

  const { match, competition } = entry;
  const isLive = match.status === "live";
  const finished = match.status === "completed";
  const outcome = finalOutcome(match);
  const pick = picks[match.id];
  const go = (next: number) => {
    setLocked(true);
    setIndex(((next % count) + count) % count);
  };

  const vote = (p: Pick) => {
    setLocked(true);
    onPick(match.id, p);
  };

  // Les pourcentages ne s'ouvrent qu'une fois qu'on a vote : avant, le premier
  // chiffre affiche deciderait pour tout le monde.
  const parts = pick && counts?.matchId === match.id ? pourcentages(counts.valeurs) : null;

  return (
    <div className="overflow-hidden border border-gray-200/70 bg-white">
      {/* Competition header */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <CompCrest competition={competition} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-black text-gray-900">{competition.name}</span>
          <span className="block truncate text-[11px] font-bold text-gray-400">
            {stageTagLabel(match) ?? competitionSubtitle(competition)}
          </span>
        </span>
        <Link
          href={competitionHref(competition)}
          aria-label="Voir la compétition"
          className="shrink-0 text-gray-300 transition-colors hover:text-gray-600"
        >
          <ChevronRight size={18} />
        </Link>
      </div>

      {/* The match itself */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${competition.id}-${match.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Link href={matchHref(entry)} className="block px-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 bg-gray-50/70 p-4">
              <div className="flex flex-col items-center gap-2">
                <Crest
                  name={match.homeTeamName}
                  logo={logoFor(teamsById, match.homeTeamId, match.homeTeamLogo)}
                  size={44}
                />
                <span className="line-clamp-2 text-center text-[12px] font-black text-gray-900">
                  {match.homeTeamName}
                </span>
              </div>

              <div className="px-1 text-center">
                {isLive || finished ? (
                  <>
                    <span className="font-display text-2xl font-black tabular-nums text-gray-900">
                      {match.scoreHome ?? 0}
                      <span className="mx-1 text-gray-300">:</span>
                      {match.scoreAway ?? 0}
                    </span>
                    <span
                      className={`mt-0.5 block text-[11px] font-black ${
                        isLive ? "text-red-500" : "text-gray-400"
                      }`}
                    >
                      {isLive ? `${liveMinute(match)}′` : "Terminé"}
                    </span>
                    <TirsAuBut home={match.penaltyHome} away={match.penaltyAway} className="mt-0.5" />
                  </>
                ) : (
                  <>
                    <span className="font-display text-2xl font-black tabular-nums text-gray-900">
                      {match.time ?? ","}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-black text-gray-400">
                      {match.date ? dayLabel(match.date) : "À programmer"}
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-col items-center gap-2">
                <Crest
                  name={match.awayTeamName}
                  logo={logoFor(teamsById, match.awayTeamId, match.awayTeamLogo)}
                  size={44}
                />
                <span className="line-clamp-2 text-center text-[12px] font-black text-gray-900">
                  {match.awayTeamName}
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      </AnimatePresence>

      {/* Le pronostic. Le choix se retient en local pour se rafficher sans
          attendre, mais il s'ecrit dans la base, et demande donc un compte
          (voir usePicks). */}
      <div className="px-4 pb-3 pt-3">
        <div className="min-w-0">
          <p className="text-[13px] font-black text-gray-900">Qui va gagner ?</p>
          <p className="text-[11px] font-bold text-gray-400">
            {finished ? "Le match est joué" : "Donne ton pronostic"}
          </p>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <PickButton
            label={`Victoire ${match.homeTeamName}`}
            selected={pick === "home"}
            correct={finished && outcome === "home"}
            missed={finished && pick === "home" && outcome !== "home"}
            disabled={finished}
            onClick={() => vote("home")}
            pct={parts?.home}
          >
            <Crest
              name={match.homeTeamName}
              logo={logoFor(teamsById, match.homeTeamId, match.homeTeamLogo)}
              size={22}
            />
          </PickButton>
          <PickButton
            label="Match nul"
            selected={pick === "draw"}
            correct={finished && outcome === "draw"}
            missed={finished && pick === "draw" && outcome !== "draw"}
            disabled={finished}
            onClick={() => vote("draw")}
            pct={parts?.draw}
          >
            <span className="text-[13px] font-black text-gray-500">X</span>
          </PickButton>
          <PickButton
            label={`Victoire ${match.awayTeamName}`}
            selected={pick === "away"}
            correct={finished && outcome === "away"}
            missed={finished && pick === "away" && outcome !== "away"}
            disabled={finished}
            onClick={() => vote("away")}
            pct={parts?.away}
          >
            <Crest
              name={match.awayTeamName}
              logo={logoFor(teamsById, match.awayTeamId, match.awayTeamLogo)}
              size={22}
            />
          </PickButton>
        </div>

        {pick && finished && (
          <p className="mt-2 text-center text-[10px] font-bold text-gray-300">
            {pick === outcome ? "Pronostic validé" : "Pronostic manqué"}
          </p>
        )}
      </div>

      {/* Pager across the featured matches */}
      {count > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200/70 px-3 py-2">
          <button
            type="button"
            onClick={() => go(safe - 1)}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <ChevronLeft size={14} />
            Précédent
          </button>
          <div className="flex gap-1.5">
            {entries.map((e, i) => (
              <button
                key={entryKey(e)}
                type="button"
                aria-label={`Affiche ${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === safe ? "w-4 bg-emerald-500" : "w-1.5 bg-gray-200 hover:bg-gray-300"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(safe + 1)}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            Suivant
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/** "Groupe A" for group matches, the round label for knockout. */
function stageTagLabel(match: CompMatch): string | null {
  if (match.group) return `Groupe ${match.group}`;
  if (match.round) return ROUND_LABELS[match.round];
  return null;
}

// ---- Top performances ---------------------------------------------------------------

export interface PerformanceRow {
  playerName: string;
  teamId: string;
  goals: number;
  assists: number;
  total: number;
  competition: Competition;
}

/**
 * Best offensive contributions of the week, every competition mixed: goals
 * plus assists, ranked on the sum. The passer rides on the goal event (see
 * `setCompGoalAssist`), so a goal scored before the console started asking
 * simply carries none, those players still rank on their goals.
 */
function TopPerformancesCard({
  rows, scope, teamsById,
}: {
  rows: PerformanceRow[];
  scope: "week" | "all" | "last5";
  teamsById: Map<string, CompTeam>;
}) {
  if (rows.length === 0) return null;

  return (
    <div className=" border border-gray-200/70 bg-white">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <p className="flex items-center gap-1.5 font-display text-sm font-black text-gray-900">
          <Flame size={15} className="text-amber-500" />
          Top performances
        </p>
        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-600">
          {scope === "last5" ? "5 derniers matchs" : scope === "week" ? "Cette semaine" : "Depuis le début"}
        </span>
      </div>

      <div className="px-4">
        {rows.map((row, i) => {
          const team = teamsById.get(row.teamId);
          return (
            <div
              key={`${row.competition.id}-${row.teamId}-${row.playerName}`}
              className="flex items-center gap-2.5 border-t border-gray-200/70 py-2 first:border-0"
            >
              <span
                className={`w-4 shrink-0 text-center text-[11px] font-black tabular-nums ${
                  i === 0 ? "text-amber-500" : "text-gray-300"
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-gray-900">
                  {row.playerName}
                </span>
                <span className="flex items-center gap-1 truncate text-[11px] font-bold text-gray-400">
                  <Crest name={team?.name ?? "?"} logo={team?.logoUrl} size={12} />
                  {team?.name ?? row.competition.name}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black tabular-nums text-emerald-600">
                  <Goal size={11} />
                  {row.goals}
                </span>
                {/* Only once there is one to show: an old goal has no passer,
                    and a column of zeros would just look like missing data. */}
                {row.assists > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black tabular-nums text-blue-600">
                    <Handshake size={11} />
                    {row.assists}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <Link
        href={`/c/${rows[0].competition.slug}?tab=scorers`}
        className="flex items-center justify-center gap-1 border-t border-gray-200/70 py-2.5 text-[10px] font-black uppercase tracking-wide text-emerald-500 transition-colors hover:bg-gray-50 hover:text-emerald-600"
      >
        Classement complet
        <ChevronRight size={12} />
      </Link>
    </div>
  );
}

// ---- Page ---------------------------------------------------------------------------

export default function DirectHomeV2({
  initialFeed,
  worldCompetitions = [],
}: {
  initialFeed: CompetitionFeed[];
  /** Le football mondial, lu chez football-data.org cote serveur. */
  worldCompetitions?: FootballCompetition[];
}) {
  const [feed, setFeed] = useState<CompetitionFeed[]>(initialFeed);
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [tab, setTab] = useState<ListTab>("all");
  const [chip, setChip] = useState<StatusChip | null>(null);
  const [day, setDay] = useState<string>(() => dayKey(new Date()));
  const [compFilter, setCompFilter] = useState<string | null>(null);
  const [hideScores, setHideScores] = useState(false);
  const [favs, toggleFav] = useFavourites();
  const [compFavs, toggleCompFav] = useCompFavourites();
  const [picks, choosePick] = usePicks();

  // L'annuaire ne montre que de vraies competitions : celle des amicaux est
  // un fanion de regroupement, pas un tournoi qu'on peut ouvrir ou suivre.
  const competitions = useMemo(
    () => feed.map((f) => f.competition).filter((c) => c.id !== FRIENDLY_COMP_ID && !isWorldComp(c.id)),
    [feed],
  );
  // Stable dependency: `competitions` is a fresh array on every feed update,
  // so keying the effects on it would tear the listeners down on every score.
  const competitionIds = useMemo(() => competitions.map((c) => c.id).join(","), [competitions]);

  // One real-time listener per competition, the board is a live scoreboard,
  // so every fixture on screen has to move on its own.
  useEffect(() => {
    const ids = competitionIds ? competitionIds.split(",") : [];
    if (ids.length === 0) return;
    const unsubs = ids.map((id) =>
      onCompMatches(id, (matches) =>
        setFeed((prev) => prev.map((f) => (f.competition.id === id ? { ...f, matches } : f))),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [competitionIds]);

  // Les amicaux en cours, en direct eux aussi.
  //
  // L'écouteur par compétition, juste au-dessus, saute volontairement le fanion
  // des amicaux : ils n'ont pas de sous-collection `comp_matches`, ils vivent
  // dans `matches`. Sans cet écouteur-ci, un amical couvert restait figé sur
  // l'instantané du rendu serveur — le score n'avançait pas, et un match lancé
  // après le chargement de la page n'apparaissait jamais.
  useEffect(() => {
    return onLiveFriendlies((rows) => {
      const frais = rows
        .map((r) => amicalVersCompMatch(r.id, r.data))
        .filter((m): m is NonNullable<typeof m> => m != null);
      const idsFrais = new Set(frais.map((m) => m.id));

      setFeed((prev) => {
        const groupe = prev.find((f) => f.competition.id === FRIENDLY_COMP_ID);
        // Le rendu serveur porte aussi les amicaux à venir : on remplace ceux
        // dont l'écouteur donne des nouvelles, on ne jette pas les autres.
        const inchanges = (groupe?.matches ?? []).filter((m) => !idsFrais.has(m.id));
        const matches = [...frais, ...inchanges];
        if (matches.length === 0) return prev;
        return groupe
          ? prev.map((f) => (f.competition.id === FRIENDLY_COMP_ID ? { ...f, matches } : f))
          : [...prev, { competition: FRIENDLY_COMPETITION, matches }];
      });
    });
  }, []);

  // Team docs carry the current crest; match docs only a snapshot of it.
  useEffect(() => {
    const ids = competitionIds ? competitionIds.split(",") : [];
    if (ids.length === 0) return;
    let cancelled = false;
    Promise.all(ids.map((id) => listCompTeams(id).catch(() => []))).then((lists) => {
      if (!cancelled) setTeams(lists.flat());
    });
    return () => { cancelled = true; };
  }, [competitionIds]);

  // The live clock has to advance on its own between Firestore writes.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const allEntries = useMemo<Entry[]>(
    () => feed.flatMap((f) => f.matches.map((match) => ({ match, competition: f.competition }))),
    [feed],
  );

  // Competition filter (the row of pills) scopes everything below it.
  const scoped = useMemo(
    () => (compFilter ? allEntries.filter((e) => e.competition.id === compFilter) : allEntries),
    [allEntries, compFilter],
  );

  const liveEntries = useMemo(() => scoped.filter((e) => e.match.status === "live"), [scoped]);

  // Recalcule a chaque rendu, donc juste apres minuit : une chaine identique
  // ne relance aucun memo, une chaine differente les relance tous.
  const todayKey = dayKey(new Date());

  // L'affiche : ce qui se joue maintenant, puis ce qui vient. Un carrousel de
  // matchs du jour et a venir, pas un second tableau de resultats.
  //
  // ELLE RESTAIT FIGEE SUR UN MATCH JOUE, PARFOIS VIEUX DE PLUSIEURS
  // SEMAINES, et pour deux raisons qui se renforcaient. Le repli d'abord :
  // faute de match en cours ou programme, on montrait le DERNIER JOUE de la
  // competition, si bien qu'un tournoi termine gardait l'affiche pour lui
  // indefiniment, avec un pronostic mort-ne dessous. Le perimetre ensuite :
  // seules les competitions de la plateforme y entraient, donc souvent une
  // seule affiche — et rien a faire defiler, le pager ne s'affichant meme pas.
  //
  // Desormais TOUTES les competitions y passent, locales comme mondiales, les
  // amicaux avec. Le pronostic ne demande rien de plus qu'un identifiant de
  // match (voir lib/predictions), il vaut donc pour un match du fournisseur
  // externe comme pour les notres ; seul le lien change, un match mondial
  // n'ayant pas de fiche chez nous et renvoyant vers sa competition.
  const spotlightEntries = useMemo(() => {
    // Le jour et l'avenir, rien d'autre. Un match programme a une date deja
    // passee (report jamais corrige, fixture oubliee) n'est pas « a venir »
    // non plus : il tombait dans le meme piege que le resultat perime.
    const aVenir = scoped
      .filter((e) => e.match.status === "live"
        || (e.match.status === "scheduled" && e.match.date != null && e.match.date >= todayKey))
      .sort((a, b) => {
        const rang = (e: Entry) => (e.match.status === "live" ? 0 : 1);
        return rang(a) - rang(b) || kickoff(a).localeCompare(kickoff(b));
      });

    // Repli du jour, et du jour seulement : quand tout est deja joue ce soir,
    // l'affiche montre le resultat du soir plutot que de disparaitre. Elle ne
    // remonte pas plus loin, c'est precisement ce qui la figeait.
    const jouesDuJour = scoped
      .filter((e) => e.match.status === "completed" && e.match.date === todayKey)
      .sort((a, b) => kickoff(b).localeCompare(kickoff(a)));

    // Une competition par tour : la fleche fait d'abord passer d'un tournoi a
    // l'autre, ce qui est la navigation utile quand plusieurs jouent en meme
    // temps. Les tours suivants completent avec les matchs restants, sans quoi
    // une soiree a une seule competition n'aurait de nouveau qu'une affiche
    // immobile.
    const parCompetition = new Map<string, Entry[]>();
    for (const e of [...aVenir, ...jouesDuJour]) {
      const file = parCompetition.get(e.competition.id) ?? [];
      file.push(e);
      parCompetition.set(e.competition.id, file);
    }

    // L'ordre des competitions dans le carrousel, comme celui du tableau : ce
    // qui se joue maintenant devant, puis LE FOOTBALL D'ICI avant le football
    // mondial. Une soiree de Ligue 1 remplit cinq affiches en un clin d'oeil,
    // et le tournoi du quartier n'a alors plus sa place sur l'ecran d'accueil
    // d'un produit qui parle d'abord de lui.
    const files = [...parCompetition.values()].sort((a, b) => {
      const enCours = (f: Entry[]) => (f.some((e) => e.match.status === "live") ? 0 : 1);
      const dIci = (f: Entry[]) => (isWorldComp(f[0].competition.id) ? 1 : 0);
      return enCours(a) - enCours(b)
        || dIci(a) - dIci(b)
        || kickoff(a[0]).localeCompare(kickoff(b[0]));
    });

    const affiches: Entry[] = [];
    for (let tour = 0; affiches.length < AFFICHES_MAX; tour++) {
      const avant = affiches.length;
      for (const file of files) {
        if (tour < file.length) affiches.push(file[tour]);
        if (affiches.length >= AFFICHES_MAX) break;
      }
      if (affiches.length === avant) break;
    }
    return affiches;
  }, [scoped, todayKey]);

  // The list is day-driven, except Favoris, a followed match is worth seeing
  // whatever day it falls on, and day-scoping it would show an empty tab.
  const listEntries = useMemo(() => {
    // Favoris = the matches you starred, plus every match of a competition
    // you starred. Starring the tournament is the shortcut; starring a single
    // match stays possible for the one fixture you care about in it.
    // Le jour affiche filtre automatiquement : c'est un tableau de scores,
    // il repond d'abord a « qu'est-ce qui se joue ». Les favoris echappent au
    // filtre, on les suit quelle que soit la date.
    // UN MATCH EN COURS ECHAPPE AU FILTRE DE JOUR, toujours. Il se joue
    // maintenant, quelle que soit la date que porte sa fiche — et les deux se
    // separent plus souvent qu'on ne croit : un amical programme pour samedi
    // que le manager lance mercredi pour essayer la console, un match reporte
    // dont personne n'a corrige la date. Le compteur « En direct » comptait
    // deja ces matchs-la (il lit `scoped`, hors jour), si bien que le tableau
    // annoncait « En direct (1) » au-dessus d'une liste ou il ne figurait pas.
    let list = tab === "favs"
      ? scoped.filter((e) => favs.has(entryKey(e)) || compFavs.has(e.competition.id))
      : scoped.filter((e) => e.match.date === day || e.match.status === "live");
    if (chip === "live") list = list.filter((e) => e.match.status === "live");
    if (chip === "finished") list = list.filter((e) => e.match.status === "completed");
    if (chip === "upcoming") list = list.filter((e) => e.match.status === "scheduled");
    return [...list].sort((a, b) => kickoff(a).localeCompare(kickoff(b)));
  }, [scoped, tab, day, chip, favs, compFavs]);

  // Group by competition, live competitions first, then by earliest kickoff.
  const groups = useMemo(() => {
    const byComp = new Map<string, { competition: Competition; entries: Entry[] }>();
    for (const e of listEntries) {
      const g = byComp.get(e.competition.id) ?? { competition: e.competition, entries: [] };
      g.entries.push(e);
      byComp.set(e.competition.id, g);
    }
    return [...byComp.values()].sort((a, b) => {
      const aLive = a.entries.some((e) => e.match.status === "live") ? 0 : 1;
      const bLive = b.entries.some((e) => e.match.status === "live") ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return kickoff(a.entries[0]).localeCompare(kickoff(b.entries[0]));
    });
  }, [listEntries]);

  // When the chosen day is empty, point at the nearest day that is not, an
  // amateur calendar has holes, and a blank board looks broken. The next
  // fixture day wins over the last one played: the board answers "what is
  // coming" first, and results stay one tap behind.
  const nearestDay = useMemo(() => {
    const dates = [...new Set(scoped.map((e) => e.match.date).filter((d): d is string => d != null))].sort();
    return dates.find((d) => d > day) ?? [...dates].reverse().find((d) => d < day) ?? null;
  }, [scoped, day]);

  // Top performances : les cinq derniers matchs de chaque joueur, toutes
  // competitions LOCALES confondues, le fournisseur externe ne donne pas le
  // detail des buteurs par match, et les amicaux n'ont pas de console de
  // score, donc ni l'un ni l'autre n'a de contribution a apporter ici.
  //
  // « Ses cinq derniers matchs » se lit sur les matchs ou il a marque ou fait
  // marquer : c'est la seule trace qu'on ait de sa presence sur le terrain,
  // faute de feuille de match systematique. Un joueur muet depuis six
  // journees sort donc du classement, ce qui est le comportement voulu.
  const performances = useMemo(() => {
    const local = feed.filter(
      (f) => f.competition.id !== FRIENDLY_COMP_ID && !isWorldComp(f.competition.id),
    );
    const source = compFilter ? local.filter((f) => f.competition.id === compFilter) : local;

    // Par joueur : ses matchs, du plus recent au plus ancien.
    const byPlayer = new Map<string, {
      playerName: string;
      teamId: string;
      competition: Competition;
      games: { date: string; goals: number; assists: number }[];
    }>();

    for (const f of source) {
      for (const match of f.matches) {
        if (!match.date) continue;
        for (const row of computePlayerContributions([match])) {
          const key = `${f.competition.id}::${row.teamId}::${row.playerName.toLowerCase()}`;
          const entry = byPlayer.get(key) ?? {
            playerName: row.playerName,
            teamId: row.teamId,
            competition: f.competition,
            games: [],
          };
          entry.games.push({ date: match.date, goals: row.goals, assists: row.assists });
          byPlayer.set(key, entry);
        }
      }
    }

    const rows: PerformanceRow[] = [...byPlayer.values()].map((p) => {
      const last5 = [...p.games].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
      const goals = last5.reduce((n, g) => n + g.goals, 0);
      const assists = last5.reduce((n, g) => n + g.assists, 0);
      return {
        playerName: p.playerName,
        teamId: p.teamId,
        competition: p.competition,
        goals,
        assists,
        total: goals + assists,
      };
    });

    return {
      rows: rows
        .filter((r) => r.total > 0)
        .sort((a, b) => b.total - a.total || b.goals - a.goals
          || a.playerName.localeCompare(b.playerName))
        .slice(0, 5),
      scope: "last5" as const,
    };
  }, [feed, compFilter]);

  const liveCount = liveEntries.length;

  if (feed.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center border border-gray-200/70 bg-white py-16">
          <Trophy size={32} className="text-gray-300" />
          <h3 className="mt-4 font-display text-lg font-black text-gray-900">
            Aucune compétition en cours
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Les prochaines compétitions apparaîtront ici.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-3">
      {/* Competition switcher, the board's own filter, under the chrome. */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setCompFilter(null)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-black transition-colors ${
              compFilter === null
                ? "bg-emerald-950 text-white"
                : "bg-white text-gray-500 hover:text-gray-900"
            }`}
          >
            <Flame size={13} className={compFilter === null ? "text-amber-300" : "text-gray-300"} />
            Tout le direct
          </button>
          {competitions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCompFilter(c.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-black transition-colors ${
                compFilter === c.id
                  ? "bg-emerald-950 text-white"
                  : "bg-white text-gray-500 hover:text-gray-900"
              }`}
            >
              <CompCrest competition={c} size={16} />
              <span className="max-w-[10rem] truncate">{c.name}</span>
            </button>
          ))}
        </div>
        <Link
          href="/competitions"
          className="hidden shrink-0 items-center gap-1 text-[11px] font-black uppercase tracking-wide text-emerald-500 hover:text-emerald-600 lg:flex"
        >
          Compétitions
          <ChevronRight size={13} />
        </Link>
      </div>

      {/* Three blocks, two shapes: stacked on a phone in reading order
          (affiche → tableau → buteurs), two columns from lg where the board
          runs full height on the left and the rail stacks on the right. */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* ---- The affiche: first thing a phone sees ---- */}
        <div className="order-1 min-w-0 lg:col-start-2 lg:row-start-1">
          <Spotlight
            entries={spotlightEntries}
            teamsById={teamsById}
            picks={picks}
            onPick={choosePick}
          />
        </div>

        {/* ---- The fixture board ---- */}
        <div className="order-2 min-w-0 overflow-hidden border border-gray-200/70 bg-white lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {/* Tabs + day pager */}
          <div className="flex items-center justify-between gap-2 border-b border-gray-200/70 px-3">
            <div className="flex min-w-0 gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {LIST_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`relative shrink-0 py-2.5 text-[13px] font-bold transition-colors ${
                    tab === t.key ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {t.label}
                  {tab === t.key && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))}
            </div>

            {tab !== "comps" && (
              <div className="flex shrink-0 items-center gap-2">
              <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-gray-200/70 p-0.5">
                <button
                  type="button"
                  aria-label="Jour précédent"
                  onClick={() => setDay((d) => addDays(d, -1))}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setDay(todayKey)}
                  className="min-w-[5.5rem] px-1 text-[12px] font-black text-gray-900"
                >
                  {dayLabel(day)}
                </button>
                <button
                  type="button"
                  aria-label="Jour suivant"
                  onClick={() => setDay((d) => addDays(d, 1))}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              </div>
            )}
          </div>

          {/* Status chips + spoiler switch */}
          {tab !== "comps" && (
            <div className="flex items-center justify-between gap-2 border-b border-gray-200/70 px-3 py-2">
              <div className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setChip((c) => (c === "live" ? null : "live"))}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black transition-colors ${
                    chip === "live"
                      ? "bg-red-50 text-red-500"
                      : "bg-gray-50 text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      liveCount > 0 ? "animate-pulse bg-red-500" : "bg-gray-300"
                    }`}
                  />
                  En direct{liveCount > 0 ? ` (${liveCount})` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setChip((c) => (c === "finished" ? null : "finished"))}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black transition-colors ${
                    chip === "finished"
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Terminés
                </button>
                <button
                  type="button"
                  onClick={() => setChip((c) => (c === "upcoming" ? null : "upcoming"))}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black transition-colors ${
                    chip === "upcoming"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-gray-50 text-gray-500 hover:text-gray-900"
                  }`}
                >
                  À venir
                </button>
              </div>

              {/* The model puts an odds toggle here; the useful equivalent for a
                  score board is watching a replay without being spoiled. */}
              <Switch on={hideScores} onChange={setHideScores} label="Masquer les scores" />
            </div>
          )}

          {/* Body */}
          {tab === "comps" ? (
            <CompetitionsDirectory
              competitions={competitions}
              worldCompetitions={worldCompetitions}
              compFavs={compFavs}
              onStar={toggleCompFav}
            />
          ) : groups.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <CalendarDays size={24} className="mx-auto text-gray-300" />
              <p className="mt-2 text-[13px] font-bold text-gray-500">
                {tab === "favs"
                  ? "Aucun match suivi pour le moment."
                  : `Aucun match ${dayLabel(day).toLowerCase()}.`}
              </p>
              {tab === "favs" ? (
                <p className="mt-1 text-[11px] font-bold text-gray-400">
                  Touche l&apos;étoile d&apos;une compétition ou d&apos;un match
                  pour le retrouver ici.
                </p>
              ) : (
                nearestDay && nearestDay !== day && (
                  <button
                    type="button"
                    onClick={() => setDay(nearestDay)}
                    className="mt-3 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-600 transition-colors hover:bg-emerald-100"
                  >
                    Aller au {dayLabel(nearestDay).toLowerCase()}
                  </button>
                )
              )}
            </div>
          ) : (
            <div>
              {groups.map((g) => (
                <CompetitionGroup
                  key={g.competition.id}
                  competition={g.competition}
                  entries={g.entries}
                  teamsById={teamsById}
                  favs={favs}
                  onStar={toggleFav}
                  hideScores={hideScores}
                />
              ))}
            </div>
          )}
        </div>

        {/* ---- Top performances: under the board on a phone, under the
             affiche on desktop ---- */}
        <div className="order-3 min-w-0 lg:col-start-2 lg:row-start-2">
          <TopPerformancesCard
            rows={performances.rows}
            scope={performances.scope}
            teamsById={teamsById}
          />
        </div>
      </div>
    </div>
  );
}
