"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, SearchX, ChevronRight, Share2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
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
import type { Competition, CompMatch, CompTeam, CompMatchRound } from "@/types";

// ============================================
// Helpers
// ============================================

// Knockout round → French label, for the per-match tag when `round` is set.
const ROUND_LABELS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  final: "Finale",
  third_place: "Petite finale",
};

// Small stage tag: "Groupe A" for group matches, the round label for knockout.
function stageTag(match: CompMatch): string | null {
  if (match.group) return `Groupe ${match.group}`;
  if (match.round) return ROUND_LABELS[match.round];
  return null;
}

// French ordinal for a 1-based rank: 1ᵉʳ, 2ᵉ, 3ᵉ, …
function ordinal(rank: number): string {
  return rank === 1 ? "1ᵉʳ" : `${rank}ᵉ`;
}

// Format a single ISO date, e.g. "samedi 18 juil." (fr). Falls back to raw.
function formatShortDate(date: string): string {
  try {
    const label = format(parseISO(date), "EEE d MMM", { locale: fr });
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
      unsubTeams = onCompTeams(comp.id, (t) => {
        if (cancelled) return;
        setTeams(t);
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

  const team = useMemo(() => teams.find((t) => t.id === tid) ?? null, [teams, tid]);

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
        <p className="font-bold text-gray-500 italic">Chargement de l&apos;équipe...</p>
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
          <h1 className="font-display text-xl font-black text-gray-900">Compétition introuvable</h1>
          <p className="mt-1 text-sm font-bold text-gray-400 italic">
            Cette compétition n&apos;existe pas ou n&apos;est plus disponible.
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
          <h1 className="font-display text-xl font-black text-gray-900">Équipe introuvable</h1>
          <p className="mt-1 text-sm font-bold text-gray-400 italic">
            Cette équipe n&apos;existe pas dans cette compétition.
          </p>
          <Link
            href={`/c/${slug}`}
            className="mt-4 inline-block text-xs font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700"
          >
            Retour à la compétition
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
        <p className="font-bold text-gray-500 italic">Chargement de l&apos;équipe...</p>
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
      etape: stageTag(m),
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
    if (resultat === "copie") toast.success("Lien de l'équipe copié !");
    else if (resultat === "echec") toast.error("Le partage a échoué.");
  };

  return (
    <div className="pb-16">
      {/* LE MÊME BANDEAU QUE LA FICHE D'UN CLUB (voir BandeauEquipe). Il
          collait en haut de l'écran et prenait un quart du téléphone ; le fil
          d'ariane, posé au-dessus, finissait caché dessous. La compétition
          se rejoint par son nom, au-dessus de celui de l'équipe. */}
      <BandeauEquipe
        fil={[
          { label: "Direct", href: "/" },
          { label: competition.name, href: `/c/${slug}` },
          { label: team.name },
        ]}
        nom={team.name}
        logo={team.logoUrl}
        couleur={team.color}
        surtitre={
          <Link href={`/c/${slug}`} className="transition-colors hover:text-white">
            {competition.name}
          </Link>
        }
        puces={
          <>
            {team.group && <span>Groupe {team.group}</span>}
            {standing && (
              <span className="text-emerald-300">
                {ordinal(standing.rank)} · {standing.points} pts
              </span>
            )}
            <FormeEnLettres forme={forme} />
            <span>{roster.length} joueur{roster.length > 1 ? "s" : ""}</span>
          </>
        }
        actions={
          <>
            <button type="button" onClick={partager} aria-label="Partager cette équipe" className={BOUTON_BANDEAU}>
              <Share2 size={14} />
            </button>
            {/* LE CLUB DERRIÈRE L'ÉQUIPE. Une inscription revendiquée par un
                club ne menait pas à sa fiche : deux pages sur la même équipe,
                qui s'ignoraient. */}
            {team.claimedByTeamId && (
              <Link href={`/teams/${team.claimedByTeamId}`} className={BOUTON_BANDEAU}>
                Fiche du club
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
                  {prochain.statut === "en_direct" ? "En direct" : "Prochain match"}
                  {prochain.etape ? ` · ${prochain.etape}` : ""}
                  {` · ${prochain.domicile ? "Domicile" : "Extérieur"}`}
                </p>
                <p className="mt-1 flex min-w-0 items-center gap-2 text-base font-black text-gray-900">
                  <MiniEcusson nom={prochain.adversaire.nom} logo={prochain.adversaire.logo} taille={22} className="text-gray-400" />
                  <span className="min-w-0 break-words">{prochain.adversaire.nom}</span>
                </p>
                {prochain.date && (
                  <p className="mt-0.5 text-[11px] font-bold text-gray-500">
                    {formatShortDate(prochain.date)}
                    {prochain.heure ? ` · ${prochain.heure}` : ""}
                    {prochain.lieu ? ` · ${prochain.lieu}` : ""}
                  </p>
                )}
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <p className="border border-gray-200/70 bg-white px-4 py-3.5 text-sm font-bold text-gray-400">
              Aucun match à venir.
            </p>
          )}

          {bilan.joues > 0 && (
            <div className="border border-gray-200/70 bg-white px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">Dans la compétition</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[
                  { v: bilan.joues, l: "Joués", t: "text-gray-900" },
                  { v: bilan.gagnes, l: "Gagnés", t: "text-emerald-700" },
                  { v: bilan.nuls, l: "Nuls", t: "text-gray-900" },
                  { v: bilan.perdus, l: "Perdus", t: "text-red-600" },
                ].map((c) => (
                  <div key={c.l}>
                    <p className={`font-display text-2xl font-black leading-none tabular-nums ${c.t}`}>{c.v}</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">{c.l}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] font-bold tabular-nums text-gray-500">
                Buts {bilan.pour}–{bilan.contre}
              </p>
            </div>
          )}
        </div>

        {/* Une seule carte, dont les onglets changent le contenu. Le titre
            répétait sous l'onglet ce que l'onglet venait de dire. */}
        <div className="min-w-0 border border-gray-200/70 bg-white lg:col-start-1 lg:row-start-1">
          <div role="tablist" aria-label="Sections de l'équipe" className="flex gap-7 overflow-x-auto border-b border-gray-200/70 px-5">
            {([
              { id: "roster" as const, label: "Effectif", n: roster.length },
              { id: "results" as const, label: "Matchs", n: matchsVus.length },
            ]).map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 py-4 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                  tab === t.id
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                {t.label}
                {t.n > 0 && <span className="tabular-nums text-gray-400">{t.n}</span>}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5">
            {tab === "results" && <MatchsDuClub matchs={matchsVus} avecCompetition={false} />}
            {tab === "roster" && (
              roster.length === 0 ? (
                <p className="border border-gray-200/70 bg-white px-5 py-8 text-center text-sm font-bold text-gray-400">
                  Effectif non communiqué.
                </p>
              ) : (
                <RosterClaimList cid={competition.id} teamId={tid} roster={roster} />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
