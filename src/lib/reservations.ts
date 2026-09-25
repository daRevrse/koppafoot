import { dureeDuMatch } from "@/lib/terrains";
import type { BookingStatus, CompMatchStatus, MatchStatus, PropositionCreneau } from "@/types";

// ============================================
// Le créneau d'un match sur un terrain référencé : ce qu'il faut demander,
// garder ou libérer.
//
// UN SEUL CALCUL, APPELÉ APRÈS CHAQUE GESTE sur un match — création, défi
// refusé, annulation, suppression, report, modification acceptée. Chaque geste
// aurait pu porter sa propre règle (« si on annule, libérer » ; « si on
// déplace, redemander ») ; six règles écrites à six endroits finissent par se
// contredire. Ici on compare ce que le match VEUT, d'après son état actuel,
// avec ce qui EXISTE chez le propriétaire, et on en tire les écritures.
//
// Pur, sans Firestore : la route l'exécute, les tests le vérifient.
// ============================================

/** Ce qu'on lit du match pour décider. `null` : le match n'existe plus. */
export interface MatchPourTerrain {
  status: MatchStatus | CompMatchStatus;
  venueId: string | null;
  date: string;
  time: string;
  format: string;
  /**
   * La durée à réserver, en heures, quand le format ne suffit pas à la dire :
   * une compétition fixe la longueur de ses mi-temps, pas un amical.
   */
  duree?: number;
}

/** Une réservation déjà liée au match. */
export interface ReservationLiee {
  id: string;
  venueId: string;
  date: string;
  time: string;
  status: BookingStatus;
  cancelledBy: "proprietaire" | "demandeur" | "systeme" | null;
  proposition: PropositionCreneau | null;
}

export interface CreneauVoulu {
  venueId: string;
  date: string;
  time: string;
  duration: number;
}

export interface PlanTerrain {
  /** Les réservations en cours qui ne correspondent plus au match : à libérer. */
  liberer: string[];
  /** La réservation en cours qui correspond déjà au match : on n'y touche pas. */
  garder: string | null;
  /**
   * La demande à faire. `confirmee` : le propriétaire a lui-même proposé ce
   * créneau en refusant le précédent, le lui redemander serait absurde.
   */
  demander: (CreneauVoulu & { confirmee: boolean }) | null;
  /** Le propriétaire a déjà refusé exactement ce créneau : on ne redemande pas. */
  refus: ReservationLiee | null;
}

/**
 * Les états où le match a encore lieu, et donc besoin de son terrain.
 *
 * Un défi envoyé en fait partie : la demande part dès la création, c'est ce
 * qui laisse au propriétaire le temps de répondre avant que l'adversaire
 * accepte. S'il refuse le défi, le match passe en « cancelled » et le créneau
 * se libère au calcul suivant. « scheduled » est l'état d'un match de
 * compétition programmé.
 */
const A_RESERVER: (MatchStatus | CompMatchStatus)[] = ["challenge", "pending", "upcoming", "delayed", "scheduled"];

const actif = (b: ReservationLiee) => b.status === "pending" || b.status === "confirmed";
const memeCreneau = (b: { venueId: string; date: string; time: string }, v: CreneauVoulu) =>
  b.venueId === v.venueId && b.date === v.date && b.time === v.time;

export function planTerrain(match: MatchPourTerrain | null, liees: ReservationLiee[]): PlanTerrain {
  const actives = liees.filter(actif);

  // Un match en cours ou joué ne bouge plus : on ne libère pas le terrain
  // sous les pieds de ceux qui y jouent, et on ne redemande rien.
  if (match && (match.status === "live" || match.status === "completed")) {
    return { liberer: [], garder: actives[0]?.id ?? null, demander: null, refus: null };
  }

  const voulu: CreneauVoulu | null =
    // Sans jour ni heure — un match de compétition pas encore programmé —
    // il n'y a pas de créneau à demander.
    match && match.venueId && match.date && match.time && A_RESERVER.includes(match.status)
      ? {
          venueId: match.venueId,
          date: match.date,
          time: match.time,
          duration: match.duree ?? dureeDuMatch(match.format),
        }
      : null;

  if (!voulu) {
    return { liberer: actives.map((b) => b.id), garder: null, demander: null, refus: null };
  }

  const deja = actives.find((b) => memeCreneau(b, voulu)) ?? null;
  const liberer = actives.filter((b) => b !== deja).map((b) => b.id);
  if (deja) return { liberer, garder: deja.id, demander: null, refus: null };

  const refus = liees.find((b) => b.cancelledBy === "proprietaire" && memeCreneau(b, voulu)) ?? null;
  if (refus) return { liberer, garder: null, demander: null, refus };

  const propose = liees.some(
    (b) => b.venueId === voulu.venueId
      && b.proposition?.date === voulu.date
      && b.proposition?.time === voulu.time,
  );
  return { liberer, garder: null, demander: { ...voulu, confirmee: propose }, refus: null };
}
