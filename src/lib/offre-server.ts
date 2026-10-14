import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  CODE_LIMITE, LIMITES_GRATUIT, estPro, jourDeLome, koppaFootPlusLeve, limitesEnVigueur, messageLimite, titresDuProfil,
  type Avantage, type CleLimite, type FirestoreDroits, type LimiteAtteinte, type Titres,
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
// KOPPAFOOT+ NE LÈVE QUE CE QUE LE COMPTE EST. Avoir le droit ne suffit pas :
// il faut le titre qui va avec (lib/offre, koppaFootPlusLeve). Un joueur
// organisateur qui a KoppaFoot+ mène autant de compétitions qu'il veut, mais
// son plafond d'équipes tient. D'où `plusLeve`, que tout passe par lui.
//
// Un compte qui ne peut plus créer ne perd rien : la vérification ne regarde
// que le geste en cours, voir lib/offre.
// ============================================

export { uidAppelant } from "@/lib/appelant";

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

/** Ce que le compte est, pour l'offre : manager, organisateur, gérant. */
export async function lireTitres(uid: string): Promise<Titres> {
  return titresDuProfil((await adminDb.collection("users").doc(uid).get()).data());
}

/** Le compte a-t-il le rôle manager ? Le staff d'une équipe ne le donne pas. */
export async function estManager(uid: string): Promise<boolean> {
  return (await lireTitres(uid)).manager;
}

/** KoppaFoot+ lève-t-il cet avantage pour ce compte ? Il faut le droit ET le titre. */
export async function plusLeve(uid: string, avantage: Avantage, jour: string = jourDeLome()): Promise<boolean> {
  const [droits, titres] = await Promise.all([lireDroits(uid), lireTitres(uid)]);
  return estPro(droits, jour) && koppaFootPlusLeve(titres, avantage);
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
  if (await plusLeve(uid, cle, jour)) return null;
  const usage = (await compterUsage(uid))[cle];
  const max = LIMITES_GRATUIT[cle];
  return usage >= max ? { code: CODE_LIMITE, cle, max } : null;
}

/**
 * La compétition peut-elle accueillir `ajout` équipes de plus ?
 *
 * Jamais plafonnée si elle est née avant l'entrée en vigueur des limites (on
 * ne bloque pas une compétition qui a démarré sous l'ancienne règle), ni si
 * l'un de ses organisateurs a KoppaFoot+ avec la casquette.
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
  const leves = await Promise.all((competition.organizer_ids ?? []).map((o) => plusLeve(o, "equipesParCompetition", jour)));
  if (leves.some(Boolean)) return null;
  // Les équipes invitées n'en font pas partie (voir lib/exhibition). Compter
  // « toutes, moins les invitées » : une requête `!=` écarterait aussi les
  // équipes sans le champ, c'est-à-dire presque toutes.
  const equipes = adminDb.collection("competitions").doc(cid).collection("comp_teams");
  const [toutes, invitees] = await Promise.all([nombre(equipes), nombre(equipes.where("invitee", "==", true))]);
  const n = toutes - invitees;
  const max = LIMITES_GRATUIT.equipesParCompetition;
  return n + ajout > max ? { code: CODE_LIMITE, cle: "equipesParCompetition", max } : null;
}

/** La réponse d'une route bloquée par une limite : le message, et de quoi le traduire. */
export function reponseLimite(l: LimiteAtteinte): NextResponse {
  return NextResponse.json({ error: messageLimite(l.cle, l.max), ...l }, { status: 403 });
}
