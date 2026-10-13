// ============================================
// L'offre : ce que l'usage gratuit permet, et ce que KoppaFoot Pro lève.
//
// UN SEUL DOCUMENT DIT QUI EST PRO, d'où que le droit vienne. L'administration
// l'accorde à la main (`source: "admin"`), pour une durée, à qui elle veut le
// faire essayer ; un achat par mobile money écrit le même document
// (`source: "paiement"`, voir lib/paiement). Rien d'autre ne distingue les
// deux : les limites, le club, le sans pub lisent ce document et lui seul.
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
  /** « admin » : accordé à la main ; « paiement » : acheté (lib/paiement). */
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
  /** Le prix de chaque formule, en XOF ; vide = pas en vente (lib/paiement). */
  prix?: { pro_mois?: number | null; pro_an?: number | null };
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

// ─── Ce qu'un compte EST, pour l'offre ──────────────────────

/**
 * Les titres d'un compte : ce qui lui donne quelque chose à gérer.
 *
 * KOPPAFOOT+ N'EST PAS POUR TOUT LE MONDE. Il ne sert qu'à qui gère : des
 * équipes (le manager), des compétitions (l'organisateur), des terrains (le
 * propriétaire). Un joueur, un arbitre, un spectateur, un scoreur n'y gagnent
 * que le retrait de la publicité, qui se vend à part (« Pas de pubs »).
 */
export interface Titres {
  manager: boolean;
  organisateur: boolean;
  gerant: boolean;
}

/** Le profil tel que Firestore le range (`users/{uid}`). */
export interface ProfilPourOffre {
  user_type?: unknown;
  evolution_role?: unknown;
  is_organizer?: unknown;
  is_venue_owner?: unknown;
  is_superadmin?: unknown;
}

/**
 * Les titres d'un profil.
 *
 * UN MANAGER L'EST PAR SON RÔLE, et par lui seul. Le staff d'une équipe n'en
 * fait pas un manager : c'est un joueur qu'on aide, avec des limites. Une
 * équipe à son nom sans le rôle, non plus. Le superadmin organise d'office
 * (lib/hats).
 */
export function titresDuProfil(p: ProfilPourOffre | null | undefined): Titres {
  return {
    manager: p?.user_type === "manager" || p?.evolution_role === "manager",
    organisateur: p?.is_organizer === true || p?.is_superadmin === true || p?.user_type === "superadmin",
    gerant: p?.is_venue_owner === true,
  };
}

/** Les mêmes titres, lus sur le profil que le navigateur tient (`UserProfile`). */
export function titresDuCompte(u: {
  userType?: unknown; evolutionRole?: unknown; isOrganizer?: unknown; isVenueOwner?: unknown; isSuperAdmin?: unknown;
} | null | undefined): Titres {
  return titresDuProfil({
    user_type: u?.userType,
    evolution_role: u?.evolutionRole,
    is_organizer: u?.isOrganizer,
    is_venue_owner: u?.isVenueOwner,
    is_superadmin: u?.isSuperAdmin,
  });
}

/** KoppaFoot+ se propose à qui porte au moins un titre. */
export function aDroitAKoppaFootPlus(t: Titres): boolean {
  return t.manager || t.organisateur || t.gerant;
}

/**
 * L'offre qui donne son nom à l'entrée de menu et à la page : KOPPAFOOT+
 * (`pro`) pour qui y a droit, « Pas de pubs » (`sans_pub`) pour les autres.
 * Le menu et la page lisent la même fonction : ils ne peuvent pas se contredire.
 */
export function offreAffichee(t: Titres): DroitOffre {
  return aDroitAKoppaFootPlus(t) ? "pro" : "sans_pub";
}

/** Ce que KoppaFoot+ peut lever : chaque plafond, et le Club multi-équipes. */
export type Avantage = CleLimite | "club";

const TITRE_REQUIS: Record<Avantage, keyof Titres> = {
  equipes: "manager",
  club: "manager",
  terrains: "gerant",
  competitions: "organisateur",
  equipesParCompetition: "organisateur",
};

/**
 * KoppaFoot+ lève-t-il cet avantage pour ce compte ?
 *
 * IL N'AGIT QUE POUR CE QUE LE COMPTE EST. Un joueur organisateur qui l'a
 * mène autant de compétitions qu'il veut, mais il n'a ni équipes au-delà du
 * plafond, ni club. Les titres se cumulent. Le droit lui-même (`estPro`) se
 * vérifie à part : ceci ne dit que ce qu'il ouvrirait.
 */
export function koppaFootPlusLeve(t: Titres, avantage: Avantage): boolean {
  return t[TITRE_REQUIS[avantage]];
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
