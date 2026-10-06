// ============================================
// L'offre : ce que l'usage gratuit permet, et ce que KoppaFoot Pro lève.
//
// DES DROITS AVANT LE PAIEMENT. Rien ne s'achète encore : l'administration
// accorde le Pro (ou l'option sans pub) à la main, pour une durée, à qui elle
// veut le faire essayer. Le jour où le paiement mobile money arrivera, il
// écrira le même document (`source: "paiement"`), et rien d'autre ne changera.
//
// CE QUI EST LIMITÉ, ET SEULEMENT ÇA. De la capacité, jamais le droit de
// jouer : le nombre d'équipes qu'on gère, de terrains qu'on référence, de
// compétitions qu'on mène de front, et la taille d'une compétition. Ni
// l'inscription d'une équipe à une compétition, ni l'arbitrage, ni le suivi
// d'un match ne se paient : c'est ce qui fait vivre la plateforme.
//
// RIEN NE SE RETIRE. Une limite se vérifie quand on CRÉE, jamais après coup :
// le manager qui gère déjà quatre équipes les garde toutes, il n'en crée
// simplement pas de cinquième. Et rien ne s'applique avant la date
// d'entrée en vigueur, réglée par l'administration et annoncée à l'avance
// (voir les conditions d'utilisation, « options payantes »). Une compétition
// créée avant cette date n'est jamais plafonnée.
//
// Module pur : aucun SDK. Le serveur (lib/offre-server, les routes) et le
// navigateur (la page « Mon offre », les messages de limite) le partagent.
// ============================================

/** Ce que l'offre gratuite permet. Le Pro lève chacune de ces limites. */
export const LIMITES_GRATUIT = {
  /** Équipes dont on est le manager. */
  equipes: 2,
  /** Terrains référencés. */
  terrains: 1,
  /** Compétitions créées et pas encore terminées (brouillons compris). */
  competitions: 1,
  /** Équipes dans une même compétition. */
  equipesParCompetition: 16,
} as const;

export type CleLimite = keyof typeof LIMITES_GRATUIT;

/** Les deux droits qu'on accorde : le Pro, et l'option sans pub vendue à part. */
export type DroitOffre = "pro" | "sans_pub";

/** Un droit accordé : depuis quand, jusqu'à quand, par qui et pourquoi. */
export interface DroitAccorde {
  /** Première journée, « 2026-10-05 ». */
  depuis: string;
  /** Dernière journée, incluse ; `null` = sans échéance. */
  jusqu_au: string | null;
  /** « admin » aujourd'hui ; « paiement » le jour où l'on encaissera. */
  source: "admin" | "paiement";
  accorde_par: string | null;
  /** Une phrase pour l'administration : « testeur, Coupe de Bè ». */
  motif: string | null;
}

/**
 * Les droits d'un compte — `droits/{uid}`. Écrit par le serveur seulement,
 * lisible par son titulaire (firestore.rules) : on ne s'accorde pas le Pro.
 */
export interface FirestoreDroits {
  pro: DroitAccorde | null;
  sans_pub: DroitAccorde | null;
  updated_at: unknown;
}

/** Le réglage de l'offre — `settings/offre`, lecture publique. */
export interface FirestoreReglageOffre {
  /** À partir de ce jour, les limites s'appliquent ; `null` = pas encore. */
  limites_depuis: string | null;
  updated_by: string | null;
  updated_at: unknown;
}

export { jourDeLome } from "@/lib/jour";

/** Le droit vaut-il ce jour-là ? */
export function droitActif(d: DroitAccorde | null | undefined, jour: string): boolean {
  return Boolean(d) && d!.depuis <= jour && (d!.jusqu_au === null || jour <= d!.jusqu_au);
}

export function estPro(droits: Pick<FirestoreDroits, "pro"> | null | undefined, jour: string): boolean {
  return droitActif(droits?.pro, jour);
}

/** Sans pub : l'option seule, ou le Pro, qui la comprend. */
export function estSansPub(droits: Pick<FirestoreDroits, "pro" | "sans_pub"> | null | undefined, jour: string): boolean {
  return estPro(droits, jour) || droitActif(droits?.sans_pub, jour);
}

/** Les limites s'appliquent-elles ce jour-là ? */
export function limitesEnVigueur(limitesDepuis: string | null | undefined, jour: string): boolean {
  return Boolean(limitesDepuis) && limitesDepuis! <= jour;
}

/** Le code que les routes renvoient quand une limite bloque une création. */
export const CODE_LIMITE = "limite_offre";

/** Ce qu'une route renvoie, en plus du message, quand une limite bloque. */
export interface LimiteAtteinte {
  code: typeof CODE_LIMITE;
  cle: CleLimite;
  max: number;
}

/** Le message du serveur, en français ; le navigateur le traduit lui-même. */
export function messageLimite(cle: CleLimite, max: number): string {
  const pluriel = max > 1 ? "s" : "";
  const quoi: Record<CleLimite, string> = {
    equipes: `Tu gères déjà ${max} équipe${pluriel}, le maximum de l'offre gratuite.`,
    terrains: `Tu as déjà ${max} terrain${pluriel} référencé${pluriel}, le maximum de l'offre gratuite.`,
    competitions: `Tu as déjà ${max} compétition${pluriel} en cours, le maximum de l'offre gratuite. Termine-la ou supprime un brouillon.`,
    equipesParCompetition: `Avec l'offre gratuite, une compétition compte au plus ${max} équipes.`,
  };
  return `${quoi[cle]} KoppaFoot Pro lève cette limite.`;
}

/** Côté navigateur : une création refusée par une limite de l'offre. */
export class ErreurLimiteOffre extends Error {
  constructor(message: string, readonly cle: CleLimite, readonly max: number) {
    super(message);
    this.name = "ErreurLimiteOffre";
  }
}

/** Une réponse de route est-elle un refus pour limite ? */
export function estLimiteAtteinte(x: unknown): x is LimiteAtteinte & { error?: string } {
  return typeof x === "object" && x !== null && (x as { code?: unknown }).code === CODE_LIMITE
    && typeof (x as { cle?: unknown }).cle === "string" && (x as { cle: string }).cle in LIMITES_GRATUIT;
}
