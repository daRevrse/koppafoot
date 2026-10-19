// ============================================
// Le joueur de la semaine : qui a joué quoi, du lundi au dimanche, et dans
// quel ordre on les propose à l'administration.
//
// Pur : aucun SDK. Il prend les matchs que le classement de la plateforme lit
// déjà (lib/classement-admin), il rend des candidats. Voir la conception :
// docs/superpowers/specs/2026-10-19-joueur-de-la-semaine-design.md.
//
// LES MÊMES RÈGLES QUE LE CLASSEMENT, MATCH PAR MATCH. La feuille décide quand
// le camp en a une ; un camp de compétition sans feuille est représenté par
// les joueurs que ses événements nomment ; un amical renseigné après coup, par
// ses buteurs déclarés. Les dossards et les « Joueur 9 » ne sont jamais
// candidats.
//
// UN GARDE-FOU SUR L'IDENTITÉ. Le classement fusionne deux homonymes sans
// compte, ce qui passe dans une liste de cent ; une affiche qui réunirait deux
// « Kossi » de deux clubs inventerait un joueur. Sans compte, la clé est donc
// le nom ET l'équipe.
//
// UN DOUBLÉ L'EMPORTE SUR UNE NOTE : les buts d'abord, puis les passes, puis
// la note, puis les titres d'homme du match.
// ============================================

import {
  nommesSansFeuille, type LigneDuCamp, type LigneSansCompte, type MatchAClasser,
} from "@/lib/classement";
import { estLigneDossard } from "@/lib/dossards";
import { estLigneHorsPlateforme } from "@/lib/effectif-match";
import { OWN_GOAL_DETAIL } from "@/lib/evenements";
import { notesDuCamp } from "@/lib/notes";
import { DUREE_MATCH_DEFAUT } from "@/lib/player-stats";

/** L'identifiant sous lequel les amicaux passent au calcul (voir lib/classement-admin). */
export const AMICAUX = "friendly";

export interface Semaine {
  /** « 2026-10-12 », un lundi. */
  lundi: string;
  /** « 2026-10-18 », le dimanche suivant. */
  dimanche: string;
  /** Le numéro de semaine ISO. */
  numero: number;
}

const JOUR_MS = 86_400_000;
const enDate = (jour: string) => new Date(`${jour}T12:00:00Z`);
const enJour = (d: Date) => d.toISOString().slice(0, 10);

/** La semaine, du lundi au dimanche, qui contient `jour`. Lomé vit à l'heure UTC. */
export function semaineDu(jour: string): Semaine {
  const d = enDate(jour);
  const lundi = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * JOUR_MS);
  // Le numéro ISO : celui de l'année qui contient le jeudi de la semaine.
  const jeudi = new Date(lundi.getTime() + 3 * JOUR_MS);
  const premierJanvier = Date.UTC(jeudi.getUTCFullYear(), 0, 1, 12);
  const numero = 1 + Math.floor((jeudi.getTime() - premierJanvier) / JOUR_MS / 7);
  return { lundi: enJour(lundi), dimanche: enJour(new Date(lundi.getTime() + 6 * JOUR_MS)), numero };
}

/** La dernière semaine terminée avant `jour` : le lundi, celle qui vient de finir. */
export function semainePrecedente(jour: string): Semaine {
  return semaineDu(enJour(new Date(enDate(jour).getTime() - 7 * JOUR_MS)));
}

const JOURS = ["DIM.", "LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM."];
const MOIS = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];

/** « DIM. 18 OCT. » : le jour d'une ligne de match, sur l'affiche. */
export function jourCourt(date: string): string {
  const d = enDate(date);
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

/** « 2 BUTS », « 1 BUT · 1 PASSE », ou rien : la performance n'est qu'un détail. */
export function detailDePerformance(buts: number, passes: number): string {
  const parts: string[] = [];
  if (buts > 0) parts.push(`${buts} BUT${buts > 1 ? "S" : ""}`);
  if (passes > 0) parts.push(`${passes} PASSE${passes > 1 ? "S" : ""}`);
  return parts.join(" · ");
}

/** Un match de la plateforme, avec ce que l'affiche en écrit. */
export type MatchDeLaSemaine = MatchAClasser & {
  /** Le nom de la compétition ; « MATCH AMICAL » pour un amical. */
  competitionNom: string;
  amical?: boolean;
  /**
   * Le camp des buteurs déclarés d'un amical renseigné après coup : celui de
   * l'équipe qui l'a saisi (voir api/matches/record). Absent : domicile.
   */
  campDesContributions?: "home" | "away";
};

/** Un match du joueur, tel qu'une ligne de l'affiche le raconte. */
export interface MatchDuJoueur {
  matchId: string;
  date: string;
  /** « DIM. 18 OCT. » */
  jour: string;
  competitionId: string;
  competition: string;
  /** Son équipe dans CE match : il a pu en changer dans la semaine. */
  equipeId: string | null;
  equipe: string;
  ecusson: string | null;
  /** Son équipe d'abord : « FC LION 4–0 PRAISE FC », même à l'extérieur. */
  affiche: string;
  buts: number;
  passes: number;
  /** Null quand le match n'a pas été chronométré, ou qu'il n'a pas assez joué. */
  note: number | null;
  homme: boolean;
}

export interface CandidatDeLaSemaine {
  /** `uid:<compte>`, ou `nom:<nom>|<équipe>` sans compte. */
  cle: string;
  nom: string;
  uid: string | null;
  /** Du plus ancien au plus récent. */
  matchs: MatchDuJoueur[];
  buts: number;
  passes: number;
  /** La moyenne simple de ses notes de la semaine ; null s'il n'en a aucune. */
  note: number | null;
  hommeDuMatch: number;
  /** Où retrouver la photo d'un joueur sans compte : sa ligne la plus récente. */
  ligneSansCompte: LigneSansCompte | null;
}

/** Un dossard qui a marqué ou fait marquer : écarté, mais signalé pour qu'on le nomme. */
export interface DossardEcarte {
  equipe: string;
  nom: string;
  buts: number;
  passes: number;
}

export interface CompetitionDeLaSemaine {
  id: string;
  nom: string;
  matchs: number;
}

export interface ClassementDeLaSemaine {
  semaine: Semaine;
  /** Toutes les compétitions qui ont joué, écartées comprises : l'admin peut les recocher. */
  competitions: CompetitionDeLaSemaine[];
  candidats: CandidatDeLaSemaine[];
  dossards: DossardEcarte[];
}

type Fait = NonNullable<MatchDeLaSemaine["liveState"]>["events"][number];

interface Camp {
  teamId: string | null;
  equipe: string;
  logo: string | null;
  affiche: string;
  entries: MatchDeLaSemaine["homeLineup"];
}

function campsDe(m: MatchDeLaSemaine): Record<"home" | "away", Camp> {
  const [sh, sa] = [m.scoreHome ?? 0, m.scoreAway ?? 0];
  return {
    home: {
      teamId: m.homeTeamId, equipe: m.homeTeamName, logo: m.homeTeamLogo ?? null,
      affiche: `${m.homeTeamName} ${sh}–${sa} ${m.awayTeamName}`, entries: m.homeLineup,
    },
    away: {
      teamId: m.awayTeamId, equipe: m.awayTeamName, logo: m.awayTeamLogo ?? null,
      affiche: `${m.awayTeamName} ${sa}–${sh} ${m.homeTeamName}`, entries: m.awayLineup,
    },
  };
}

const estUnBut = (f: Fait) => f.type === "goal" && f.detail !== OWN_GOAL_DETAIL;

interface Cumul extends CandidatDeLaSemaine {
  notes: number[];
  dateSansCompte: string;
}

export function classerLaSemaine(
  matchs: MatchDeLaSemaine[],
  semaine: Semaine,
  ecartees: ReadonlySet<string>,
): ClassementDeLaSemaine {
  const deLaSemaine = matchs.filter((m) =>
    m.status === "completed" && !!m.date && m.date >= semaine.lundi && m.date <= semaine.dimanche
    // Un forfait a un score attribué, pas joué.
    && !m.forfeitByTeamId);

  const parCompetition = new Map<string, CompetitionDeLaSemaine>();
  for (const m of deLaSemaine) {
    const c = parCompetition.get(m.competitionId) ?? { id: m.competitionId, nom: m.competitionNom, matchs: 0 };
    c.matchs += 1;
    parCompetition.set(m.competitionId, c);
  }

  const cumuls = new Map<string, Cumul>();
  const dossards = new Map<string, DossardEcarte>();

  const crediter = (
    m: MatchDeLaSemaine, camp: Camp, ligne: LigneDuCamp,
    chiffres: { buts: number; passes: number; note: number | null },
  ) => {
    const nom = ligne.name.trim();
    const uid = ligne.userId ?? null;
    if (!uid && !nom) return;
    const cle = uid ? `uid:${uid}` : `nom:${nom.toLowerCase()}|${camp.teamId ?? camp.equipe}`;
    const c: Cumul = cumuls.get(cle) ?? {
      cle, nom, uid, matchs: [], buts: 0, passes: 0, note: null, hommeDuMatch: 0,
      ligneSansCompte: null, notes: [], dateSansCompte: "",
    };
    // Une feuille saisie de travers peut porter deux fois la même ligne.
    if (c.matchs.some((x) => x.matchId === m.id)) return;
    const homme = !!m.mvpPlayerId && (m.mvpPlayerId === ligne.playerId || (!!uid && m.mvpUserId === uid));
    c.matchs.push({
      matchId: m.id, date: m.date as string, jour: jourCourt(m.date as string),
      competitionId: m.competitionId, competition: m.competitionNom,
      equipeId: camp.teamId, equipe: camp.equipe, ecusson: camp.logo, affiche: camp.affiche,
      buts: chiffres.buts, passes: chiffres.passes, note: chiffres.note, homme,
    });
    c.buts += chiffres.buts;
    c.passes += chiffres.passes;
    if (chiffres.note !== null) c.notes.push(chiffres.note);
    if (homme) c.hommeDuMatch += 1;
    if (c.nom === "" && nom) c.nom = nom;
    // Un amical aussi : sa ligne désigne la fiche du club (voir photosSansCompte).
    if (!uid && (m.date as string) >= c.dateSansCompte) {
      c.dateSansCompte = m.date as string;
      c.ligneSansCompte = { competitionId: m.competitionId, teamId: camp.teamId, playerId: ligne.playerId };
    }
    cumuls.set(cle, c);
  };

  for (const m of deLaSemaine) {
    if (ecartees.has(m.competitionId)) continue;
    const camps = campsDe(m);

    // Un amical renseigné après coup n'a que ses buteurs déclarés.
    if (m.contributionsDirectes?.length) {
      const camp = camps[m.campDesContributions ?? "home"];
      for (const c of m.contributionsDirectes) {
        if (estLigneHorsPlateforme(c.playerId)) continue;
        crediter(m, camp, { playerId: c.playerId, name: c.nom, userId: c.userId }, { buts: c.buts, passes: c.passes, note: null });
      }
      continue;
    }

    const faits = (m.liveState?.events ?? []).filter((e) => e.varStatus !== "cancelled");
    for (const camp of [camps.home, camps.away]) {
      const lignes: LigneDuCamp[] = camp.entries.length
        ? camp.entries
        : m.comptesDesLignes ? nommesSansFeuille(faits, camp.teamId, m.comptesDesLignes) : [];
      if (lignes.length === 0) continue;
      // Les notes du camp, seulement s'il a une feuille : sans feuille,
      // personne n'est noté (et un match jamais chronométré ne note personne).
      const notes = camp.entries.length
        ? notesDuCamp(m, camp.entries, faits, camp.teamId, m.dureeMatchMin ?? DUREE_MATCH_DEFAUT)
        : null;

      for (const ligne of lignes) {
        const id = ligne.playerId;
        const buts = faits.filter((f) => estUnBut(f) && f.playerId === id).length;
        const passes = faits.filter((f) => estUnBut(f) && f.assistPlayerId === id && f.playerId !== id).length;
        if (estLigneHorsPlateforme(id)) {
          if (estLigneDossard(id) && buts + passes > 0) {
            const cle = `${camp.teamId}|${id}`;
            const d = dossards.get(cle) ?? { equipe: camp.equipe, nom: ligne.name.trim(), buts: 0, passes: 0 };
            d.buts += buts;
            d.passes += passes;
            dossards.set(cle, d);
          }
          continue;
        }
        crediter(m, camp, ligne, { buts, passes, note: notes?.get(id)?.note ?? null });
      }
    }
  }

  const candidats: CandidatDeLaSemaine[] = [...cumuls.values()].map((c) => ({
    cle: c.cle,
    nom: c.nom,
    uid: c.uid,
    matchs: [...c.matchs].sort((a, b) => a.date.localeCompare(b.date)),
    buts: c.buts,
    passes: c.passes,
    note: c.notes.length ? Math.round((c.notes.reduce((s, n) => s + n, 0) / c.notes.length) * 10) / 10 : null,
    hommeDuMatch: c.hommeDuMatch,
    ligneSansCompte: c.ligneSansCompte,
  }));
  candidats.sort((a, b) =>
    b.buts - a.buts
    || b.passes - a.passes
    // Un joueur sans note passe après ceux qui en ont une.
    || (b.note ?? -1) - (a.note ?? -1)
    || b.hommeDuMatch - a.hommeDuMatch
    || a.nom.localeCompare(b.nom, "fr"));

  return {
    semaine,
    competitions: [...parCompetition.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    candidats,
    dossards: [...dossards.values()].sort((a, b) => b.buts + b.passes - (a.buts + a.passes)),
  };
}
