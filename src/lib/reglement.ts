import type { BookingStatus } from "@/types";

// ============================================
// Les frais de réservation d'un terrain : l'acompte, son ticket, sa clôture.
//
// UN SEUL CIRCUIT D'ARGENT. Le propriétaire dit oui, l'équipe paie 5 % du prix
// dans l'application, reçoit un ticket, le fait valider sur place et règle le
// reste en liquide. L'acompte revient au propriétaire dans tous les cas, sauf
// un : s'il annule lui-même, il est rendu à l'équipe.
//
// PERSONNE NE DÉCLARE RIEN. Un ticket validé dit que le match a eu lieu ; une
// fenêtre passée sans validation dit l'absence. Le propriétaire touchant
// l'acompte dans les deux cas, personne n'a intérêt à tricher : le ticket ne
// sert qu'à tenir un historique juste.
//
// UN SEUL CALCUL, APPELÉ APRÈS CHAQUE GESTE — la même idée que lib/reservations
// pour le terrain d'un match. `planReglement` compare la réservation telle
// qu'elle est avec son règlement tel qu'il est, et dit quoi faire. Confirmer,
// annuler, laisser passer l'heure : aucun de ces gestes ne porte sa propre
// règle d'argent.
//
// Module pur : aucun SDK. Le serveur (lib/reglement-serveur) l'exécute, les
// écrans l'appellent pour annoncer un montant ; ses tests tournent dans
// mobile/src/__tests__/reglement.test.ts.
// ============================================

/** Les frais de réservation : la part du prix payée dans l'application. */
export const TAUX_ACOMPTE = 0.05;
/** L'acompte s'arrondit à ce pas, vers le haut. */
export const ARRONDI_ACOMPTE = 50;
/** Le plancher de FedaPay : pas de collecte sous 100 XOF. */
export const ACOMPTE_PLANCHER = 100;
/** Le temps laissé pour payer après le oui du propriétaire. */
export const DELAI_ACOMPTE_MS = 24 * 3_600_000;
/** Le ticket se valide à partir d'une heure avant le coup d'envoi. */
export const AVANCE_VALIDATION_MS = 3_600_000;
/** Au-delà, un taux de frais est une faute de saisie. */
const TAUX_FRAIS_MAX = 20;

export const BATTEMENTS = [0, 15, 30] as const;
export type Battement = (typeof BATTEMENTS)[number];

export function battementLu(x: unknown): Battement {
  return x === 15 || x === 30 ? x : 0;
}

/** Le prix d'un créneau : tarif horaire × durée. 0 quand l'un des deux manque. */
export function prixDuCreneau(tarifHoraire: unknown, duree: unknown): number {
  if (typeof tarifHoraire !== "number" || typeof duree !== "number") return 0;
  if (!Number.isFinite(tarifHoraire) || !Number.isFinite(duree) || tarifHoraire <= 0 || duree <= 0) return 0;
  return Math.round(tarifHoraire * duree);
}

/** L'acompte d'un prix ; 0 quand il n'y a pas de prix, donc pas de règlement. */
export function acompteDe(prix: number): number {
  if (!Number.isFinite(prix) || prix <= 0) return 0;
  return Math.max(ACOMPTE_PLANCHER, Math.ceil((prix * TAUX_ACOMPTE) / ARRONDI_ACOMPTE) * ARRONDI_ACOMPTE);
}

/**
 * Les frais de paiement ajoutés à ce que l'équipe paie, au taux réglé dans
 * l'administration. Sans taux lisible, 0 : KoppaFoot supporte alors les frais
 * de FedaPay.
 */
export function fraisDePaiement(montant: number, tauxPourCent: unknown): number {
  if (typeof tauxPourCent !== "number" || !Number.isFinite(tauxPourCent)) return 0;
  if (tauxPourCent <= 0 || tauxPourCent > TAUX_FRAIS_MAX) return 0;
  return Math.ceil((montant * tauxPourCent) / 100);
}

/** L'instant du début d'un créneau. Lomé vit à l'heure UTC : rien à convertir. */
export function debutDuCreneau(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00Z`);
}

/** Jusqu'à quand l'acompte se paie : 24 h, et au plus tard le début du créneau. */
export function echeanceAcompte(ouvertLe: number, debut: number): number {
  return Math.min(ouvertLe + DELAI_ACOMPTE_MS, debut);
}

/** Quand le ticket se valide : d'une heure avant le début à la fin, battement compris. */
export function fenetreDeValidation(
  c: { date: string; time: string; duration: number },
  battementMin: number,
): { ouvre: number; ferme: number } {
  const debut = debutDuCreneau(c.date, c.time);
  return {
    ouvre: debut - AVANCE_VALIDATION_MS,
    ferme: debut + c.duration * 3_600_000 + battementMin * 60_000,
  };
}

/** Ni 0 ni O, ni 1 ni I ni L : un code se dicte au bord d'un terrain. */
export const ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LONGUEUR_CODE = 6;

/** `hasard` rend un nombre dans [0, 1[ ; le serveur lui passe un tirage sûr. */
export function nouveauCode(hasard: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < LONGUEUR_CODE; i += 1) {
    code += ALPHABET_CODE[Math.min(ALPHABET_CODE.length - 1, Math.floor(hasard() * ALPHABET_CODE.length))];
  }
  return code;
}

/** Ce que le gérant a tapé ou scanné, remis en forme ; `null` si ce n'est pas un code. */
export function codeSaisi(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const code = brut.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== LONGUEUR_CODE) return null;
  return [...code].every((c) => ALPHABET_CODE.includes(c)) ? code : null;
}

/** Un numéro mobile togolais, réduit à ses huit chiffres ; `null` s'il n'en est pas un. */
export function numeroTogolais(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const chiffres = brut.replace(/[\s.-]/g, "").replace(/^(\+228|00228)/, "");
  return /^[79]\d{7}$/.test(chiffres) ? chiffres : null;
}

export type ClotureReglement = "joue" | "absent" | "annule_equipe" | "annule_proprietaire" | "libere";

/** Ce qu'on montre : où en est l'acompte, puis comment la réservation a fini. */
export type EtatReglement = "acompte_attendu" | "acompte_paye" | ClotureReglement;

/** Le dossier d'argent d'une réservation — `reglements/{idRéservation}`. Écrit par le serveur seul. */
export interface FirestoreReglement {
  owner_id: string;
  user_id: string;
  venue_id: string;
  venue_name: string;
  /** Qui joue, tel qu'on le dit au gérant : le nom de l'équipe, sinon celui du demandeur. */
  demandeur: string;
  /**
   * Le numéro mobile money où rendre l'acompte à l'équipe si le propriétaire
   * annule : celui de sa demande, sinon celui qu'elle donne en payant.
   * OBLIGATOIRE POUR PAYER : on n'encaisse pas un acompte qu'on ne saurait
   * pas rendre. `null` tant qu'il n'est pas connu.
   */
  telephone: string | null;
  /** Le créneau et le prix, FIGÉS à l'ouverture : un tarif changé après coup n'y touche pas. */
  date: string;
  time: string;
  duration: number;
  prix: number;
  acompte: number;
  /** Le taux des frais de paiement au moment de l'ouverture, en pour cent. */
  taux_frais: number;
  /** En millisecondes UTC. */
  echeance: number;
  ouvre_validation: number;
  fin_fenetre: number;
  paye_le: unknown;
  paiement_id: string | null;
  /** Quand FedaPay libère les fonds de l'acompte (ISO), recopié de la collecte. */
  disponible_le: string | null;
  code: string | null;
  valide_le: unknown;
  cloture: ClotureReglement | null;
  clos_le: unknown;
  created_at: unknown;
  updated_at: unknown;
}

export function etatDuReglement(r: Pick<FirestoreReglement, "paye_le" | "cloture">): EtatReglement {
  return r.cloture ?? (r.paye_le ? "acompte_paye" : "acompte_attendu");
}

export interface EntreePlan {
  /** La réservation telle qu'elle est ; `null` si elle n'existe plus. */
  reservation: {
    status: BookingStatus;
    kind?: string | null;
    owner_id: string;
    user_id: string;
    cancelled_by?: string | null;
  } | null;
  /** Son règlement tel qu'il est ; `null` s'il n'a jamais été ouvert. */
  reglement: { echeance: number; fin_fenetre: number; paye: boolean; valide: boolean; cloture: ClotureReglement | null } | null;
  /** Le terrain fait payer ses frais de réservation dans l'application, et il y a un acompte à demander. */
  payant: boolean;
  maintenant: number;
}

export type PlanReglement =
  | { action: "rien" }
  | { action: "ouvrir" }
  | {
      action: "clore";
      cloture: ClotureReglement;
      /** À qui l'acompte payé est dû ; `null` si rien n'a été payé. */
      du: "proprietaire" | "equipe" | null;
      /** L'acompte n'est pas venu : le serveur annule aussi la réservation, le créneau se libère. */
      annulerReservation: boolean;
    };

/**
 * Que faire du règlement d'une réservation, d'après l'état des deux ?
 *
 * Idempotent : rappelé sur un règlement clos, ou deux fois de suite, il ne
 * demande rien de plus.
 */
export function planReglement({ reservation, reglement, payant, maintenant }: EntreePlan): PlanReglement {
  if (!reglement) {
    const aOuvrir = Boolean(reservation)
      && reservation!.status === "confirmed"
      && reservation!.kind !== "blocage"
      // Le propriétaire qui joue sur son propre terrain ne se verse pas d'acompte.
      && reservation!.owner_id !== reservation!.user_id
      && payant;
    return aOuvrir ? { action: "ouvrir" } : { action: "rien" };
  }
  if (reglement.cloture !== null) return { action: "rien" };

  if (!reservation || reservation.status === "cancelled") {
    const parLeGerant = reservation?.cancelled_by === "proprietaire";
    return {
      action: "clore",
      cloture: parLeGerant ? "annule_proprietaire" : "annule_equipe",
      du: reglement.paye ? (parLeGerant ? "equipe" : "proprietaire") : null,
      annulerReservation: false,
    };
  }

  if (!reglement.paye) {
    return maintenant > reglement.echeance
      ? { action: "clore", cloture: "libere", du: null, annulerReservation: true }
      : { action: "rien" };
  }
  if (reglement.valide) return { action: "clore", cloture: "joue", du: "proprietaire", annulerReservation: false };
  if (maintenant > reglement.fin_fenetre) {
    return { action: "clore", cloture: "absent", du: "proprietaire", annulerReservation: false };
  }
  return { action: "rien" };
}

/**
 * Ce que le serveur montre d'un règlement à l'une de ses deux parties
 * (GET /api/reservations/{id}/reglement). Les montants sont en XOF, les
 * instants en millisecondes UTC.
 */
export interface VueReglement {
  role: "equipe" | "proprietaire";
  etat: EtatReglement;
  terrain: string;
  date: string;
  time: string;
  duration: number;
  /** Le prix du créneau, et ce qui en est payé dans l'application. */
  prix: number;
  acompte: number;
  /** Les frais de paiement ajoutés, et ce que l'équipe paie en tout. */
  frais: number;
  total: number;
  /** Ce qui se règle sur place. */
  reste: number;
  echeance: number;
  /** La fenêtre de validation du ticket. */
  ouvre: number;
  ferme: number;
  /** Le code du ticket : pour l'équipe seule, une fois l'acompte payé. */
  code: string | null;
  valide: boolean;
  /** Pour l'équipe seule : le numéro où ses frais lui seraient rendus ; `null` s'il reste à donner. */
  telephone: string | null;
  /** Pour le propriétaire, réservation close : ce qui lui est dû, et quand cela a été versé (`null` : pas encore). */
  du: { montant: number; verseLe: number | null } | null;
}

/** Ce que dit un ticket au gérant qui le lit (/api/reservations/ticket). */
export interface ResumeTicket {
  reservation: string;
  terrain: string;
  equipe: string;
  date: string;
  time: string;
  duration: number;
  acompte: number;
  reste: number;
  valide: boolean;
}
