import { ID_PAIEMENT, type Collecte, type EnvironnementPaiement } from "@/lib/paiement";

// ============================================
// FedaPay : créer une collecte, obtenir sa page de paiement, la relire.
//
// TROIS APPELS, EN `fetch`. Le SDK officiel apporte axios et une clé rangée
// dans un état global (`FedaPay.setApiKey`), pour ce qui tient ici en une
// fonction : on s'en passe.
//
// L'ENVELOPPE DES RÉPONSES N'EST PAS DOCUMENTÉE. La référence d'API montre la
// collecte à plat, le SDK la lit sous une clé `transaction` après avoir retiré
// un préfixe de version (`v1/transaction`). `deballer` accepte les trois.
//
// ON NE CROIT QUE CE QU'ON RELIT. Le retour du client sur le site ne prouve
// rien (la doc le dit), et le contenu d'un webhook, même signé, ne sert qu'à
// savoir quelle collecte relire : `lireCollecte` est la seule source de l'état.
//
// AUCUN MODULE NODE ICI : le HMAC de la signature est fourni par l'appelant
// (la route du webhook). Le fichier reste ainsi importable par les tests, qui
// tournent dans mobile/src/__tests__/fedapay.test.ts.
// ============================================

/** `live` seulement quand la variable le dit ; tout le reste est le bac à sable. */
export function environnementFedapay(): EnvironnementPaiement {
  return process.env.FEDAPAY_ENV === "live" ? "live" : "sandbox";
}

/** Sans clé secrète, rien n'est en vente. */
export function fedapayConfigure(): boolean {
  return Boolean(process.env.FEDAPAY_SECRET_KEY);
}

const base = (): string =>
  environnementFedapay() === "live" ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1";

/** Un refus ou une panne de FedaPay. `status` : le code HTTP, 0 si l'appel n'est pas parti. */
export class ErreurFedapay extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ErreurFedapay";
  }
}

async function appel(methode: "GET" | "POST", chemin: string, corps?: unknown): Promise<unknown> {
  const cle = process.env.FEDAPAY_SECRET_KEY;
  if (!cle) throw new ErreurFedapay("FEDAPAY_SECRET_KEY absente", 0);
  let res: Response;
  try {
    res = await fetch(`${base()}${chemin}`, {
      method: methode,
      headers: {
        Authorization: `Bearer ${cle}`,
        Accept: "application/json",
        ...(corps ? { "Content-Type": "application/json" } : {}),
      },
      body: corps ? JSON.stringify(corps) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new ErreurFedapay(`FedaPay injoignable : ${err instanceof Error ? err.message : String(err)}`, 0);
  }
  const texte = await res.text();
  if (!res.ok) throw new ErreurFedapay(`FedaPay ${res.status} sur ${methode} ${chemin} : ${texte.slice(0, 300)}`, res.status);
  try {
    return JSON.parse(texte) as unknown;
  } catch {
    throw new ErreurFedapay(`Réponse FedaPay illisible sur ${methode} ${chemin}`, res.status);
  }
}

/** L'objet utile d'une réponse, qu'il arrive sous `v1/<nom>`, sous `<nom>`, ou à plat. */
export function deballer(corps: unknown, nom: string): Record<string, unknown> {
  const c = (corps && typeof corps === "object" ? corps : {}) as Record<string, unknown>;
  const dedans = c[`v1/${nom}`] ?? c[nom];
  return (dedans && typeof dedans === "object" ? dedans : c) as Record<string, unknown>;
}

const texte = (x: unknown): string | null => (typeof x === "string" && x ? x : null);
const nombre = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** Notre identifiant de ligne, là où FedaPay le renvoie. */
function referenceDe(brut: Record<string, unknown>): string | null {
  const meta = (brut.custom_metadata && typeof brut.custom_metadata === "object" ? brut.custom_metadata : {}) as Record<string, unknown>;
  return texte(brut.merchant_reference) ?? texte(meta.paiement_id);
}

/** Une collecte telle que l'API la rend, réduite à ce qu'on en lit ; `null` si ce n'en est pas une. */
export function normaliserCollecte(brut: Record<string, unknown>): Collecte | null {
  const id = Number(brut.id);
  if (!Number.isInteger(id) || id <= 0 || typeof brut.status !== "string") return null;
  return {
    id,
    statut: brut.status,
    // Illisible, il vaut NaN : jamais égal au montant demandé, donc jamais d'octroi.
    montant: typeof brut.amount === "number" ? brut.amount : Number.NaN,
    reference: referenceDe(brut),
    mode: texte(brut.mode),
    frais: nombre(brut.fees),
    recuUrl: texte(brut.receipt_url),
    disponibleLe: texte(brut.to_be_transferred_at),
  };
}

export interface DemandeCollecte {
  /** L'identifiant de la ligne `paiements` : unique chez FedaPay, un doublon fait échouer la création. */
  reference: string;
  description: string;
  /** En XOF, entier. */
  montant: number;
  /** Où FedaPay renvoie le client. */
  retour: string;
  client: { prenom: string; nom: string; email: string | null };
}

/**
 * Le corps de `POST /transactions`.
 *
 * LE CLIENT N'EST ENVOYÉ QUE COMPLET. Un compte créé par SMS n'a pas
 * d'e-mail : plutôt qu'un client à moitié rempli que FedaPay refuserait, on
 * n'en envoie pas, et la page de paiement le demande elle-même.
 *
 * JAMAIS LE TÉLÉPHONE : celui du profil n'est pas forcément celui du
 * portefeuille. Le client le tape sur la page de paiement.
 */
export function corpsCollecte(d: DemandeCollecte): Record<string, unknown> {
  const prenom = d.client.prenom.trim();
  const nom = d.client.nom.trim();
  const email = d.client.email?.trim() ?? "";
  const complet = Boolean(prenom && nom && /^\S+@\S+\.\S+$/.test(email));
  return {
    description: d.description,
    amount: d.montant,
    currency: { iso: "XOF" },
    callback_url: d.retour,
    merchant_reference: d.reference,
    custom_metadata: { paiement_id: d.reference },
    ...(complet ? { customer: { firstname: prenom, lastname: nom, email } } : {}),
  };
}

export async function creerCollecte(d: DemandeCollecte): Promise<Collecte> {
  const collecte = normaliserCollecte(deballer(await appel("POST", "/transactions", corpsCollecte(d)), "transaction"));
  if (!collecte) throw new ErreurFedapay("Collecte FedaPay illisible à la création", 200);
  return collecte;
}

/** L'adresse de la page de paiement d'une collecte. */
export async function lienDePaiement(idCollecte: number): Promise<string> {
  const corps = deballer(await appel("POST", `/transactions/${idCollecte}/token`), "token");
  const url = texte(corps.url);
  if (!url || !url.startsWith("https://")) throw new ErreurFedapay("Lien de paiement FedaPay illisible", 200);
  return url;
}

async function lire(chemin: string): Promise<Collecte | null> {
  try {
    return normaliserCollecte(deballer(await appel("GET", chemin), "transaction"));
  } catch (err) {
    if (err instanceof ErreurFedapay && err.status === 404) return null;
    throw err;
  }
}

/** La collecte, relue chez FedaPay ; `null` si elle n'existe pas. */
export function lireCollecte(idCollecte: number): Promise<Collecte | null> {
  return lire(`/transactions/${idCollecte}`);
}

/** La même, retrouvée par notre référence : pour une ligne qui n'a pas encore son identifiant FedaPay. */
export function lireCollecteParReference(reference: string): Promise<Collecte | null> {
  return lire(`/transactions/merchant/${encodeURIComponent(reference)}`);
}

/** L'écart toléré entre l'horodatage d'un webhook et maintenant, en secondes (celui du SDK). */
export const TOLERANCE_SIGNATURE_S = 300;

/** Compare deux chaînes sans s'arrêter au premier écart. */
function egalATempsConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let ecart = 0;
  for (let i = 0; i < a.length; i += 1) ecart |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ecart === 0;
}

/**
 * Ce webhook vient-il de FedaPay ?
 *
 * L'en-tête `X-FEDAPAY-SIGNATURE` vaut `t=<secondes>,s=<hex>` : `s` est le
 * HMAC-SHA256 de `<t>.<corps brut>` avec le secret de l'endpoint. Le corps
 * doit être celui reçu, octet pour octet : le relire après `JSON.parse` le
 * changerait.
 *
 * `hmacHex` calcule ce HMAC pour le secret ; il est fourni par l'appelant
 * pour que ce fichier n'importe aucun module Node.
 */
export function signatureValide(
  corps: string,
  entete: string | null | undefined,
  hmacHex: (message: string) => string,
  maintenantS: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!entete) return false;
  let t: string | null = null;
  const signatures: string[] = [];
  for (const morceau of entete.split(",")) {
    const i = morceau.indexOf("=");
    if (i < 0) continue;
    const cle = morceau.slice(0, i).trim();
    const valeur = morceau.slice(i + 1).trim();
    if (cle === "t" && /^\d+$/.test(valeur)) t = valeur;
    if (cle === "s" && /^[0-9a-fA-F]{64}$/.test(valeur)) signatures.push(valeur.toLowerCase());
  }
  if (t === null || signatures.length === 0) return false;
  if (maintenantS - Number(t) > TOLERANCE_SIGNATURE_S) return false;
  const attendue = hmacHex(`${t}.${corps}`).toLowerCase();
  return signatures.some((s) => egalATempsConstant(s, attendue));
}

/**
 * De quelle collecte parle cet événement ? `null` s'il ne nous concerne pas.
 *
 * On n'y lit que de quoi retrouver la ligne : notre référence, à défaut
 * l'identifiant FedaPay. L'état, lui, se relit toujours chez FedaPay.
 */
export function cibleDeLEvenement(evenement: unknown): { reference: string | null; idCollecte: number | null } | null {
  const e = (evenement && typeof evenement === "object" ? evenement : {}) as Record<string, unknown>;
  if (typeof e.name !== "string" || !e.name.startsWith("transaction.")) return null;
  const brut = e.entity ?? e.object ?? e.data;
  if (!brut || typeof brut !== "object") return null;
  const entite = brut as Record<string, unknown>;
  const ref = referenceDe(entite);
  const reference = ref && ID_PAIEMENT.test(ref) ? ref : null;
  const id = Number(entite.id);
  const idCollecte = Number.isInteger(id) && id > 0 ? id : null;
  return reference || idCollecte ? { reference, idCollecte } : null;
}
