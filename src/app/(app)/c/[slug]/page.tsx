"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Loader2, SearchX, Trophy, ClipboardList, Share2 } from "lucide-react";
import toast from "react-hot-toast";
import { lienAbsolu, partagerLien } from "@/lib/partage";
import { format, parseISO } from "date-fns";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { LOCALE_DATE_FNS } from "@/i18n/dates";
import { getCompetitionBySlug, onCompMatches, onCompTeams } from "@/lib/competition-firestore";
import CompetitionRail from "@/components/competition/CompetitionRail";
import CalendarTab from "@/components/competition/tabs/CalendarTab";
import StandingsTab from "@/components/competition/tabs/StandingsTab";
import BracketTab from "@/components/competition/tabs/BracketTab";
import ScorersTab from "@/components/competition/tabs/ScorersTab";
import TeamsTab from "@/components/competition/tabs/TeamsTab";
import { gameTypeLabel, matchDurationLabel, hasGroupStage, hasKnockout } from "@/lib/competition-format";
import RegisterTeamButton from "@/components/competition/RegisterTeamButton";
import MvpDuMatch from "@/components/match/MvpDuMatch";
import FollowCompetitionButton from "@/components/competition/FollowCompetitionButton";
import type { Competition, CompMatch, CompTeam, CompetitionStatus } from "@/types";
import BadgeCategorie from "@/components/genre/BadgeCategorie";
import type { Categorie } from "@/lib/genre";
import Emplacement from "@/components/partenaires/Emplacement";

// ============================================
// Helpers
// ============================================


/**
 * Les onglets de la page.
 *
 * « Accueil » a disparu : il ne montrait qu'un extrait de ce que les autres
 * contiennent en entier, ce qui obligeait a choisir entre lire un resume et
 * lire la chose. Le calendrier ouvre desormais la page.
 *
 * « Équipes » n'apparaît qu'une fois les inscriptions closes : avant, la
 * liste bouge encore, et l'organisateur ne l'a pas arrêtée.
 */
const TAB_IDS = ["calendar", "standings", "bracket", "scorers", "teams"] as const;
type TabId = (typeof TAB_IDS)[number];

// Status → label + accent, reusing the mapping style from the organizer landing.
const T = textes(
  {
    statut: (s: CompetitionStatus) => ({
      draft: "Brouillon", registration: "Inscriptions", group_stage: "Phase de groupes",
      knockout: "Phase finale", completed: "Terminée",
    })[s],
    aPartirDu: (d: string) => `À partir du ${d}`,
    jusquau: (d: string) => `Jusqu'au ${d}`,
    introuvable: "Compétition introuvable",
    introuvableTexte: "Cette compétition n'existe pas ou n'est plus disponible.",
    calendrier: "Calendrier",
    classement: "Classement",
    playOffs: "Play-offs",
    tableau: "Tableau",
    buteurs: "Buteurs",
    equipes: "Équipes",
    partageInscriptions: (nom: string, ville: string | null) =>
      `${nom}${ville ? ` à ${ville}` : ""} : les inscriptions sont ouvertes.`,
    partageSuivre: (nom: string, ville: string | null) =>
      `Suis ${nom}${ville ? ` à ${ville}` : ""} en direct sur KoppaFoot.`,
    lienCopie: "Lien de la compétition copié !",
    partageEchoue: "Le partage a échoué.",
    filDAriane: "Fil d'ariane",
    direct: "Direct",
    partagerCompetition: "Partager la compétition",
    partager: "Partager",
    abonnes: (n: number) => `${n} abonné${n > 1 ? "s" : ""}`,
    /** Une compétition féminine élit sa meilleure joueuse (lib/genre). */
    meilleurJoueur: (categorie: Categorie | null) =>
      categorie === "women" ? "Meilleure joueuse du tournoi" : "Meilleur joueur du tournoi",
    inscriptionsOuvertes: "Inscriptions ouvertes",
    tuDiriges: "Tu diriges une équipe ? Inscris-la à cette compétition.",
    sInscrire: "S'inscrire",
  },
  {
    statut: (s: CompetitionStatus) => ({
      draft: "Draft", registration: "Registration", group_stage: "Group stage",
      knockout: "Knockout stage", completed: "Finished",
    })[s],
    aPartirDu: (d: string) => `From ${d}`,
    jusquau: (d: string) => `Until ${d}`,
    introuvable: "Competition not found",
    introuvableTexte: "This competition doesn't exist or is no longer available.",
    calendrier: "Fixtures",
    classement: "Standings",
    playOffs: "Play-offs",
    tableau: "Bracket",
    buteurs: "Top scorers",
    equipes: "Teams",
    partageInscriptions: (nom: string, ville: string | null) =>
      `${nom}${ville ? ` in ${ville}` : ""}: registration is open.`,
    partageSuivre: (nom: string, ville: string | null) =>
      `Follow ${nom}${ville ? ` in ${ville}` : ""} live on KoppaFoot.`,
    lienCopie: "Competition link copied!",
    partageEchoue: "Sharing failed.",
    filDAriane: "Breadcrumb",
    direct: "Live",
    partagerCompetition: "Share the competition",
    partager: "Share",
    abonnes: (n: number) => `${n} follower${n === 1 ? "" : "s"}`,
    meilleurJoueur: () => "Player of the tournament",
    inscriptionsOuvertes: "Registration open",
    tuDiriges: "Running a team? Register it for this competition.",
    sInscrire: "Register",
  },
);

// Human date range for the hero. Both / start-only / end-only / none.
function formatDateRange(
  start: string | null,
  end: string | null,
  locale: (typeof LOCALE_DATE_FNS)["fr"],
  t: (typeof T)["fr"],
): string | null {
  const fmt = (d: string) => {
    try {
      return format(parseISO(d), "d MMMM yyyy", { locale });
    } catch {
      return d;
    }
  };
  // Un tiret de plage : la virgule lisait deux dates sans lien.
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return t.aPartirDu(fmt(start));
  if (end) return t.jusquau(fmt(end));
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
  const { langue } = useLangue();
  const t = useTextes(T);

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
      unsubTeams = onCompTeams(comp.id, (liste) => {
        if (!cancelled) setTeams(liste);
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
        <h1 className="font-display text-xl font-black text-gray-900">{t.introuvable}</h1>
        <p className="text-sm font-bold text-gray-400">
          {t.introuvableTexte}
        </p>
      </div>
    );
  }

  const dateRange = formatDateRange(competition.startDate, competition.endDate, LOCALE_DATE_FNS[langue], t);

  // Memes conditions que l'ancienne barre d'onglets : un classement n'a de
  // sens qu'avec une phase de groupes, un tableau qu'avec une phase finale.
  const type = competition.competitionType ?? null;
  const equipesVisibles = competition.status !== "draft" && competition.status !== "registration";
  const TABS: { id: TabId; label: string }[] = [
    { id: "calendar", label: t.calendrier },
    ...(type === null || hasGroupStage(type) ? [{ id: "standings" as TabId, label: t.classement }] : []),
    ...(type === null || hasKnockout(type)
      ? [{ id: "bracket" as TabId, label: type === "league_playoffs" ? t.playOffs : t.tableau }]
      : []),
    { id: "scorers", label: t.buteurs },
    ...(equipesVisibles ? [{ id: "teams" as TabId, label: t.equipes }] : []),
  ];

  /** Change d'onglet et met l'URL a jour sans recharger ni empiler d'entree. */
  const selectTab = (id: TabId) => {
    setTab(id);
    const url = new URL(window.location.href);
    if (id === "calendar") url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url.toString());
  };

  /**
   * Partager la compétition.
   *
   * Vers la page des scores, et non vers /rejoindre : le supporter qui
   * partage veut faire suivre un tournoi, pas inscrire une équipe. La carte
   * de l'organisateur, elle, continue d'envoyer vers l'inscription, parce
   * que ce qu'il cherche est exactement l'inverse.
   */
  const partagerLaCompetition = async () => {
    const ville = competition.venueCity ?? null;
    const resultat = await partagerLien({
      title: competition.name,
      text:
        competition.status === "registration"
          ? t.partageInscriptions(competition.name, ville)
          : t.partageSuivre(competition.name, ville),
      url: lienAbsolu(`/c/${competition.slug}`),
    });
    if (resultat === "copie") toast.success(t.lienCopie);
    else if (resultat === "echec") toast.error(t.partageEchoue);
  };

  return (
    <div className="mx-auto max-w-6xl pb-24">
      {/* Fil d'ariane. Il dit ou l'on est sans repeter le titre, qui arrive
          en grand juste dessous. */}
      <nav
        aria-label={t.filDAriane}
        className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
      >
        <Link href="/" className="transition-colors hover:text-emerald-700">{t.direct}</Link>
        <span aria-hidden className="text-gray-300">›</span>
        {competition.venueCity && (
          <>
            <span>{competition.venueCity}</span>
            <span aria-hidden className="text-gray-300">›</span>
          </>
        )}
        <span className="truncate text-gray-600">{competition.name}</span>

        {/* LA PAGE LA PLUS PARTAGEABLE DU PRODUIT n'avait pas de bouton
            partager : celui de CompetitionShareCard ne vit que dans l'espace
            organisateur, donc invisible pour les supporters, qui sont
            pourtant ceux qui font circuler un lien de compétition. */}
        <button
          type="button"
          onClick={partagerLaCompetition}
          aria-label={t.partagerCompetition}
          className="ml-auto flex items-center gap-1.5 border border-gray-200/70 bg-white px-3 py-1.5 text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900"
        >
          <Share2 size={13} />
          <span className="hidden sm:inline">{t.partager}</span>
        </button>
      </nav>

      {/* Hero compact et collant sous le header : sur cette page on vient lire
          des resultats, pas admirer une banniere. */}
      <section className="sticky top-[var(--header-h,72px)] z-30 -mx-3 -mt-3 overflow-hidden bg-gray-900 text-white lg:-mx-5 lg:-mt-5">
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
                {t.statut(competition.status)}
                {competition.organizerName && (
                  <span className="text-white/40"> · {competition.organizerName}</span>
                )}
                <BadgeCategorie categorie={competition.category} sombre className="ml-2 align-middle" />
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
                {t.abonnes(followers)}
              </span>
            )}
          </div>

          <div className="mt-4 sm:hidden">
            <FollowCompetitionButton cid={competition.id} />
          </div>
        </div>
      </section>

      {/* Le partenaire de la compétition, sinon celui de KoppaFoot. Jamais sur
          une compétition d'entraînement : elle n'a pas de public. */}
      {!competition.isSandbox && (
        <Emplacement emplacement="competition" cid={competition.id} className="mt-6" />
      )}

      {/* Le meilleur joueur du tournoi, une fois la compétition terminée. Le
          même bandeau que sur une fiche de match, une échelle au-dessus. */}
      {competition.mvpPlayerName && (
        <div className="mt-6">
          <MvpDuMatch
            name={competition.mvpPlayerName}
            teamName={teams.find((t) => t.id === competition.mvpTeamId)?.name ?? null}
            label={t.meilleurJoueur(competition.category ?? null)}
          />
        </div>
      )}

      {/* Inscriptions ouvertes : un manager s&apos;inscrit d&apos;ici plutot que
          d&apos;etre envoye sur un autre ecran. Rien ne rend sans club. */}
      {competition.status === "registration" && (
        <div className="mt-6 flex items-center gap-4 border border-emerald-200 bg-emerald-50/60 px-5 py-4">
          <ClipboardList size={26} strokeWidth={1.3} className="shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-black tracking-tight text-emerald-900">
              {t.inscriptionsOuvertes}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-emerald-800">
              {t.tuDiriges}
            </p>
          </div>
          <RegisterTeamButton competition={competition} label={t.sInscrire} />
        </div>
      )}

      {/* La grande carte et, a cote, les performances. Le rail ne rend rien
          tant qu'aucun but n'a ete marque : une carte blanche vide n'est pas
          une colonne, c'est un trou. */}
      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-6">
        <div className="min-w-0 border border-gray-200/70 bg-white">
        <div className="flex gap-7 overflow-x-auto border-b border-gray-200/70 px-5">
          {TABS.map((o) => (
            <button
              key={o.id}
              onClick={() => selectTab(o.id)}
              className={`shrink-0 whitespace-nowrap border-b-2 py-4 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                tab === o.id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "calendar" && <CalendarTab competition={competition} matches={matches} />}
          {tab === "standings" && <StandingsTab competition={competition} matches={matches} teams={teams} />}
          {tab === "bracket" && <BracketTab competition={competition} matches={matches} />}
            {tab === "scorers" && <ScorersTab competition={competition} matches={matches} teams={teams} />}
            {tab === "teams" && equipesVisibles && <TeamsTab competition={competition} matches={matches} teams={teams} />}
          </div>
        </div>

        <CompetitionRail matches={matches} teams={teams} />
      </div>
    </div>
  );
}
