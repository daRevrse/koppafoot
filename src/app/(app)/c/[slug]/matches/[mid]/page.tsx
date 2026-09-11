"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Loader2, SearchX } from "lucide-react";
import toast from "react-hot-toast";
import { lienAbsolu, partagerLien } from "@/lib/partage";
import {
  getCompetitionBySlug, onCompMatch, onCompMatches, onCompTeams,
  computeStandings,
} from "@/lib/competition-firestore";
import { derniersResultats } from "@/lib/forme";
import { repartirCent } from "@/lib/repartition";
import MatchHero, { type HeroStatus } from "@/components/match/MatchHero";
import MatchTabs from "@/components/match/MatchTabs";
import MatchLineups from "@/components/match/MatchLineups";
import MatchTimeline from "@/components/match/MatchTimeline";
import MatchStandings, { pouleDuMatch } from "@/components/match/MatchStandings";
import MatchForme from "@/components/match/MatchForme";
import MatchInfoList from "@/components/match/MatchInfoList";
import BarreRepartition from "@/components/match/BarreRepartition";
import MiniEcusson from "@/components/match/MiniEcusson";
import PredictionPoll from "@/components/match/PredictionPoll";
import type { CompMatch, CompMatchRound, CompTeam, CompetitionFormat } from "@/types";

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

type Onglet = "feed" | "infos" | "lineups" | "stats" | "standings" | "h2h";

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
  const [compLogo, setCompLogo] = useState<string | null>(null);
  /**
   * L'onglet CHOISI, `null` tant qu'on n'a touché à rien. L'onglet affiché
   * en découle : voir `ongletParDefaut`.
   */
  const [choixOnglet, setChoixOnglet] = useState<Onglet | null>(null);
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
      setCompLogo(competition.logoUrl);
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

  /**
   * L'IMAGE DU MATCH, TÉLÉCHARGÉE D'AVANCE.
   *
   * `navigator.share` exige une activation utilisateur fraîche : aller
   * chercher l'image au moment du clic la consomme, et le partage est refusé
   * sans rien dire (voir lib/partage). On la prépare donc dès que l'adresse
   * du match est connue, et le bouton n'a plus qu'à la tendre.
   *
   * C'est la bannière quand l'organisateur en a posé une, l'affiche dessinée
   * sinon — la route tranche, la page n'a pas à savoir laquelle elle tient.
   *
   * Un `ref` et non un état : sa présence ne change rien à l'écran.
   */
  const afficheDuMatch = useRef<File | null>(null);

  // Préparée pendant qu'on lit la fiche, et silencieuse en cas d'échec : le
  // partage retombe alors sur le lien seul, ce qu'il a toujours fait ici. Une
  // image manquante ne doit pas coûter le partage.
  useEffect(() => {
    if (!slug || !mid) return;
    let vivant = true;
    afficheDuMatch.current = null;
    (async () => {
      try {
        const reponse = await fetch(`/api/c/${slug}/matches/${mid}/affiche`);
        if (!reponse.ok) return;
        const image = await reponse.blob();
        if (!vivant) return;
        const ext = image.type === "image/png" ? "png" : (image.type.split("/")[1] || "png");
        afficheDuMatch.current = new File([image], `koppafoot-${mid}.${ext}`, { type: image.type });
      } catch {
        // Hors ligne, ou route indisponible : on partagera le lien seul.
      }
    })();
    return () => { vivant = false; };
  }, [slug, mid]);

  // Classement, face-a-face et forme : trois lectures de la competition
  // entiere, donc branchees seulement une fois l'identifiant resolu.
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
      // Préparée au chargement, voir plus haut : la chercher ici coûterait
      // l'activation utilisateur, donc le partage lui-même.
      fichier: afficheDuMatch.current,
    });
    if (resultat === "copie") toast.success("Lien du match copié !");
    else if (resultat === "echec") toast.error("Le partage a échoué.");
  };
  // While the clock runs, show the ticking value; otherwise the frozen offset.
  const shownTime =
    match.liveState?.isTimerRunning && match.liveState.timerStartAt
      ? displayTime
      : match.liveState?.timerOffset || 0;

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

  // La forme des deux equipes, avant ce match : sous leur nom dans le
  // tableau, et en detail dans l'onglet Infos.
  const formeDom = derniersResultats(compMatches, match.homeTeamId, match);
  const formeExt = derniersResultats(compMatches, match.awayTeamId, match);

  /**
   * FIL DU MATCH ET INFOS REMPLACENT « RÉSUMÉ ».
   *
   * Le résumé était la timeline, et rien d'autre : avant le coup d'envoi il
   * s'ouvrait sur une phrase, « Le match n'a pas encore commencé ». Le fil
   * garde la timeline ; Infos rassemble ce qu'on vient chercher avant — le
   * pronostic, la forme, la compétition.
   *
   * L'ONGLET OUVERT SUIT LE MATCH tant qu'on n'en a choisi aucun : Infos
   * avant le coup d'envoi, le fil dès qu'il y a un fil. Si la page est ouverte
   * au moment du coup d'envoi, elle bascule d'elle-même — sauf si l'on a
   * touché aux onglets, auquel cas on reste où l'on est.
   *
   * « Dès qu'il y a un fil » : un match terminé dont personne n'a tenu la
   * console n'a que son score, et son fil est vide. Il s'ouvre sur Infos.
   *
   * Stats, Classement et H2H restent des onglets, affichés seulement quand
   * ils ont quelque chose à montrer.
   */
  const ongletParDefaut: Onglet = isLive || hasStats ? "feed" : "infos";
  const TABS = [
    { id: "feed" as const, label: "Fil du match", on: true },
    { id: "infos" as const, label: "Infos", on: true },
    // Toujours present, meme sans compo : l'onglet montre alors le terrain
    // et dit « Pas de compo ». Le faire disparaitre laissait croire que la
    // fonction n'existe pas.
    { id: "lineups" as const, label: "Composition", on: true },
    { id: "stats" as const, label: "Stats", on: hasStats },
    { id: "standings" as const, label: "Classement", on: hasStandings },
    { id: "h2h" as const, label: "H2H", on: hasH2H },
  ].filter((t) => t.on);

  // Un onglet dont la donnee a disparu (compo retiree, classement vide) ne
  // doit pas laisser la page sur un panneau muet.
  const activeTab: Onglet =
    choixOnglet && TABS.some((t) => t.id === choixOnglet) ? choixOnglet : ongletParDefaut;

  return (
    <div className="pb-20">
      {/* Le tableau d'affichage. Il porte le contexte, le lieu, la date et la
          forme : tout ce qui décrit la rencontre elle-même, et il est le seul
          à le porter. Voir MatchHero. */}
      <MatchHero
        fil={[
          { label: "Direct", href: "/" },
          ...(compSlug && compName ? [{ label: compName, href: `/c/${compSlug}` }] : []),
          { label: `${match.homeTeamName}, ${match.awayTeamName}` },
        ]}
        onShare={partagerLeMatch}
        // LA CLOCHE SUIT CE MATCH, plus la compétition entière. Suivre la
        // compétition pour une affiche, c'était recevoir ses quarante autres.
        // La compétition se suit depuis l'onglet Infos.
        suivi={{ mid, cid }}
        context={{
          label: compName || "Compétition",
          href: compSlug ? `/c/${compSlug}` : null,
          sub: roundLabel,
        }}
        status={match.status as HeroStatus}
        home={{
          name: match.homeTeamName, logo: match.homeTeamLogo, score: match.scoreHome,
          href: compSlug && match.homeTeamId ? `/c/${compSlug}/teams/${match.homeTeamId}` : null,
          forme: formeDom.map((r) => r.resultat),
        }}
        away={{
          name: match.awayTeamName, logo: match.awayTeamLogo, score: match.scoreAway,
          href: compSlug && match.awayTeamId ? `/c/${compSlug}/teams/${match.awayTeamId}` : null,
          forme: formeExt.map((r) => r.resultat),
        }}
        date={match.date}
        time={match.time}
        venueName={match.venueName}
        venueCity={match.venueCity}
        periodLabel={periodLabel}
        clock={isLive ? formatTime(shownTime) : null}
        penaltyHome={match.penaltyHome}
        penaltyAway={match.penaltyAway}
      />

      {/* La barre d'onglets. Pilotee par TABS : un onglet sans donnee derriere
          ne s'affiche pas du tout, plutot que de s'ouvrir sur un panneau vide.
          Elle prolonge le tableau, pleine largeur, et s'epingle sous sa barre
          repliee. */}
      <MatchTabs
        tabs={TABS.map((t) => ({ id: t.id, label: t.label }))}
        active={activeTab}
        onChange={(id) => setChoixOnglet(id as Onglet)}
      />

      {/* Une colonne unique et centrée. */}
      <div className="mx-auto mt-4 max-w-4xl space-y-4">
        {/* Infos : le pronostic d'abord — c'est l'onglet ouvert avant le coup
            d'envoi, il reste donc la première chose sous le tableau — puis la
            forme des deux équipes, puis la compétition et de quoi la suivre. */}
        {activeTab === "infos" && (
          <>
            <PredictionPoll
              matchId={mid}
              home={{ label: match.homeTeamName, logo: match.homeTeamLogo }}
              away={{ label: match.awayTeamName, logo: match.awayTeamLogo }}
              // Le pronostic ferme des que le match n'est plus a venir.
              closed={match.status !== "scheduled"}
            />
            <MatchForme
              home={{ nom: match.homeTeamName, resultats: formeDom }}
              away={{ nom: match.awayTeamName, resultats: formeExt }}
              lien={(id) => `/c/${compSlug}/matches/${id}`}
            />
            {cid && (
              <MatchInfoList
                info={{
                  competition: {
                    id: cid,
                    name: compName || "Compétition",
                    sub: roundLabel,
                    logo: compLogo,
                    href: compSlug ? `/c/${compSlug}` : null,
                  },
                }}
              />
            )}
          </>
        )}

        {activeTab !== "infos" && (
          <div className="bg-white p-4 sm:p-5">
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
                {/* Le bilan d'abord, en une barre dont la largeur est la
                    part de chaque issue — le meme dessin que le pronostic.
                    Les rencontres ensuite. */}
                {(() => {
                  const bilan = { home: 0, draw: 0, away: 0 };
                  for (const m of h2h) {
                    const hs = m.scoreHome ?? 0, as = m.scoreAway ?? 0;
                    const homeIsOurHome = m.homeTeamId === match.homeTeamId;
                    const ourHome = homeIsOurHome ? hs : as;
                    const ourAway = homeIsOurHome ? as : hs;
                    if (ourHome > ourAway) bilan.home += 1;
                    else if (ourHome < ourAway) bilan.away += 1;
                    else bilan.draw += 1;
                  }
                  const parts = repartirCent(bilan);
                  const max = Math.max(bilan.home, bilan.draw, bilan.away);
                  const enTete = (["home", "draw", "away"] as const).filter((k) => bilan[k] === max);
                  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
                  return (
                    <BarreRepartition
                      libelle={`Face-à-face, ${pluriel(h2h.length, "rencontre")}`}
                      enAvant={enTete.length === 1 ? enTete[0] : null}
                      segments={[
                        {
                          cle: "home",
                          pct: parts.home,
                          haut: <><MiniEcusson nom={match.homeTeamName} logo={match.homeTeamLogo} taille={14} />V · {parts.home}%</>,
                          bas: bilan.home,
                          libelle: `${pluriel(bilan.home, "victoire")} de ${match.homeTeamName}`,
                        },
                        {
                          cle: "draw",
                          pct: parts.draw,
                          haut: <>N · {parts.draw}%</>,
                          bas: bilan.draw,
                          libelle: `${bilan.draw} ${bilan.draw > 1 ? "matchs nuls" : "match nul"}`,
                        },
                        {
                          cle: "away",
                          pct: parts.away,
                          haut: <><MiniEcusson nom={match.awayTeamName} logo={match.awayTeamLogo} taille={14} />V · {parts.away}%</>,
                          bas: bilan.away,
                          libelle: `${pluriel(bilan.away, "victoire")} de ${match.awayTeamName}`,
                        },
                      ]}
                    />
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

            {/* Le fil : chaque evenement du cote de son acteur, les reperes
                communs au centre. Voir MatchTimeline. */}
            {activeTab === "feed" && (
              <MatchTimeline
                events={events}
                homeTeamId={match.homeTeamId}
                // Le message par défaut, « Le match n'a pas encore commencé »,
                // s'affichait aussi sous un 3-0 joué la semaine d'avant.
                vide={
                  match.status === "completed"
                    ? "Aucun fait de jeu enregistré sur ce match"
                    : isLive
                      ? "En attente du premier fait de jeu"
                      : "Le fil s'ouvre au coup d'envoi"
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
