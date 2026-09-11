"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  BarChart3, Loader2, Trophy, Target, Shirt, Square, ArrowRight, Info,
  Users, Clock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getCompetition, listCompMatches } from "@/lib/competition-firestore";
import { matchDuration } from "@/lib/competition-format";
import { getMatchById, getParticipationsForPlayer } from "@/lib/firestore";
import {
  computePlayerStats, computeAppearances, totalStats, EMPTY_STATS,
  DUREE_MATCH_DEFAUT,
  type PlayerStats, type PlayerAppearance,
} from "@/lib/player-stats";
import type { LinkedCompPlayer, Match } from "@/types";

// ============================================
// Mes statistiques, the player's own record: every competition roster line
// linked to their account, ET SES AMICAUX.
//
// Links are now created automatically: when a manager registers their club
// in a competition (or imports it into an existing team), every member's
// roster line carries their user_id and a row lands on their user doc. So a
// player with a linked line but no minutes yet is the NORMAL case, not an
// edge one, competitions are listed with zeros rather than hidden, because
// seeing the competition is how the player knows the link worked.
//
// LES AMICAUX COMPTAIENT POUR RIEN. Cette page ne lisait que les
// `linkedCompPlayers`, donc un joueur qui venait de faire un amical voyait
// quatre zéros — et rien sur l'écran ne lui disait que seules les
// compétitions y entraient. Un amical n'appartient à aucune compétition et
// n'a donc aucun lien à suivre : sa trace, c'est la participation du joueur,
// qui dit aussi sous quel maillot il jouait. Le reste du calcul est le même,
// les deux formes de match tiennent dans `MatchJoue`.
// ============================================

/** D'où vient une ligne du bilan : une compétition, ou les amicaux d'un club. */
type Source =
  | { genre: "competition"; link: LinkedCompPlayer }
  | { genre: "amical"; teamId: string; teamName: string };

interface Row {
  source: Source;
  stats: PlayerStats;
  appearances: PlayerAppearance[];
}

function StatTile({
  label, value, Icon, accent,
}: {
  label: string; value: number; Icon: typeof Target; accent: string;
}) {
  return (
    <div className=" border border-gray-200/70 bg-white p-4 text-center">
      <Icon size={20} className={`mx-auto ${accent}`} />
      <p className="mt-2 font-display text-2xl font-black text-gray-900">{value}</p>
      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}

function matchDate(date: string | null): string {
  if (!date) return "";
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
      day: "numeric", month: "short",
    });
  } catch {
    return date;
  }
}

export default function StatsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  // Dedoublonnage a la source. Deux liens identiques, meme competition,
  // meme equipe, meme joueur, ne peuvent venir que d'une anomalie de donnees,
  // mais ils compteraient alors ses buts DEUX FOIS dans le total. Une clé
  // React unique aurait masque le doublon sans corriger le chiffre.
  const links = useMemo(() => {
    const vus = new Set<string>();
    return (user?.linkedCompPlayers ?? []).filter((l) => {
      const cle = `${l.competition_id}::${l.team_id}::${l.player_id}`;
      if (vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    let cancelled = false;

    (async () => {
      const out: Row[] = [];

      // 1. Les compétitions. One read per distinct competition; every linked
      // line of that competition is then computed from the same match list.
      const byCompetition = new Map<string, LinkedCompPlayer[]>();
      for (const link of links) {
        const bucket = byCompetition.get(link.competition_id);
        if (bucket) bucket.push(link);
        else byCompetition.set(link.competition_id, [link]);
      }

      for (const [cid, compLinks] of byCompetition) {
        try {
          // La compétition est lue pour son FORMAT : une mi-temps de 25
          // minutes fait un match de 50, et un temps de jeu calculé sur 90
          // serait faux de moitié. Une lecture de plus par compétition, en
          // parallèle du calendrier.
          const [matches, competition] = await Promise.all([
            listCompMatches(cid),
            getCompetition(cid),
          ]);
          const duree = competition ? matchDuration(competition.format) : DUREE_MATCH_DEFAUT;
          for (const link of compLinks) {
            out.push({
              source: { genre: "competition", link },
              stats: computePlayerStats(matches, link.team_id, link.player_id, duree),
              appearances: computeAppearances(matches, link.team_id, link.player_id, duree),
            });
          }
        } catch (err) {
          console.error("Error loading matches for competition", cid, err);
          // A competition that fails to load must not blank the whole page.
          for (const link of compLinks) {
            out.push({
              source: { genre: "competition", link },
              stats: { ...EMPTY_STATS },
              appearances: [],
            });
          }
        }
      }

      // 2. Les amicaux. Aucun lien ne les désigne — ils n'appartiennent à
      // aucune compétition — donc on part des participations du joueur, sa
      // seule trace dans `matches`. Elle porte aussi l'équipe sous laquelle
      // il jouait ce jour-là, que le match, lui, ne dit pas.
      //
      // Confirmées seulement : une invitation refusée ou restée sans réponse
      // n'est pas un match, et la charger reviendrait à lire des documents
      // pour les jeter. Figurer sur la feuille reste exigé ensuite, par
      // `computePlayerStats` — présent au coup d'envoi n'est pas avoir joué.
      //
      // Une lecture par amical, là où une compétition n'en coûte qu'une pour
      // tout son calendrier : les amicaux sont éparpillés dans une collection
      // commune, sans champ par lequel les demander d'un coup. C'est tenable
      // à l'échelle d'une carrière amateur, et un plafond ferait mentir le
      // total — ce qui est précisément ce qu'on corrige ici.
      try {
        const equipeParMatch = new Map<string, string>();
        for (const p of await getParticipationsForPlayer(uid)) {
          if (p.status !== "confirmed") continue;
          if (!equipeParMatch.has(p.matchId)) equipeParMatch.set(p.matchId, p.teamId);
        }

        const amicaux = (
          await Promise.all([...equipeParMatch.keys()].map((id) => getMatchById(id)))
        ).filter((m): m is Match => m !== null);

        // Groupés par club, comme les compétitions : un joueur qui a fait des
        // amicaux sous deux maillots a deux lignes, et son bilan reste lisible.
        const parEquipe = new Map<string, Match[]>();
        for (const m of amicaux) {
          const teamId = equipeParMatch.get(m.id);
          if (!teamId) continue;
          const bucket = parEquipe.get(teamId);
          if (bucket) bucket.push(m);
          else parEquipe.set(teamId, [m]);
        }

        for (const [teamId, matchs] of parEquipe) {
          const stats = computePlayerStats(matchs, teamId, uid);
          // Une ligne « amicaux » à zéro n'apprend rien : contrairement à une
          // compétition, il n'y a aucune inscription dont elle prouverait
          // qu'elle a pris.
          if (stats.matchesPlayed === 0) continue;
          const sien = matchs.find((m) => m.homeTeamId === teamId || m.awayTeamId === teamId);
          out.push({
            source: {
              genre: "amical",
              teamId,
              teamName: sien
                ? (sien.homeTeamId === teamId ? sien.homeTeamName : sien.awayTeamName)
                : "Mon équipe",
            },
            stats,
            appearances: computeAppearances(matchs, teamId, uid),
          });
        }
      } catch (err) {
        // Comme pour une compétition : les amicaux qui ne se chargent pas ne
        // doivent pas emporter le reste du bilan.
        console.error("Error loading friendlies", err);
      }

      if (!cancelled) setRows(out);
    })();

    return () => { cancelled = true; };
  }, [user, links]);

  if (!user) return null;

  if (rows === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const total = totalStats(rows.map((r) => r.stats));
  const recent = rows
    .flatMap((r) => r.appearances.map((a) => ({ ...a, source: r.source })))
    .sort((a, b) =>
      `${b.match.date ?? ""}T${b.match.time ?? ""}`.localeCompare(
        `${a.match.date ?? ""}T${a.match.time ?? ""}`,
      ),
    )
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        {/* <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-emerald-50 text-emerald-500">
          <BarChart3 size={26} />
        </div> */}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-black uppercase tracking-tight text-gray-900 sm:text-3xl">Mes statistiques</h1>
          {/* <p className="mt-0.5 text-sm font-bold text-gray-400">
            Ton bilan sur toutes les compétitions KoppaFoot.
          </p> */}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className=" border border-gray-200/70 bg-white p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center bg-gray-100 text-gray-300">
            <Users size={26} />
          </div>
          <p className="mt-4 font-display text-lg font-black text-gray-900">
            Pas encore de match joué
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-relaxed text-gray-500">
            Tes statistiques se remplissent toutes seules, amicaux comme
            compétitions, dès que tu figures sur une feuille de match terminée.
            Rien à faire de ton côté : c&apos;est ton manager qui engage
            l&apos;équipe et compose, et tu y apparais automatiquement.
          </p>
          <p className="mx-auto mt-3 max-w-sm text-xs font-semibold text-gray-400">
            Tu n&apos;es dans aucune équipe ? Le mercato est fait pour ça.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/mercato"
              className="inline-flex items-center gap-2 bg-emerald-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-600"
            >
              Trouver une équipe
            </Link>
            <Link
              href="/competitions"
              className="inline-flex items-center gap-2 border border-gray-200/70 px-5 py-3 text-sm font-black text-gray-600 transition-colors hover:bg-gray-50"
            >
              <Trophy size={15} />
              Voir les compétitions
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Career totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatTile label="Matchs" value={total.matchesPlayed} Icon={Shirt} accent="text-emerald-500" />
            <StatTile label="Titulaire" value={total.starts} Icon={Users} accent="text-emerald-500" />
            <StatTile label="Buts" value={total.goals} Icon={Target} accent="text-emerald-500" />
            <StatTile
              label="Cartons"
              value={total.yellowCards + total.redCards}
              Icon={Square}
              accent={total.redCards > 0 ? "text-red-500" : "text-amber-400"}
            />
            {/* Cinquième tuile : sur deux colonnes en mobile, elle occupe la
                ligne au lieu de laisser un trou à côté d'elle. */}
            <div className="col-span-2 sm:col-span-1">
              <StatTile label="Minutes" value={total.minutesPlayed} Icon={Clock} accent="text-emerald-500" />
            </div>
          </div>

          {/* Per competition */}
          <div className="space-y-3">
            <p className="px-1 text-xs font-black uppercase tracking-widest text-gray-400">
              Par compétition
            </p>
            {rows.map((row, i) => {
              const noMinutes = row.stats.matchesPlayed === 0;
              // Une ligne d'amicaux ne mene nulle part : la fiche d'equipe et
              // le tableau des matchs sont des ecrans de manager, absents de
              // la navigation d'un joueur. Ses rencontres restent accessibles
              // une par une, dans « Mes derniers matchs » juste dessous.
              const vue = row.source.genre === "amical"
                ? {
                  cle: `amicaux-${row.source.teamId}`,
                  titre: "Matchs amicaux",
                  sousTitre: row.source.teamName,
                  href: null,
                }
                : {
                  cle: `${row.source.link.competition_id}-${row.source.link.team_id}-${row.source.link.player_id}`,
                  titre: row.source.link.competition_name,
                  sousTitre: `${row.source.link.team_name} · ${row.source.link.player_name}`,
                  href: `/c/${row.source.link.competition_slug}/teams/${row.source.link.team_id}`,
                };
              const classeCarte = "flex items-center gap-4 border border-gray-200/70 bg-white p-4 transition-all hover:border-gray-200/70";
              const contenu = (
                <>
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center ${row.source.genre === "amical" ? "bg-emerald-50 text-emerald-500" : "bg-amber-50 text-amber-500"}`}>
                      {row.source.genre === "amical" ? <Shirt size={20} /> : <Trophy size={20} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-gray-900">
                        {vue.titre}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-semibold text-gray-400">
                        {vue.sousTitre}
                      </p>
                      {noMinutes ? (
                        // Zeros on purpose: this is what tells the player the
                        // link worked and they are on the squad sheet.
                        <p className="mt-1.5 text-xs font-bold text-gray-400">
                          Inscrit, aucun match joué pour l&apos;instant
                        </p>
                      ) : (
                        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-gray-600">
                          <span>{row.stats.matchesPlayed} match{row.stats.matchesPlayed !== 1 ? "s" : ""}</span>
                          <span>{row.stats.starts} titulaire</span>
                          <span>{row.stats.minutesPlayed}&apos;</span>
                          <span className="text-emerald-600">
                            {row.stats.goals} but{row.stats.goals !== 1 ? "s" : ""}
                          </span>
                          {row.stats.yellowCards > 0 && (
                            <span className="text-amber-600">{row.stats.yellowCards} 🟨</span>
                          )}
                          {row.stats.redCards > 0 && (
                            <span className="text-red-600">{row.stats.redCards} 🟥</span>
                          )}
                        </p>
                      )}
                    </div>
                  {vue.href && <ArrowRight size={16} className="shrink-0 text-gray-300" />}
                </>
              );
              return (
                <motion.div
                  // L'equipe fait partie de la cle : un joueur transfere en
                  // cours de tournoi a DEUX lignes dans la meme competition,
                  // une par club, et le code plus haut les construit
                  // deliberement. Sans `team_id` les deux portaient la meme
                  // cle, et React en omettait une.
                  key={vue.cle}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  {vue.href ? (
                    <Link href={vue.href} className={classeCarte}>{contenu}</Link>
                  ) : (
                    <div className={classeCarte}>{contenu}</div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Match by match, the question a player actually opens with */}
          {recent.length > 0 && (
            <div className="space-y-3">
              <p className="px-1 text-xs font-black uppercase tracking-widest text-gray-400">
                Mes derniers matchs
              </p>
              <div className="divide-y divide-gray-50 overflow-hidden border border-gray-200/70 bg-white">
                {recent.map((a) => {
                  const m = a.match;
                  // Un amical se lit sur sa propre fiche, pas sous une
                  // compétition : il n'en a pas.
                  const monEquipe = a.source.genre === "amical"
                    ? a.source.teamId
                    : a.source.link.team_id;
                  const href = a.source.genre === "amical"
                    ? `/matches/${m.id}`
                    : `/c/${a.source.link.competition_slug}/matches/${m.id}`;
                  const isHome = m.homeTeamId === monEquipe;
                  const opponent = isHome ? m.awayTeamName : m.homeTeamName;
                  const mine = isHome ? m.scoreHome : m.scoreAway;
                  const theirs = isHome ? m.scoreAway : m.scoreHome;
                  const won = (mine ?? 0) > (theirs ?? 0);
                  const drew = (mine ?? 0) === (theirs ?? 0);
                  return (
                    <Link
                      key={`${m.id}-${monEquipe}`}
                      href={href}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50/70"
                    >
                      <span className="w-11 shrink-0 text-[11px] font-bold text-gray-400">
                        {matchDate(m.date)}
                      </span>
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center text-[11px] font-black text-white ${drew ? "bg-gray-400" : won ? "bg-emerald-500" : "bg-red-400"
                          }`}
                      >
                        {drew ? "N" : won ? "V" : "D"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-900">{opponent}</p>
                        <p className="truncate text-[11px] font-semibold text-gray-400">
                          {/* Rôle et minutes peuvent manquer : une journée de
                              compétition rattrapée par l'organisateur n'a pas
                              de feuille de match, donc ni l'un ni l'autre. On
                              n'écrit pas « Entré en jeu » faute de savoir. */}
                          {[
                            `${mine ?? 0}–${theirs ?? 0}`,
                            a.role === "starter" ? "Titulaire"
                              : a.role === "substitute" ? "Entré en jeu" : null,
                            a.minutes > 0 ? `${a.minutes}'` : null,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs font-black">
                        {a.goals > 0 && (
                          <span className="text-emerald-600">{a.goals}&nbsp;⚽</span>
                        )}
                        {a.yellowCards > 0 && <span>🟨</span>}
                        {a.redCards > 0 && <span>🟥</span>}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <p className="flex items-start gap-2 bg-gray-50 p-4 text-xs font-semibold leading-relaxed text-gray-500">
            <Info size={14} className="mt-0.5 shrink-0 text-gray-400" />
            Amicaux et compétitions comptent pareil. Un match compte comme joué
            quand il est terminé et que tu figures sur la feuille de match. Les buts
            et cartons sont ceux saisis en direct par l&apos;organisateur ou ton
            manager. Le temps de jeu se calcule sur les entrées et sorties notées en
            direct : un remplacement enregistré avant que la console retienne le
            sortant ne peut pas être daté précisément. Quand l&apos;organisateur
            rattrape une journée après coup, il n&apos;y a pas de feuille : les
            buteurs qu&apos;il saisit comptent leur match, sans rôle ni minutes. Les
            passes décisives ne sont pas encore enregistrées en console live.
          </p>
        </>
      )}
    </div>
  );
}
