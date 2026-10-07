"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, SearchX, ChevronRight, Share2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { FOOT } from "@/i18n/foot";
import { LOCALE_DATE_FNS } from "@/i18n/dates";
import {
  getCompetitionBySlug,
  onCompMatches,
  onCompTeams,
  computeStandings,
} from "@/lib/competition-firestore";
import RosterClaimList from "@/components/competition/RosterClaimList";
import BandeauEquipe, { BOUTON_BANDEAU, FormeEnLettres } from "@/components/team/BandeauEquipe";
import MatchsDuClub from "@/components/team/MatchsDuClub";
import MiniEcusson from "@/components/match/MiniEcusson";
import { lienAbsolu, partagerLien } from "@/lib/partage";
import {
  rangerLesMatchs, resultatDuMatch, statutPublicCompetition, type MatchDuClub,
} from "@/lib/fiche-club";
import type { Competition, CompMatch, CompTeam } from "@/types";

// ============================================
// Helpers
// ============================================

const T = textes(
  {
    rang: (n: number) => (n === 1 ? "1ᵉʳ" : `${n}ᵉ`),
    points: (n: number) => `${n} pts`,
    chargement: "Chargement de l'équipe...",
    compIntrouvable: "Compétition introuvable",
    compIntrouvableTexte: "Cette compétition n'existe pas ou n'est plus disponible.",
    equipeIntrouvable: "Équipe introuvable",
    equipeIntrouvableTexte: "Cette équipe n'existe pas dans cette compétition.",
    retourCompetition: "Retour à la compétition",
    lienCopie: "Lien de l'équipe copié !",
    partageEchoue: "Le partage a échoué.",
    direct: "Direct",
    /** Une compétition féminine compte des joueuses. */
    joueurs: (n: number, feminin?: boolean) => `${n} ${feminin ? "joueuse" : "joueur"}${n > 1 ? "s" : ""}`,
    partager: "Partager cette équipe",
    ficheDuClub: "Fiche de l'équipe",
    domicile: "Domicile",
    exterieur: "Extérieur",
    aucunAVenir: "Aucun match à venir.",
    dansLaCompetition: "Dans la compétition",
    joues: "Joués",
    gagnes: "Gagnés",
    nuls: "Nuls",
    perdus: "Perdus",
    buts: (pour: number, contre: number) => `Buts ${pour}–${contre}`,
    sections: "Sections de l'équipe",
    effectif: "Effectif",
    matchs: "Matchs",
    effectifNonCommunique: "Effectif non communiqué.",
  },
  {
    rang: (n: number) => {
      const dizaine = n % 100;
      const suffixe = dizaine >= 11 && dizaine <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
      return `${n}${suffixe}`;
    },
    points: (n: number) => `${n} pts`,
    chargement: "Loading the team...",
    compIntrouvable: "Competition not found",
    compIntrouvableTexte: "This competition doesn't exist or is no longer available.",
    equipeIntrouvable: "Team not found",
    equipeIntrouvableTexte: "This team isn't part of this competition.",
    retourCompetition: "Back to the competition",
    lienCopie: "Team link copied!",
    partageEchoue: "Sharing failed.",
    direct: "Live",
    joueurs: (n: number) => `${n} player${n === 1 ? "" : "s"}`,
    partager: "Share this team",
    ficheDuClub: "Team page",
    domicile: "Home",
    exterieur: "Away",
    aucunAVenir: "No upcoming matches.",
    dansLaCompetition: "In the competition",
    joues: "Played",
    gagnes: "Won",
    nuls: "Drawn",
    perdus: "Lost",
    buts: (pour: number, contre: number) => `Goals ${pour}–${contre}`,
    sections: "Team sections",
    effectif: "Squad",
    matchs: "Matches",
    effectifNonCommunique: "Squad not provided.",
  },
);

// Small stage tag: "Groupe A" for group matches, the round label for knockout.
function stageTag(match: CompMatch, f: (typeof FOOT)["fr"]): string | null {
  if (match.group) return f.groupe(match.group);
  if (match.round) return f.tour(match.round);
  return null;
}

// Format a single ISO date, e.g. "samedi 18 juil." (fr). Falls back to raw.
function formatShortDate(date: string, locale: (typeof LOCALE_DATE_FNS)["fr"]): string {
  try {
    const label = format(parseISO(date), "EEE d MMM", { locale });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return date;
  }
}

// ============================================
// Component
// ============================================

export default function PublicTeamPage() {
  // Deux onglets seulement : l'effectif et ce que l'equipe a fait. Le
  // prochain match reste hors carte, au-dessus, c'est la seule chose de
  // cette page qui perime.
  const [tab, setTab] = useState<"roster" | "results">("roster");
  const { langue } = useLangue();
  const t = useTextes(T);
  const f = useTextes(FOOT);

  const { slug, tid } = useParams() as { slug: string; tid: string };
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Only judge "team introuvable" once teams have actually arrived from Firestore.
  const [teamsLoaded, setTeamsLoaded] = useState(false);

  // Resolve competition by slug, then subscribe to teams + matches in real time.
  // Anonymous reads work because Firestore rules allow read on competitions/**.
  useEffect(() => {
    if (!slug) return;
    let unsubTeams: (() => void) | undefined;
    let unsubMatches: (() => void) | undefined;
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
      unsubTeams = onCompTeams(comp.id, (liste) => {
        if (cancelled) return;
        setTeams(liste);
        setTeamsLoaded(true);
      });
      unsubMatches = onCompMatches(comp.id, (m) => {
        if (!cancelled) setMatches(m);
      });
    })();

    return () => {
      cancelled = true;
      unsubTeams?.();
      unsubMatches?.();
    };
  }, [slug]);

  const team = useMemo(() => teams.find((e) => e.id === tid) ?? null, [teams, tid]);

  // The team's group rank + points, derived from the shared standings helper
  // (never recomputed inline). Null until the team is in a group with a table.
  const standing = useMemo(() => {
    if (!competition || !team || team.group == null) return null;
    const groups = computeStandings(matches, teams, competition.format);
    const group = groups.find((g) => g.group === team.group);
    if (!group) return null;
    const idx = group.rows.findIndex((r) => r.team.id === team.id);
    if (idx === -1) return null;
    return { rank: idx + 1, points: group.rows[idx].points };
  }, [competition, team, teams, matches]);

  // Matches involving this team (home or away), with a per-match "perspective"
  // helper: opponent name/logo and a win/loss/draw outcome for completed games.
  const teamMatches = useMemo(() => {
    if (!team) return [];
    return matches
      .filter((m) => m.homeTeamId === team.id || m.awayTeamId === team.id)
      .map((m) => {
        const isHome = m.homeTeamId === team.id;
        const opponentName = isHome ? m.awayTeamName : m.homeTeamName;
        const opponentLogo = isHome ? m.awayTeamLogo : m.homeTeamLogo;
        const teamScore = isHome ? m.scoreHome : m.scoreAway;
        const oppScore = isHome ? m.scoreAway : m.scoreHome;
        let outcome: "win" | "loss" | "draw" | null = null;
        if (m.status === "completed" && teamScore != null && oppScore != null) {
          outcome = teamScore > oppScore ? "win" : teamScore < oppScore ? "loss" : "draw";
        }
        return { match: m, isHome, opponentName, opponentLogo, teamScore, oppScore, outcome };
      });
  }, [matches, team]);

  // Le prochain match et les résultats se rangent désormais comme sur la
  // fiche d'un club : voir `rangerLesMatchs`, plus bas.

  // Roster, sorted numeric-aware by dossard (NaN, blank/non-numeric, last).
  const roster = useMemo(() => {
    const players = team?.players ?? [];
    return [...players].sort((a, b) => {
      const na = parseInt(a.number, 10);
      const nb = parseInt(b.number, 10);
      const aNaN = Number.isNaN(na);
      const bNaN = Number.isNaN(nb);
      if (aNaN && bNaN) return a.name.localeCompare(b.name);
      if (aNaN) return 1;
      if (bNaN) return -1;
      return na - nb;
    });
  }, [team]);

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">{t.chargement}</p>
      </div>
    );
  }

  if (notFound || !competition) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center bg-gray-100 text-gray-300">
          <SearchX size={32} />
        </div>
        <div>
          <h1 className="font-display text-xl font-black text-gray-900">{t.compIntrouvable}</h1>
          <p className="mt-1 text-sm font-bold text-gray-400 italic">
            {t.compIntrouvableTexte}
          </p>
        </div>
      </div>
    );
  }

  // Teams have loaded but none matches the requested id → team not found.
  if (teamsLoaded && !team) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center bg-gray-100 text-gray-300">
          <SearchX size={32} />
        </div>
        <div>
          <h1 className="font-display text-xl font-black text-gray-900">{t.equipeIntrouvable}</h1>
          <p className="mt-1 text-sm font-bold text-gray-400 italic">
            {t.equipeIntrouvableTexte}
          </p>
          <Link
            href={`/c/${slug}`}
            className="mt-4 inline-block text-xs font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700"
          >
            {t.retourCompetition}
          </Link>
        </div>
      </div>
    );
  }

  // Still awaiting the first teams snapshot (competition resolved, team unknown).
  if (!team) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">{t.chargement}</p>
      </div>
    );
  }

  /**
   * LES MATCHS DE L'ÉQUIPE, VUS DE L'ÉQUIPE : la même liste que sur la fiche
   * d'un club (voir MatchsDuClub), sans le nom de la compétition, qui est ici
   * partout.
   */
  const matchsVus: MatchDuClub[] = teamMatches.flatMap(({ match: m, isHome, opponentName, opponentLogo, teamScore, oppScore }) => {
    const statut = statutPublicCompetition(m.status);
    if (!statut) return [];
    return [{
      id: m.id,
      lien: `/c/${slug}/matches/${m.id}`,
      competition: { nom: competition.name, lien: `/c/${slug}` },
      etape: stageTag(m, f),
      date: m.date,
      heure: m.time,
      statut,
      domicile: isHome,
      adversaire: { nom: opponentName, logo: opponentLogo },
      pour: teamScore,
      contre: oppScore,
      lieu: m.venueName,
    }];
  });
  const { aVenir, joues } = rangerLesMatchs(matchsVus);
  const prochain = aVenir[0] ?? null;

  // Le bilan dans CETTE compétition, et sa forme : du plus ancien au plus
  // récent, comme sur le tableau d'un match.
  const termines = joues.filter((m) => resultatDuMatch(m) !== null);
  const bilan = {
    joues: termines.length,
    gagnes: termines.filter((m) => resultatDuMatch(m) === "V").length,
    nuls: termines.filter((m) => resultatDuMatch(m) === "N").length,
    perdus: termines.filter((m) => resultatDuMatch(m) === "D").length,
    pour: termines.reduce((n, m) => n + (m.pour ?? 0), 0),
    contre: termines.reduce((n, m) => n + (m.contre ?? 0), 0),
  };
  const forme = termines.slice(0, 5).map((m) => resultatDuMatch(m) as "V" | "N" | "D").reverse();

  const partager = async () => {
    const resultat = await partagerLien({
      title: team.name,
      text: `${team.name} · ${competition.name}`,
      url: lienAbsolu(`/c/${slug}/teams/${tid}`),
    });
    if (resultat === "copie") toast.success(t.lienCopie);
    else if (resultat === "echec") toast.error(t.partageEchoue);
  };

  return (
    <div className="pb-16">
      {/* LE MÊME BANDEAU QUE LA FICHE D'UN CLUB (voir BandeauEquipe). Il
          collait en haut de l'écran et prenait un quart du téléphone ; le fil
          d'ariane, posé au-dessus, finissait caché dessous. La compétition
          se rejoint par son nom, au-dessus de celui de l'équipe. */}
      <BandeauEquipe
        fil={[
          { label: t.direct, href: "/" },
          { label: competition.name, href: `/c/${slug}` },
          { label: team.name },
        ]}
        nom={team.name}
        logo={team.logoUrl}
        couleur={team.color}
        categorie={competition.category}
        surtitre={
          <Link href={`/c/${slug}`} className="transition-colors hover:text-white">
            {competition.name}
          </Link>
        }
        puces={
          <>
            {team.group && <span>{f.groupe(team.group)}</span>}
            {standing && (
              <span className="text-emerald-300">
                {t.rang(standing.rank)} · {t.points(standing.points)}
              </span>
            )}
            <FormeEnLettres forme={forme} />
            <span>{t.joueurs(roster.length, competition.category === "women")}</span>
          </>
        }
        actions={
          <>
            <button type="button" onClick={partager} aria-label={t.partager} className={BOUTON_BANDEAU}>
              <Share2 size={14} />
            </button>
            {/* LE CLUB DERRIÈRE L'ÉQUIPE. Une inscription revendiquée par un
                club ne menait pas à sa fiche : deux pages sur la même équipe,
                qui s'ignoraient. */}
            {team.claimedByTeamId && (
              <Link href={`/teams/${team.claimedByTeamId}`} className={BOUTON_BANDEAU}>
                {t.ficheDuClub}
              </Link>
            )}
          </>
        }
      />

      <div className="mx-auto mt-4 grid max-w-6xl gap-4 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        {/* À droite sur grand écran, en tête sur téléphone : le prochain
            match — la seule chose de cette page qui périme — et le bilan. */}
        <div className="space-y-4 lg:col-start-2 lg:row-start-1">
          {prochain ? (
            <Link
              href={prochain.lien}
              className="group flex items-center gap-3 border border-gray-200/70 bg-white px-4 py-3.5 transition-colors hover:border-emerald-200"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">
                  {prochain.statut === "en_direct" ? f.enDirect : f.prochainMatch}
                  {prochain.etape ? ` · ${prochain.etape}` : ""}
                  {` · ${prochain.domicile ? t.domicile : t.exterieur}`}
                </p>
                <p className="mt-1 flex min-w-0 items-center gap-2 text-base font-black text-gray-900">
                  <MiniEcusson nom={prochain.adversaire.nom} logo={prochain.adversaire.logo} taille={22} className="text-gray-400" />
                  <span className="min-w-0 break-words">{prochain.adversaire.nom}</span>
                </p>
                {prochain.date && (
                  <p className="mt-0.5 text-[11px] font-bold text-gray-500">
                    {formatShortDate(prochain.date, LOCALE_DATE_FNS[langue])}
                    {prochain.heure ? ` · ${prochain.heure}` : ""}
                    {prochain.lieu ? ` · ${prochain.lieu}` : ""}
                  </p>
                )}
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <p className="border border-gray-200/70 bg-white px-4 py-3.5 text-sm font-bold text-gray-400">
              {t.aucunAVenir}
            </p>
          )}

          {bilan.joues > 0 && (
            <div className="border border-gray-200/70 bg-white px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">{t.dansLaCompetition}</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[
                  { v: bilan.joues, l: t.joues, ton: "text-gray-900" },
                  { v: bilan.gagnes, l: t.gagnes, ton: "text-emerald-700" },
                  { v: bilan.nuls, l: t.nuls, ton: "text-gray-900" },
                  { v: bilan.perdus, l: t.perdus, ton: "text-red-600" },
                ].map((c) => (
                  <div key={c.l}>
                    <p className={`font-display text-2xl font-black leading-none tabular-nums ${c.ton}`}>{c.v}</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">{c.l}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] font-bold tabular-nums text-gray-500">
                {t.buts(bilan.pour, bilan.contre)}
              </p>
            </div>
          )}
        </div>

        {/* Une seule carte, dont les onglets changent le contenu. Le titre
            répétait sous l'onglet ce que l'onglet venait de dire. */}
        <div className="min-w-0 border border-gray-200/70 bg-white lg:col-start-1 lg:row-start-1">
          <div role="tablist" aria-label={t.sections} className="flex gap-7 overflow-x-auto border-b border-gray-200/70 px-5">
            {([
              { id: "roster" as const, label: t.effectif, n: roster.length },
              { id: "results" as const, label: t.matchs, n: matchsVus.length },
            ]).map((o) => (
              <button
                key={o.id}
                role="tab"
                aria-selected={tab === o.id}
                onClick={() => setTab(o.id)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 py-4 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                  tab === o.id
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                {o.label}
                {o.n > 0 && <span className="tabular-nums text-gray-400">{o.n}</span>}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5">
            {tab === "results" && <MatchsDuClub matchs={matchsVus} avecCompetition={false} />}
            {tab === "roster" && (
              roster.length === 0 ? (
                <p className="border border-gray-200/70 bg-white px-5 py-8 text-center text-sm font-bold text-gray-400">
                  {t.effectifNonCommunique}
                </p>
              ) : (
                <RosterClaimList cid={competition.id} teamId={tid} roster={roster} clubId={team.claimedByTeamId} feminin={competition.category === "women"} />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
