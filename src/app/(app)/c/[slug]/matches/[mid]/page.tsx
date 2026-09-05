"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  History, Loader2, SearchX, Users,
  BarChart3, ListOrdered, Swords,
} from "lucide-react";
import toast from "react-hot-toast";
import { lienAbsolu, partagerLien } from "@/lib/partage";
import {
  getCompetitionBySlug, onCompMatch, onCompMatches, onCompTeams,
  computeStandings,
} from "@/lib/competition-firestore";
import MatchHero, { type HeroStatus } from "@/components/match/MatchHero";
import MatchTabs from "@/components/match/MatchTabs";
import MatchLineups from "@/components/match/MatchLineups";
import MatchTimeline from "@/components/match/MatchTimeline";
import MatchStandings, { pouleDuMatch } from "@/components/match/MatchStandings";
import PredictionPoll from "@/components/match/PredictionPoll";
import type { CompMatch, CompMatchRound, CompTeam, CompetitionFormat } from "@/types";
import FollowCompetitionButton from "@/components/competition/FollowCompetitionButton";

// ============================================
// Helpers
// ============================================

// Ported verbatim from the (app)/matches/[id]/live spectator view.
const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

// Knockout round -> French label, for the context line under the status.
const ROUND_LABELS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  final: "Finale",
  third_place: "Petite finale",
};

const PERIODS = [
  { id: 1, label: "1ère Mi-temps" },
  { id: 2, label: "Mi-temps" },
  { id: 3, label: "2ème Mi-temps" },
  { id: 4, label: "Terminé" },
];

// L'ecusson, la date longue et les colonnes de composition vivaient ici. Ils
// sont passes dans MatchHero et MatchLineups, qui les rendent a l'identique
// pour les deux fiches match.

// ============================================
// Component
// ============================================

export default function PublicCompMatchView() {
  const { slug, mid } = useParams() as { slug: string; mid: string };
  const [match, setMatch] = useState<CompMatch | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [compName, setCompName] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<
    "feed" | "lineups" | "stats" | "standings" | "h2h"
  >("feed");
  // Le classement et le face-a-face se calculent sur l'ensemble de la
  // competition, pas sur ce seul match : d'ou ces deux abonnements.
  const [compMatches, setCompMatches] = useState<CompMatch[]>([]);
  const [compTeams, setCompTeams] = useState<CompTeam[]>([]);
  const [compFormat, setCompFormat] = useState<CompetitionFormat | null>(null);
  const [compSlug, setCompSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);

  // Resolve competition by slug, then subscribe to the match doc in real time.
  // Anonymous reads work because Firestore rules allow read on competitions/**.
  useEffect(() => {
    if (!slug || !mid) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const competition = await getCompetitionBySlug(slug);
      if (cancelled) return;
      if (!competition) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCid(competition.id);
      setCompName(competition.name);
      setCompFormat(competition.format);
      setCompSlug(competition.slug ?? slug);
      unsub = onCompMatch(competition.id, mid, (m) => {
        if (cancelled) return;
        if (!m) setNotFound(true);
        setMatch(m);
        setLoading(false);
      });
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [slug, mid]);

  // Classement et face-a-face : deux lectures de la competition entiere, donc
  // branchees seulement une fois l'identifiant resolu.
  useEffect(() => {
    if (!cid) return;
    const stopMatches = onCompMatches(cid, setCompMatches);
    const stopTeams = onCompTeams(cid, setCompTeams);
    return () => { stopMatches(); stopTeams(); };
  }, [cid]);

  // Server-clock timer. Same semantics as the spectator view: while the clock
  // runs we tick every 100ms from timerStartAt + timerOffset; when paused/stopped
  // the displayed value is the frozen timerOffset (derived at render below, so the
  // effect only drives the running interval, no synchronous setState in its body).
  useEffect(() => {
    const ls = match?.liveState;
    if (match?.status !== "live" || !ls || !ls.isTimerRunning || !ls.timerStartAt) return;

    const start = new Date(ls.timerStartAt).getTime();
    const offset = ls.timerOffset || 0;
    const interval = setInterval(() => {
      setDisplayTime(Date.now() - start + offset);
    }, 100);

    return () => clearInterval(interval);
  }, [match?.liveState, match?.status]);

  // Still resolving the slug (no cid yet) or awaiting the first match snapshot.
  if (loading || (cid && !match && !notFound)) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">Connexion au direct...</p>
      </div>
    );
  }

  if (notFound || !match) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center bg-gray-100 text-gray-300">
          <SearchX size={32} />
        </div>
        <div>
          <h1 className="font-display text-xl font-black text-gray-900">Match introuvable</h1>
          <p className="mt-1 text-sm font-bold text-gray-400 italic">
            Ce match n&apos;existe pas ou n&apos;est plus disponible.
          </p>
        </div>
      </div>
    );
  }

  const isLive = match.status === "live";
  // Le « 0 » d'un match a venir est traite par MatchHero, pour les deux fiches
  // a la fois : le correctif n'existait ici que d'un cote.
  // « Terminé » l'emporte sur la période. Un match fini gardait le libellé de
  // la dernière période traversée — « 2ème mi-temps » sur une demi-finale
  // jouée il y a trois jours, qui se lisait comme un match en cours.
  const periodLabel =
    match.status === "completed"
      ? "Terminé"
      : PERIODS.find((p) => p.id === match.liveState?.currentPeriod)?.label || "À venir";
  // Competition name plus the round (or poule) this match belongs to.
  const roundLabel = match.round
    ? ROUND_LABELS[match.round]
    : match.group
      ? `Poule ${match.group}`
      : null;
  // Il n'y a plus de bloc « infos du match » sur cette page : la competition,
  // la journee, le lieu, la date et l'heure sont dans le tableau d'affichage,
  // une seule fois. Et la plateforme ne rattache ni arbitre ni format a une
  // rencontre de competition, donc il ne resterait rien a mettre dessous.

  /**
   * Partager le match.
   *
   * C'est le lien qui circule avant une rencontre, et il n'y avait aucun
   * bouton pour l'obtenir : il fallait aller chercher l'adresse dans la
   * barre du navigateur, geste que personne ne fait sur un téléphone.
   *
   * Le texte suit l'état : rendez-vous avant, score pendant et après.
   */
  const partagerLeMatch = async () => {
    const affiche = `${match.homeTeamName} — ${match.awayTeamName}`;
    const score = `${match.scoreHome ?? 0}-${match.scoreAway ?? 0}`;
    const quand = [match.date, match.time].filter(Boolean).join(" à ");
    const texte =
      match.status === "live"
        ? `${affiche}, ${score} en direct${compName ? ` — ${compName}` : ""}`
        : match.status === "completed"
          ? `${affiche}, score final ${score}${compName ? ` — ${compName}` : ""}`
          : `${affiche}${quand ? `, le ${quand}` : ""}${compName ? ` — ${compName}` : ""}`;

    const resultat = await partagerLien({
      title: affiche,
      text: texte,
      url: lienAbsolu(`/c/${compSlug}/matches/${match.id}`),
    });
    if (resultat === "copie") toast.success("Lien du match copié !");
    else if (resultat === "echec") toast.error("Le partage a échoué.");
  };
  // While the clock runs, show the ticking value; otherwise the frozen offset.
  const shownTime =
    match.liveState?.isTimerRunning && match.liveState.timerStartAt
      ? displayTime
      : match.liveState?.timerOffset || 0;

  return (
    <div className="pb-20">
      {/* Le tableau d'affichage. Il porte le fil d'ariane, le contexte, le
          lieu, la date et le pronostic : tout ce qui décrit la rencontre
          elle-même, et il est le seul à le porter. Voir MatchHero. */}
      <MatchHero
        fil={[
          { label: "Direct", href: "/" },
          ...(compSlug && compName ? [{ label: compName, href: `/c/${compSlug}` }] : []),
          { label: `${match.homeTeamName}, ${match.awayTeamName}` },
        ]}
        onShare={partagerLeMatch}
        // La cloche suit la COMPÉTITION, qui est ce que le produit sait
        // notifier : coup d'envoi, buts, fin. Un suivi par match demanderait
        // un champ et un circuit de plus pour la même alerte.
        suivre={cid ? <FollowCompetitionButton cid={cid} variant="icon" /> : undefined}
        context={{
          label: compName || "Compétition",
          href: compSlug ? `/c/${compSlug}` : null,
          sub: roundLabel,
        }}
        status={match.status as HeroStatus}
        home={{
          name: match.homeTeamName, logo: match.homeTeamLogo, score: match.scoreHome,
          href: compSlug && match.homeTeamId ? `/c/${compSlug}/teams/${match.homeTeamId}` : null,
        }}
        away={{
          name: match.awayTeamName, logo: match.awayTeamLogo, score: match.scoreAway,
          href: compSlug && match.awayTeamId ? `/c/${compSlug}/teams/${match.awayTeamId}` : null,
        }}
        date={match.date}
        time={match.time}
        venueName={match.venueName}
        venueCity={match.venueCity}
        periodLabel={periodLabel}
        clock={isLive ? formatTime(shownTime) : null}
        penaltyHome={match.penaltyHome}
        penaltyAway={match.penaltyAway}
        poll={
          <PredictionPoll
            matchId={mid}
            home={{ label: match.homeTeamName, logo: match.homeTeamLogo }}
            away={{ label: match.awayTeamName, logo: match.awayTeamLogo }}
            // Le pronostic ferme des que le match n'est plus a venir.
            closed={match.status !== "scheduled"}
          />
        }
      />

      {/* Une colonne unique et centrée. Le rail de droite portait les infos du
          match, qui vivent maintenant dans le hero : garder la gouttière de
          320px aurait été garder une colonne pour rien. */}
      <div className="mx-auto max-w-4xl space-y-4">

      {/* Tabs: match feed / lineups */}
      {(() => {
        const events = match.liveState?.events ?? [];
        const hasStats = events.length > 0;
        // Goals come from the scoreboard, not the timeline: an own goal is
        // recorded against the team that conceded it, so counting goal events
        // per team would credit the wrong side.
        const countBy = (type: string, teamId: string | null) =>
          events.filter((e) => e.type === type && e.teamId === teamId).length;
        const statRows = [
          { label: "Buts", home: match.scoreHome ?? 0, away: match.scoreAway ?? 0 },
          { label: "Cartons jaunes", home: countBy("yellow_card", match.homeTeamId), away: countBy("yellow_card", match.awayTeamId) },
          { label: "Cartons rouges", home: countBy("red_card", match.homeTeamId), away: countBy("red_card", match.awayTeamId) },
          { label: "Changements", home: countBy("substitution", match.homeTeamId), away: countBy("substitution", match.awayTeamId) },
        ];
        // Classement : la SEULE poule des deux equipes qui jouent. L'onglet
        // deroulait toutes les poules de la competition, l'une sous l'autre.
        // Et rien du tout en phase finale : un huitieme ne se joue pas au
        // nombre de points, et la poule qui y a mene n'explique plus rien.
        const enPhaseFinale = match.stage !== "group";
        const standings = compFormat && !enPhaseFinale
          ? computeStandings(compMatches, compTeams, compFormat)
          : [];
        const poule = pouleDuMatch(standings, match.homeTeamId, match.awayTeamId);
        const hasStandings = Boolean(poule && poule.rows.length > 0);

        // Face-a-face : les rencontres terminees entre ces deux equipes dans
        // cette competition, celle-ci exclue. On ne remonte pas plus loin,
        // rien ne relie deux equipes d'une competition a l'autre.
        const h2h = (match.homeTeamId && match.awayTeamId)
          ? compMatches.filter((m) =>
              m.id !== mid
              && m.status === "completed"
              && m.scoreHome !== null && m.scoreAway !== null
              && ((m.homeTeamId === match.homeTeamId && m.awayTeamId === match.awayTeamId)
                || (m.homeTeamId === match.awayTeamId && m.awayTeamId === match.homeTeamId)))
          : [];
        const hasH2H = h2h.length > 0;

        const TABS = [
          { id: "feed" as const, label: "Résumé", Icon: History, on: true },
          // Toujours present, meme sans compo : l'onglet montre alors le
          // terrain et dit « Pas de compo ». Le faire disparaitre laissait
          // croire que la fonction n'existe pas.
          { id: "lineups" as const, label: "Composition", Icon: Users, on: true },
          { id: "stats" as const, label: "Stats", Icon: BarChart3, on: hasStats },
          { id: "standings" as const, label: "Classement", Icon: ListOrdered, on: hasStandings },
          { id: "h2h" as const, label: "H2H", Icon: Swords, on: hasH2H },
        ].filter((t) => t.on);

        // Un onglet dont la donnee a disparu (compo retiree, classement vide)
        // ne doit pas laisser la page sur un panneau muet.
        const activeTab = TABS.some((t) => t.id === detailTab) ? detailTab : "feed";
        return (
          <>
          {/* Barre d'onglets. Pilotee par TABS : un onglet sans donnee derriere
              ne s'affiche pas du tout, plutot que de s'ouvrir sur un panneau
              vide. Elle est SORTIE de la carte pour pouvoir s'epingler sous le
              header : sur une timeline longue, la navigation disparaissait des
              le premier ecran de defilement. */}
          <MatchTabs
            tabs={TABS.map((t) => ({ id: t.id, label: t.label, Icon: t.Icon }))}
            active={activeTab}
            onChange={(id) => setDetailTab(id as typeof detailTab)}
          />

          <div className=" border border-gray-200/70 bg-white p-4 sm:p-5">
            {/* Stats panel: one row per metric, the two teams facing each
                other, with a bar showing each side's share. */}
            {activeTab === "stats" && hasStats && (
              <div className="space-y-5">
                {statRows.map((row) => {
                  const total = row.home + row.away;
                  const homePct = total === 0 ? 50 : (row.home / total) * 100;
                  return (
                    <div key={row.label}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="w-8 text-left text-base font-black tabular-nums text-gray-900">
                          {row.home}
                        </span>
                        <span className="truncate text-[11px] font-black uppercase tracking-wide text-gray-400">
                          {row.label}
                        </span>
                        <span className="w-8 text-right text-base font-black tabular-nums text-gray-900">
                          {row.away}
                        </span>
                      </div>
                      <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="bg-emerald-500 transition-all"
                          style={{ width: `${homePct}%` }}
                        />
                        <div
                          className="bg-gray-300 transition-all"
                          style={{ width: `${100 - homePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between gap-3 pt-1 text-[10px] font-black uppercase tracking-wide">
                  <span className="flex min-w-0 items-center gap-1.5 text-gray-500">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span className="truncate">{match.homeTeamName}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-gray-500">
                    <span className="truncate">{match.awayTeamName}</span>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                  </span>
                </div>
              </div>
            )}

            {/* Composition : un terrain, deux boutons de bascule. Deux colonnes
                de noms ne disaient pas qui joue derriere qui — la seule chose
                qu'une composition porte. Voir MatchLineups. */}
            {activeTab === "lineups" && (
              <MatchLineups
                home={{ name: match.homeTeamName, entries: match.homeLineup }}
                away={{ name: match.awayTeamName, entries: match.awayLineup }}
              />
            )}

            {/* Classement : la poule des deux equipes, elles seules mises en
                evidence. Voir MatchStandings. */}
            {activeTab === "standings" && poule && (
              <MatchStandings
                groupe={poule}
                homeTeamId={match.homeTeamId}
                awayTeamId={match.awayTeamId}
              />
            )}

            {activeTab === "h2h" && (
              <div className="space-y-5">
                {/* Le bilan d'abord, les rencontres ensuite. */}
                {(() => {
                  let hw = 0, d = 0, aw = 0;
                  for (const m of h2h) {
                    const hs = m.scoreHome ?? 0, as = m.scoreAway ?? 0;
                    const homeIsOurHome = m.homeTeamId === match.homeTeamId;
                    const ourHome = homeIsOurHome ? hs : as;
                    const ourAway = homeIsOurHome ? as : hs;
                    if (ourHome > ourAway) hw += 1;
                    else if (ourHome < ourAway) aw += 1;
                    else d += 1;
                  }
                  return (
                    <div className="grid grid-cols-3 gap-px border border-gray-200/70 bg-gray-200/70">
                      {[
                        { label: match.homeTeamName, value: hw },
                        { label: "Nuls", value: d },
                        { label: match.awayTeamName, value: aw },
                      ].map((x) => (
                        <div key={x.label} className="bg-white p-4 text-center">
                          <p className="font-display text-3xl font-black tabular-nums text-gray-900">{x.value}</p>
                          <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">{x.label}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="divide-y divide-gray-200/70 border border-gray-200/70">
                  {h2h.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <span className="min-w-0 flex-1 truncate text-right font-bold text-gray-900">{m.homeTeamName}</span>
                      <span className="shrink-0 font-display text-base font-black tabular-nums text-gray-900">
                        {m.scoreHome} <span className="text-gray-300">–</span> {m.scoreAway}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-bold text-gray-900">{m.awayTeamName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resume : chaque evenement du cote de son acteur, les reperes
                communs au centre. Voir MatchTimeline. */}
            {activeTab === "feed" && (
              <MatchTimeline
                events={match.liveState?.events ?? []}
                homeTeamId={match.homeTeamId}
              />
            )}
          </div>
          </>
          );
        })()}
      </div>
    </div>
  );
}
