import { buteursDuMatch, type Buteur } from "@/lib/buteurs";
import { describeBracketSlotSource } from "@/lib/competition-format";
import { dateAvecJourLong } from "@/lib/dates";
import { estLigneDossard } from "@/lib/dossards";
import type { CompMatch, CompMatchRound } from "@/types";

// ============================================
// Le calendrier d'une compétition, mis en ordre pour le PDF que l'organisateur
// partage ou glisse dans ses rapports (lib/pdf-calendrier).
//
// Décidé le 2026-10-21 :
//
//   — DANS L'ORDRE DU CALENDRIER, jour par jour et à l'heure ; les matchs
//     sans date à la fin, sous « Date à fixer ». Un match annulé n'y est pas.
//   — UN MATCH JOUÉ donne son score, ses tirs au but, ses buteurs ; UN MATCH
//     À VENIR, son heure et son terrain.
//   — LES BUTEURS SAISIS SANS FEUILLE DE MATCH SONT SIGNALÉS, d'eux-mêmes :
//     une étoile au score, et une mention au bas du document. Un camp qui a
//     marqué sans feuille, c'est un score rattrapé après coup ; un buteur au
//     dossard (« N°7 »), une feuille de secours. Dans les deux cas, les noms
//     peuvent manquer ou être faux.
//
// Pur : aucun SDK. La route le nourrit de matchs déjà convertis.
// ============================================

export type EtatDuMatch = "joue" | "en_cours" | "a_venir";

export interface CampDuCalendrier {
  nom: string;
  /** Une place de phase finale pas encore attribuée : « 1er poule B ». */
  enAttente: boolean;
  /** « Kossi 12', 34' », dans l'ordre des buts. */
  buteurs: string[];
}

export interface LigneDuCalendrier {
  id: string;
  /** « 16:30 », ou null. */
  heure: string | null;
  /** « Poule B », « Demi-finale », « Exhibition ». */
  phase: string;
  domicile: CampDuCalendrier;
  exterieur: CampDuCalendrier;
  etat: EtatDuMatch;
  /** Domicile, extérieur. Null pour un match à venir. */
  score: [number, number] | null;
  tab: [number, number] | null;
  /** Le camp qui a déclaré forfait. */
  forfait: "domicile" | "exterieur" | null;
  /** Des buteurs saisis sans feuille de match : l'étoile au score. */
  sansFeuille: boolean;
  /** « UL - Terrain 1, Lomé ». */
  lieu: string | null;
}

export interface JourDuCalendrier {
  /** « 2026-10-16 » ; null pour les matchs sans date. */
  date: string | null;
  /** « Vendredi 16 octobre », « Date à fixer ». */
  titre: string;
  lignes: LigneDuCalendrier[];
}

export interface CalendrierDeCompetition {
  jours: JourDuCalendrier[];
  joues: number;
  /** À venir ou en cours : ce qui reste à jouer. */
  aVenir: number;
  /** Les matchs joués marqués d'une étoile. */
  sansFeuille: number;
}

/** Les tours d'une phase finale, dits comme dans le calendrier. */
const TOURS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  final: "Finale",
  third_place: "Petite finale",
};

const ORDRE_DES_TOURS: CompMatchRound[] = ["round_of_16", "quarter", "semi", "final", "third_place"];

function phaseDe(m: CompMatch): string {
  if (m.stage === "group") return m.group ? `Poule ${m.group}` : "Poule";
  if (m.stage === "exhibition") return "Exhibition";
  return m.round ? TOURS[m.round] : "Phase finale";
}

/** À la même heure : les poules dans leur ordre, puis la phase finale tour par tour, puis les exhibitions. */
function rangDeLaPhase(m: CompMatch): string {
  if (m.stage === "group") return `0${m.group ?? ""}`;
  if (m.stage === "knockout") {
    const tour = m.round ? ORDRE_DES_TOURS.indexOf(m.round) : ORDRE_DES_TOURS.length;
    return `1${tour}${String(m.bracketSlot ?? 0).padStart(3, "0")}`;
  }
  return "2";
}

/** La clé de tri : le jour, l'heure (sans heure, après), la phase. */
const cleDeTri = (m: CompMatch) => `${m.date ?? "9999"}|${m.time || "99:99"}|${rangDeLaPhase(m)}`;

function campDe(m: CompMatch, cote: "home" | "away"): Omit<CampDuCalendrier, "buteurs"> {
  const nom = cote === "home" ? m.homeTeamName : m.awayTeamName;
  const equipe = cote === "home" ? m.homeTeamId : m.awayTeamId;
  if (equipe && nom) return { nom, enAttente: false };
  const source = cote === "home" ? m.homeSource : m.awaySource;
  return { nom: source ? describeBracketSlotSource(source) : "À déterminer", enAttente: true };
}

/** « Kossi 12', 34' », « Kossi ×2 » sans minutes, « Kossi (csc) 40' ». */
export function libelleButeur(b: Buteur): string {
  const suite = b.minutes.length > 0 ? ` ${b.minutes.join(", ")}` : b.nombre > 1 ? ` ×${b.nombre}` : "";
  return `${b.nom}${b.csc ? " (csc)" : ""}${suite}`;
}

/**
 * Des buteurs saisis sans feuille : un camp qui a marqué sans en avoir, ou un
 * but d'une ligne au dossard. Un forfait n'a pas de buteurs à douter.
 */
function saisiSansFeuille(m: CompMatch): boolean {
  if (m.forfeitByTeamId) return false;
  if ((m.scoreHome ?? 0) > 0 && m.homeLineup.length === 0) return true;
  if ((m.scoreAway ?? 0) > 0 && m.awayLineup.length === 0) return true;
  return (m.liveState?.events ?? []).some(
    (e) => e.type === "goal" && e.varStatus !== "cancelled" && estLigneDossard(e.playerId),
  );
}

function etatDe(m: CompMatch): EtatDuMatch {
  if (m.status === "completed") return "joue";
  if (m.status === "live") return "en_cours";
  return "a_venir";
}

function ligneDe(m: CompMatch, dureeMiTemps: number): LigneDuCalendrier {
  const etat = etatDe(m);
  const buteurs = etat === "a_venir"
    ? { home: [], away: [] }
    : buteursDuMatch(m.liveState?.events ?? [], m.homeTeamId, undefined, dureeMiTemps);
  return {
    id: m.id,
    heure: m.time || null,
    phase: phaseDe(m),
    domicile: { ...campDe(m, "home"), buteurs: buteurs.home.map(libelleButeur) },
    exterieur: { ...campDe(m, "away"), buteurs: buteurs.away.map(libelleButeur) },
    etat,
    score: etat === "a_venir" ? null : [m.scoreHome ?? 0, m.scoreAway ?? 0],
    tab: etat !== "a_venir" && m.penaltyHome != null && m.penaltyAway != null ? [m.penaltyHome, m.penaltyAway] : null,
    forfait: !m.forfeitByTeamId ? null
      : m.forfeitByTeamId === m.homeTeamId ? "domicile"
      : m.forfeitByTeamId === m.awayTeamId ? "exterieur" : null,
    sansFeuille: etat === "joue" && saisiSansFeuille(m),
    lieu: [m.venueName, m.venueCity].map((s) => s?.trim()).filter(Boolean).join(", ") || null,
  };
}

function titreDuJour(date: string | null): string {
  if (!date) return "Date à fixer";
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const t = dateAvecJourLong(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function calendrierDeCompetition(matchs: CompMatch[], dureeMiTemps: number): CalendrierDeCompetition {
  const tries = matchs
    .filter((m) => m.status !== "cancelled")
    .sort((a, b) => cleDeTri(a).localeCompare(cleDeTri(b)));

  const jours: JourDuCalendrier[] = [];
  for (const m of tries) {
    const date = m.date || null;
    let jour = jours[jours.length - 1];
    if (!jour || jour.date !== date) {
      jour = { date, titre: titreDuJour(date), lignes: [] };
      jours.push(jour);
    }
    jour.lignes.push(ligneDe(m, dureeMiTemps));
  }

  const lignes = jours.flatMap((j) => j.lignes);
  return {
    jours,
    joues: lignes.filter((l) => l.etat === "joue").length,
    aVenir: lignes.filter((l) => l.etat !== "joue").length,
    sansFeuille: lignes.filter((l) => l.sansFeuille).length,
  };
}
