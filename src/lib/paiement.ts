import { droitActif, type DroitAccorde, type DroitOffre } from "@/lib/offre";

// ============================================
// Le paiement : ce qui s'achète, pour combien de temps, et ce qu'un paiement
// FedaPay change.
//
// UNE PÉRIODE, PAS UN ABONNEMENT. Le mobile money ne prélève pas tout seul :
// on paie, le droit court jusqu'à une date, et rien ne se renouvelle. Racheter
// avant la fin ajoute la période à la fin en cours.
//
// LES PRIX SONT UN RÉGLAGE (`settings/offre.prix`), saisi dans
// l'administration. Une formule sans prix n'est pas en vente : c'est ainsi
// qu'on ouvre la vente, et qu'on la referme.
//
// LE NAVIGATEUR NE DIT JAMAIS COMBIEN. Il envoie le nom d'une formule ; le
// serveur lit le prix, crée la collecte, et n'accorde le droit qu'après avoir
// relu chez FedaPay que le montant demandé a bien été payé (deciderReglement).
//
// Module pur : aucun SDK. Le serveur (lib/paiement-serveur, les routes
// /api/paiements) et le navigateur (la page de l'offre, l'administration) le
// partagent ; ses tests tournent dans mobile/src/__tests__/paiement.test.ts.
// ============================================

/**
 * Ce qui s'achète : le droit accordé, et pour combien de mois.
 *
 * DEUX OFFRES. KoppaFoot+ (le droit `pro`) pour qui gère des équipes, des
 * compétitions ou des terrains ; « Pas de pubs » (le droit `sans_pub`) pour
 * tout le monde. Qui peut acheter quoi se décide au serveur, sur le profil
 * (lib/offre, lib/paiement-serveur) : ce catalogue ne dit que ce qui existe.
 *
 * Les identifiants `pro_*` gardent l'ancien nom de l'offre : ils sont écrits
 * dans les paiements déjà faits et dans les références envoyées à FedaPay.
 */
export const FORMULES = {
  pro_mois: { droit: "pro", mois: 1 },
  pro_an: { droit: "pro", mois: 12 },
  sans_pub_mois: { droit: "sans_pub", mois: 1 },
  sans_pub_an: { droit: "sans_pub", mois: 12 },
} as const satisfies Record<string, { droit: DroitOffre; mois: number }>;

export type IdFormule = keyof typeof FORMULES;

/** Dans l'ordre où on les montre : KoppaFoot+ d'abord, le mois avant l'année. */
export const ID_FORMULES = Object.keys(FORMULES) as IdFormule[];

export function estFormule(x: unknown): x is IdFormule {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(FORMULES, x);
}

/** Le nom de chaque offre, tel qu'on le lit. */
export const NOM_OFFRE: Record<DroitOffre, string> = { pro: "KoppaFoot+", sans_pub: "Pas de pubs" };

/** « KoppaFoot+, 1 mois » : ce qui s'affiche chez FedaPay et sur le reçu. */
export function libelleFormule(id: IdFormule): string {
  const { droit, mois } = FORMULES[id];
  return `${NOM_OFFRE[droit]}, ${mois === 12 ? "1 an" : "1 mois"}`;
}

/** Le plancher de FedaPay : pas de collecte sous 100 XOF. */
export const PRIX_PLANCHER = 100;

/** `settings/offre.prix` : `null`, la formule n'est pas en vente. */
export type PrixOffre = Record<IdFormule, number | null>;

export function prixValide(x: unknown): x is number {
  return typeof x === "number" && Number.isInteger(x) && x >= PRIX_PLANCHER;
}

/** Les prix tels que rangés, assainis : tout ce qui n'est pas un prix vaut `null`. */
export function lirePrix(brut: unknown): PrixOffre {
  const p = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  return Object.fromEntries(ID_FORMULES.map((id) => {
    const v = p[id];
    return [id, prixValide(v) ? v : null];
  })) as PrixOffre;
}

export interface FormuleEnVente {
  id: IdFormule;
  /** Ce qu'elle accorde : KoppaFoot+ (`pro`) ou « Pas de pubs » (`sans_pub`). */
  droit: DroitOffre;
  mois: number;
  prix: number;
}

export function formulesEnVente(prix: PrixOffre): FormuleEnVente[] {
  return ID_FORMULES.flatMap((id) => {
    const p = prix[id];
    return prixValide(p) ? [{ id, droit: FORMULES[id].droit, mois: FORMULES[id].mois, prix: p }] : [];
  });
}

/**
 * `jour` plus `mois` mois, au même quantième ; au dernier jour du mois quand
 * le quantième n'y existe pas (le 31 janvier donne le 28 ou le 29 février).
 */
export function ajouterMois(jour: string, mois: number): string {
  const [annee, moisDuJour, quantieme] = jour.split("-").map(Number);
  const cible = new Date(Date.UTC(annee, moisDuJour - 1 + mois, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(quantieme, dernier));
  return cible.toISOString().slice(0, 10);
}

export function ajouterJours(jour: string, jours: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + jours * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Un droit (KoppaFoot+ ou « Pas de pubs ») après un achat de `mois` mois fait
 * ce `jour`.
 *
 * Acheté le 12 octobre pour un mois : jusqu'au 12 novembre inclus. Racheté
 * pendant qu'il court : la période s'ajoute à la fin en cours, d'où qu'il
 * vienne (un essai accordé par l'administration se prolonge pareil). Un droit
 * expiré repart du jour de l'achat.
 *
 * `null` : il court sans échéance, il n'y a rien à prolonger — et surtout
 * rien à écraser par un droit d'un mois.
 */
export function nouvelleEcheance(
  actuel: DroitAccorde | null | undefined,
  jour: string,
  mois: number,
): { depuis: string; jusqu_au: string } | null {
  if (!actuel || !droitActif(actuel, jour)) return { depuis: jour, jusqu_au: ajouterMois(jour, mois) };
  if (actuel.jusqu_au === null) return null;
  return { depuis: actuel.depuis, jusqu_au: ajouterMois(actuel.jusqu_au, mois) };
}

/** Où en est une ligne de `paiements`. Seul `paye` est définitif chez nous. */
export type StatutPaiement = "en_attente" | "paye" | "echoue" | "annule" | "expire";

/** Les états qu'une relecture chez FedaPay peut encore faire bouger. */
export const STATUTS_OUVERTS: StatutPaiement[] = ["en_attente", "echoue", "annule"];

/**
 * L'état d'une collecte FedaPay, dans nos mots.
 *
 * `declined` et `canceled` ne sont pas finaux chez FedaPay : le client peut
 * réessayer sur la même page, d'où des états qu'on continue de relire. Un
 * état qu'on ne connaît pas attend : on n'accorde jamais sur un mot nouveau.
 */
export function etatDepuisFedapay(statut: string | null | undefined): StatutPaiement {
  switch (statut) {
    case "approved":
    case "transferred":
      return "paye";
    case "declined":
      return "echoue";
    case "canceled":
    case "refunded":
    case "approved_partially_refunded":
    case "transferred_partially_refunded":
      return "annule";
    case "expired":
      return "expire";
    default:
      return "en_attente";
  }
}

export type EnvironnementPaiement = "sandbox" | "live";

/**
 * Ce compte peut-il payer ? Jamais sans clé FedaPay ; en bac à sable, les
 * superadmins seuls (le poste de dev et les aperçus écrivent dans la base de
 * production).
 *
 * LA MÊME QUESTION DÉCIDE DE CE QU'ON DEMANDE. Ne rien vendre à qui ne peut
 * pas payer va de soi ; ne pas le METTRE EN DEMEURE de payer compte autant :
 * des frais de réservation ouverts pour une équipe qui ne peut pas les régler
 * lui feraient perdre son créneau au bout de vingt-quatre heures, sans issue
 * (lib/reglement-serveur).
 */
export function paiementOuvert(e: { configure: boolean; environnement: EnvironnementPaiement; superadmin: boolean }): boolean {
  return e.configure && (e.environnement === "live" || e.superadmin);
}

/** Ce qui ne colle pas entre la ligne et la collecte relue chez FedaPay. */
export type AnomaliePaiement = "montant" | "reference";

/** Une tentative d'achat — `paiements/{id}`. Écrite par le serveur seul. */
/** Ce qu'un paiement achète : une formule (`pro`, quel que soit son droit), ou les frais de réservation d'un terrain (lib/reglement). */
export type ObjetPaiement = "pro" | "acompte";

/** L'objet d'une ligne ; les lignes d'avant les acomptes n'en portent pas : ce sont des achats d'une formule. */
export function objetDe(l: { objet?: ObjetPaiement | null }): ObjetPaiement {
  return l.objet === "acompte" ? "acompte" : "pro";
}

export interface FirestorePaiement {
  uid: string;
  /** Absent d'une ligne d'avant les acomptes : un achat d'une formule. */
  objet?: ObjetPaiement;
  /** La formule et le droit achetés ; `null` pour un acompte. */
  formule: IdFormule | null;
  droit: DroitOffre | null;
  /** Pour un acompte : la réservation dont il est l'acompte. */
  reservation_id?: string | null;
  /** Pour un acompte : la part de `montant` qui est des frais de paiement. */
  frais_client?: number;
  /** En XOF, entier : le total demandé à FedaPay, frais de paiement compris. */
  montant: number;
  devise: "XOF";
  statut: StatutPaiement;
  /** Le poste de dev et les aperçus écrivent dans la même base que la production. */
  environnement: EnvironnementPaiement;
  fedapay_id: number | null;
  /** L'état brut chez FedaPay, recopié à chaque relecture, même après `paye`. */
  fedapay_statut: string | null;
  mode: string | null;
  frais: number | null;
  recu_url: string | null;
  echeance_avant: string | null;
  echeance_apres: string | null;
  applique_le: unknown;
  anomalie: AnomaliePaiement | null;
  created_at: unknown;
  updated_at: unknown;
}

/** Ce qu'on lit d'une collecte FedaPay (lib/fedapay la normalise). */
export interface Collecte {
  id: number;
  statut: string;
  montant: number;
  /** Notre identifiant de ligne, tel que FedaPay le renvoie. */
  reference: string | null;
  mode: string | null;
  frais: number | null;
  recuUrl: string | null;
  /** Quand FedaPay libère les fonds de cette collecte (ISO) ; `null` s'il ne le dit pas. */
  disponibleLe: string | null;
}

export type Reglement =
  | { anomalie: AnomaliePaiement }
  | { anomalie: null; statut: StatutPaiement; accorder: boolean };

/**
 * Que faire d'une ligne, une fois sa collecte relue chez FedaPay ?
 *
 * La collecte doit être la nôtre et au montant demandé : sinon aucun droit,
 * et l'écart est noté pour l'administration. Une ligne déjà payée ne
 * s'accorde pas une seconde fois, quel que soit le nombre d'appels.
 */
export function deciderReglement(
  ligne: Pick<FirestorePaiement, "statut" | "montant">,
  idLigne: string,
  collecte: Pick<Collecte, "statut" | "montant" | "reference">,
): Reglement {
  if (collecte.reference !== idLigne) return { anomalie: "reference" };
  if (collecte.montant !== ligne.montant) return { anomalie: "montant" };
  if (ligne.statut === "paye") return { anomalie: null, statut: "paye", accorder: false };
  const statut = etatDepuisFedapay(collecte.statut);
  return { anomalie: null, statut, accorder: statut === "paye" };
}

/** Un identifiant de ligne : vingt caractères, ceux des identifiants Firestore. */
export const ID_PAIEMENT = /^[A-Za-z0-9]{20}$/;

/**
 * L'identifiant du paiement, lu dans l'adresse de retour (`?paiement=…`).
 *
 * FedaPay ajoute `id` et `status` à l'adresse qu'on lui a donnée. Elle porte
 * déjà un paramètre : s'il les colle avec un second « ? », le nôtre arrive
 * sous la forme « XYZ?id=258&status=approved ». On garde les vingt premiers
 * caractères quand ce qui suit commence par un séparateur, rien sinon.
 */
export function idPaiementDuRetour(valeur: string | null | undefined): string | null {
  const brut = valeur ?? "";
  const debut = brut.slice(0, 20);
  const suite = brut.slice(20);
  if (!ID_PAIEMENT.test(debut)) return null;
  return suite === "" || suite.startsWith("?") || suite.startsWith("&") ? debut : null;
}

/** Les deux échéances qu'on rappelle ce jour-là : la veille, et sept jours avant. */
export function joursDeRappel(jour: string): { demain: string; dansSeptJours: string } {
  return { demain: ajouterJours(jour, 1), dansSeptJours: ajouterJours(jour, 7) };
}

/** Au-delà, une ligne jamais payée ne le sera plus : FedaPay expire une collecte en 24 h. */
export const HEURES_DE_SUIVI = 48;

/**
 * Les lignes encore ouvertes que la tâche du matin relit (`recentes`), et
 * celles qu'elle relit une dernière fois avant de les fermer (`perimees`).
 * Celles d'un autre environnement ne la regardent pas : la production partage
 * sa base avec le bac à sable et ne peut pas relire ses collectes.
 */
export function trierLignesOuvertes<T extends { environnement: EnvironnementPaiement; creeMs: number }>(
  lignes: T[],
  environnement: EnvironnementPaiement,
  maintenantMs: number,
): { recentes: T[]; perimees: T[] } {
  const limite = maintenantMs - HEURES_DE_SUIVI * 3_600_000;
  const miennes = lignes.filter((l) => l.environnement === environnement);
  return {
    recentes: miennes.filter((l) => l.creeMs >= limite),
    perimees: miennes.filter((l) => l.creeMs < limite),
  };
}

/** Le motif écrit sur le droit, pour l'administration. */
export function motifAchat(droit: DroitOffre, mois: number, environnement: EnvironnementPaiement): string {
  return `Achat ${NOM_OFFRE[droit]} ${mois} mois${environnement === "live" ? "" : " (bac à sable)"}`;
}
