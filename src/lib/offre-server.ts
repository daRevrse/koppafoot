import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  CODE_LIMITE, LIMITES_GRATUIT, estPro, jourDeLome, limitesEnVigueur, messageLimite,
  type CleLimite, type FirestoreDroits, type LimiteAtteinte,
} from "@/lib/offre";

// ============================================
// L'offre, côté serveur : lire les droits d'un compte, compter ce qu'il a
// déjà, et dire si une création passe.
//
// C'EST ICI QUE LES LIMITES TIENNENT. Une règle Firestore ne sait pas compter
// des documents : les quatre créations limitées (équipe, terrain,
// compétition, équipe d'une compétition) passent donc par des routes qui
// appellent ce module, et les règles ferment la création directe.
//
// Un compte qui ne peut plus créer ne perd rien : la vérification ne regarde
// que le geste en cours, voir lib/offre.
// ============================================

/** L'appelant, d'après son jeton ; `null` sans jeton valable. */
export async function uidAppelant(req: Request): Promise<string | null> {
  const entete = req.headers.get("authorization");
  if (!entete?.startsWith("Bearer ")) return null;
  try {
    return (await adminAuth.verifyIdToken(entete.slice(7))).uid;
  } catch {
    return null;
  }
}

export async function lireDroits(uid: string): Promise<FirestoreDroits | null> {
  const snap = await adminDb.collection("droits").doc(uid).get();
  return snap.exists ? (snap.data() as FirestoreDroits) : null;
}

/** La date d'entrée en vigueur des limites, ou `null` tant qu'elle n'est pas fixée. */
export async function lireLimitesDepuis(): Promise<string | null> {
  const snap = await adminDb.collection("settings").doc("offre").get();
  const v = snap.data()?.limites_depuis;
  return typeof v === "string" ? v : null;
}

type CleCompte = Exclude<CleLimite, "equipesParCompetition">;

const nombre = (q: FirebaseFirestore.Query) => q.count().get().then((s) => s.data().count);

/** Ce que le compte a déjà, compté comme les limites le comptent. */
export async function compterUsage(uid: string): Promise<Record<CleCompte, number>> {
  const [equipes, terrains, competitions] = await Promise.all([
    nombre(adminDb.collection("teams").where("manager_id", "==", uid)),
    nombre(adminDb.collection("venues").where("owner_id", "==", uid)),
    // « En cours » = pas terminée, brouillons compris ; les compétitions
    // d'entraînement ne comptent pas. Le filtre se fait ici : un compte
    // crée quelques compétitions, pas des milliers, et on évite un index.
    adminDb.collection("competitions").where("created_by", "==", uid).get().then((s) =>
      s.docs.filter((d) => d.data().status !== "completed" && d.data().is_sandbox !== true).length),
  ]);
  return { equipes, terrains, competitions };
}

/** La journée d'un horodatage Firestore ou d'une chaîne ISO ; `null` si illisible. */
function jourDe(x: unknown): string | null {
  if (typeof x === "string") return /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 10) : null;
  if (x && typeof (x as { toDate?: () => Date }).toDate === "function") {
    return jourDeLome((x as { toDate: () => Date }).toDate());
  }
  return null;
}

/**
 * Le compte peut-il créer encore une équipe, un terrain, une compétition ?
 * `null` : oui. Sinon, la limite qui bloque.
 */
export async function limiteDeCreation(uid: string, cle: CleCompte): Promise<LimiteAtteinte | null> {
  const jour = jourDeLome();
  if (!limitesEnVigueur(await lireLimitesDepuis(), jour)) return null;
  if (estPro(await lireDroits(uid), jour)) return null;
  const usage = (await compterUsage(uid))[cle];
  const max = LIMITES_GRATUIT[cle];
  return usage >= max ? { code: CODE_LIMITE, cle, max } : null;
}

/**
 * La compétition peut-elle accueillir `ajout` équipes de plus ?
 *
 * Jamais plafonnée si elle est née avant l'entrée en vigueur des limites (on
 * ne bloque pas une compétition qui a démarré sous l'ancienne règle), ni si
 * l'un de ses organisateurs a le Pro.
 */
export async function limiteEquipesDeCompetition(
  cid: string,
  competition: { organizer_ids?: string[]; created_at?: unknown; is_sandbox?: boolean },
  ajout = 1,
): Promise<LimiteAtteinte | null> {
  const jour = jourDeLome();
  const depuis = await lireLimitesDepuis();
  if (!limitesEnVigueur(depuis, jour) || competition.is_sandbox) return null;
  const nee = jourDe(competition.created_at);
  if (!nee || nee < depuis!) return null;
  const droits = await Promise.all((competition.organizer_ids ?? []).map(lireDroits));
  if (droits.some((d) => estPro(d, jour))) return null;
  const n = await nombre(adminDb.collection("competitions").doc(cid).collection("comp_teams"));
  const max = LIMITES_GRATUIT.equipesParCompetition;
  return n + ajout > max ? { code: CODE_LIMITE, cle: "equipesParCompetition", max } : null;
}

/** La réponse d'une route bloquée par une limite : le message, et de quoi le traduire. */
export function reponseLimite(l: LimiteAtteinte): NextResponse {
  return NextResponse.json({ error: messageLimite(l.cle, l.max), ...l }, { status: 403 });
}
