"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Loader2, SearchX, Trophy, ClipboardList } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { getCompetitionBySlug, onCompMatches, onCompTeams } from "@/lib/competition-firestore";
import CompetitionRail from "@/components/competition/CompetitionRail";
import CalendarTab from "@/components/competition/tabs/CalendarTab";
import StandingsTab from "@/components/competition/tabs/StandingsTab";
import BracketTab from "@/components/competition/tabs/BracketTab";
import ScorersTab from "@/components/competition/tabs/ScorersTab";
import { gameTypeLabel, matchDurationLabel, hasGroupStage, hasKnockout } from "@/lib/competition-format";
import RegisterTeamButton from "@/components/competition/RegisterTeamButton";
import FollowCompetitionButton from "@/components/competition/FollowCompetitionButton";
import type { Competition, CompMatch, CompTeam, CompetitionStatus } from "@/types";

// ============================================
// Helpers
// ============================================


/**
 * Les onglets de la page.
 *
 * « Accueil » a disparu : il ne montrait qu'un extrait de ce que les autres
 * contiennent en entier, ce qui obligeait a choisir entre lire un resume et
 * lire la chose. Le calendrier ouvre desormais la page.
 */
const TAB_IDS = ["calendar", "standings", "bracket", "scorers"] as const;
type TabId = (typeof TAB_IDS)[number];

// Status → label + accent, reusing the mapping style from the organizer landing.
const STATUS_CONFIG: Record<CompetitionStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Brouillon", color: "text-gray-600", bg: "bg-gray-100" },
  registration: { label: "Inscriptions", color: "text-blue-700", bg: "bg-blue-50" },
  group_stage: { label: "Phase de groupes", color: "text-amber-700", bg: "bg-amber-50" },
  knockout: { label: "Phase finale", color: "text-purple-700", bg: "bg-purple-50" },
  completed: { label: "Terminée", color: "text-emerald-700", bg: "bg-emerald-50" },
};


// Format a single ISO date, e.g. "18 juil." (fr). Falls back to the raw string.

// Human date range for the hero. Both / start-only / end-only / none.
function formatDateRange(start: string | null, end: string | null): string | null {
  const fmt = (d: string) => {
    try {
      return format(parseISO(d), "d MMMM yyyy", { locale: fr });
    } catch {
      return d;
    }
  };
  if (start && end) return `${fmt(start)}, ${fmt(end)}`;
  if (start) return `À partir du ${fmt(start)}`;
  if (end) return `Jusqu'au ${fmt(end)}`;
  return null;
}

// Team crest: real logo when present, otherwise a first-letter avatar. Mirrors
// the crest treatment used across the public competition pages.
// ============================================
// Component
// ============================================

export default function PublicCompetitionHome() {
  const { slug } = useParams() as { slug: string };
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState<number | null>(null);
  const [teams, setTeams] = useState<CompTeam[]>([]);
  // L'onglet vit dans l'URL (?tab=) sans etre une route : le lien reste
  // partageable, mais tout est servi par la meme page. Lu sur window comme
  // ailleurs dans le projet, pour ne pas poser de frontiere Suspense.
  const [tab, setTab] = useState<TabId>("calendar");
  const [notFound, setNotFound] = useState(false);

  // Resolve competition by slug, then subscribe to matches in real time.
  // Anonymous reads work because Firestore rules allow read on competitions/**.
  useEffect(() => {
    if (!slug) return;
    let unsubMatches: (() => void) | undefined;
    let unsubTeams: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const comp = await getCompetitionBySlug(slug);
      if (cancelled) return;
      if (!comp) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCompetition(comp);
      setLoading(false);

      // Onglet demande dans l'URL. Lu ici, dans le meme passage asynchrone
      // que la competition, plutot que dans un effet a part : un setState
      // synchrone au montage relance un rendu pour rien.
      const wanted = new URLSearchParams(window.location.search).get("tab");
      if (wanted && (TAB_IDS as readonly string[]).includes(wanted)) {
        setTab(wanted as TabId);
      }
      unsubMatches = onCompMatches(comp.id, (m) => {
        if (!cancelled) setMatches(m);
      });
      unsubTeams = onCompTeams(comp.id, (t) => {
        if (!cancelled) setTeams(t);
      });

      // Le nombre d'abonnes : compte cote serveur, aucune competition ne le
      // stocke. Volontairement apres l'affichage, c'est un ornement du hero,
      // pas une raison de retarder la page.
      fetch(`/api/competitions/${comp.id}/followers`)
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((d) => { if (!cancelled) setFollowers(d.count ?? 0); })
        .catch(() => {});
    })();

    return () => {
      cancelled = true;
      unsubMatches?.();
      unsubTeams?.();
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (notFound || !competition) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <SearchX size={30} className="text-gray-300" />
        <h1 className="font-display text-xl font-black text-gray-900">Compétition introuvable</h1>
        <p className="text-sm font-bold text-gray-400">
          Cette compétition n&apos;existe pas ou n&apos;est plus disponible.
        </p>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[competition.status];
  const dateRange = formatDateRange(competition.startDate, competition.endDate);

  // Memes conditions que l'ancienne barre d'onglets : un classement n'a de
  // sens qu'avec une phase de groupes, un tableau qu'avec une phase finale.
  const type = competition.competitionType ?? null;
  const TABS: { id: TabId; label: string }[] = [
    { id: "calendar", label: "Calendrier" },
    ...(type === null || hasGroupStage(type) ? [{ id: "standings" as TabId, label: "Classement" }] : []),
    ...(type === null || hasKnockout(type)
      ? [{ id: "bracket" as TabId, label: type === "league_playoffs" ? "Play-offs" : "Tableau" }]
      : []),
    { id: "scorers", label: "Buteurs" },
  ];

  /** Change d'onglet et met l'URL a jour sans recharger ni empiler d'entree. */
  const selectTab = (id: TabId) => {
    setTab(id);
    const url = new URL(window.location.href);
    if (id === "calendar") url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="mx-auto max-w-6xl pb-24">
      {/* Fil d'ariane. Il dit ou l'on est sans repeter le titre, qui arrive
          en grand juste dessous. */}
      <nav
        aria-label="Fil d'ariane"
        className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
      >
        <Link href="/" className="transition-colors hover:text-emerald-700">Direct</Link>
        <span aria-hidden className="text-gray-300">›</span>
        {competition.venueCity && (
          <>
            <span>{competition.venueCity}</span>
            <span aria-hidden className="text-gray-300">›</span>
          </>
        )}
        <span className="truncate text-gray-600">{competition.name}</span>
      </nav>

      {/* Hero compact et collant sous le header : sur cette page on vient lire
          des resultats, pas admirer une banniere. */}
      <section className="sticky top-[var(--header-h,72px)] z-30 -mx-3 overflow-hidden bg-gray-900 text-white lg:-mx-5">
        {competition.bannerUrl ? (
          <>
            <Image
              src={competition.bannerUrl}
              alt=""
              width={1600}
              height={400}
              priority
              className="absolute inset-0 h-full w-full object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/85 to-gray-900/60" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
        )}

        <div className="relative mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-white/15 bg-white/5">
              {competition.logoUrl ? (
                <Image
                  src={competition.logoUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Trophy size={26} strokeWidth={1.2} className="text-emerald-400" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                {statusCfg.label}
                {competition.organizerName && (
                  <span className="text-white/40"> · {competition.organizerName}</span>
                )}
              </p>
              <h1 className="mt-1 truncate font-display text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
                {competition.name}
              </h1>
            </div>

            <div className="hidden shrink-0 sm:block">
              <FollowCompetitionButton cid={competition.id} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-black uppercase tracking-[0.15em] text-white/55">
            {dateRange && <span>{dateRange}</span>}
            {competition.venueCity && <span>{competition.venueCity}</span>}
            <span>{gameTypeLabel(competition.format)}</span>
            <span>{matchDurationLabel(competition.format)}</span>
            {followers !== null && followers > 0 && (
              <span className="text-emerald-300">
                {followers} abonné{followers > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="mt-4 sm:hidden">
            <FollowCompetitionButton cid={competition.id} />
          </div>
        </div>
      </section>

      {/* Inscriptions ouvertes : un manager s&apos;inscrit d&apos;ici plutot que
          d&apos;etre envoye sur un autre ecran. Rien ne rend sans club. */}
      {competition.status === "registration" && (
        <div className="mt-6 flex items-center gap-4 border border-emerald-200 bg-emerald-50/60 px-5 py-4">
          <ClipboardList size={26} strokeWidth={1.3} className="shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-black tracking-tight text-emerald-900">
              Inscriptions ouvertes
            </p>
            <p className="mt-0.5 text-xs font-semibold text-emerald-800">
              Tu diriges une équipe ? Inscris-la à cette compétition.
            </p>
          </div>
          <RegisterTeamButton competition={competition} label="S'inscrire" />
        </div>
      )}

      {/* La grande carte et, a cote, les performances. Le rail ne rend rien
          tant qu'aucun but n'a ete marque : une carte blanche vide n'est pas
          une colonne, c'est un trou. */}
      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-6">
        <div className="min-w-0 border border-gray-200/70 bg-white">
        <div className="flex gap-7 overflow-x-auto border-b border-gray-200/70 px-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              className={`shrink-0 whitespace-nowrap border-b-2 py-4 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                tab === t.id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "calendar" && <CalendarTab competition={competition} matches={matches} />}
          {tab === "standings" && <StandingsTab competition={competition} matches={matches} teams={teams} />}
          {tab === "bracket" && <BracketTab competition={competition} matches={matches} />}
            {tab === "scorers" && <ScorersTab competition={competition} matches={matches} teams={teams} />}
          </div>
        </div>

        <CompetitionRail matches={matches} teams={teams} />
      </div>
    </div>
  );
}
