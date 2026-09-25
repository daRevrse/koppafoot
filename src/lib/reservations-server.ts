import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/fcm-server";
import { categorieDuType } from "@/lib/push-categories";
import { bookingRequestHtml, sendNotificationEmail } from "@/lib/email";
import { planTerrain, type ReservationLiee } from "@/lib/reservations";
import { dateLongue } from "@/lib/terrains";
import type {
  EtatReservationMatch, FirestoreBooking, FirestoreMatch, FirestoreReservationDuMatch,
  NotificationType, PropositionCreneau,
} from "@/types";

// ============================================
// Les réservations de terrain, côté serveur.
//
// POURQUOI LE SERVEUR. Trois gestes nouveaux ne passent pas par les règles
// Firestore telles qu'elles sont : une demande qui naît CONFIRMÉE (le
// propriétaire avait proposé ce créneau), un créneau que le propriétaire
// bloque lui-même, et le match qu'on met à jour quand le propriétaire répond
// — un document qu'il n'a pas le droit d'écrire. Les faire ici, avec le SDK
// admin, évite de déployer de nouvelles règles, et garde au même endroit la
// règle, l'écriture et la notification qui l'accompagne.
// ============================================

export class ErreurReservation extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** L'appelant, d'après son jeton. */
export async function appelant(req: Request): Promise<string> {
  const entete = req.headers.get("authorization");
  if (!entete?.startsWith("Bearer ")) throw new ErreurReservation("Compte requis", 401);
  try {
    return (await adminAuth.verifyIdToken(entete.split("Bearer ")[1])).uid;
  } catch {
    throw new ErreurReservation("Session expirée", 401);
  }
}

export interface Profil {
  prenom: string;
  nom: string;
  telephone: string | null;
  email: string | null;
}

export async function lireProfil(uid: string): Promise<Profil> {
  const d = (await adminDb.collection("users").doc(uid).get()).data() ?? {};
  const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
  const prenom = s(d.first_name) ?? "";
  return {
    prenom,
    nom: `${prenom} ${s(d.last_name) ?? ""}`.trim(),
    telephone: s(d.phone),
    email: s(d.email),
  };
}

/**
 * Prévenir quelqu'un : la cloche, le téléphone, et l'email quand il y en a un
 * à envoyer. Rien de tout ça ne fait échouer le geste qui l'a déclenché : la
 * réservation est écrite, elle vaut plus que son accusé de réception.
 */
export async function notifier(
  uid: string,
  n: { type: NotificationType; title: string; body: string; link: string },
  email?: { sujet: string; html: string },
): Promise<void> {
  const envois: Promise<unknown>[] = [
    adminDb.collection("notifications").add({
      user_id: uid,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read: false,
      created_at: FieldValue.serverTimestamp(),
    }),
    sendPushToUser(uid, { title: n.title, body: n.body, link: n.link, category: categorieDuType(n.type) }),
  ];
  if (email) {
    envois.push(
      lireProfil(uid).then((p) => (p.email ? sendNotificationEmail(p.email, email.sujet, email.html) : undefined)),
    );
  }
  const sorts = await Promise.allSettled(envois);
  sorts
    .filter((s): s is PromiseRejectedResult => s.status === "rejected")
    .forEach((s) => console.warn("[reservations] notification:", s.reason?.message ?? s.reason));
}

/** « samedi 10 octobre à 18:00 ». */
export const quand = (b: { date: string; time: string }) => `${dateLongue(b.date)} à ${b.time}`;

/** Prévenir le propriétaire d'une nouvelle demande : cloche, téléphone ET email. */
export async function annoncerDemande(
  ownerId: string,
  b: {
    venueName: string; date: string; time: string; demandeur: string;
    match?: string | null; telephone?: string | null; message?: string | null;
  },
): Promise<void> {
  const proprietaire = await lireProfil(ownerId);
  await notifier(
    ownerId,
    {
      type: "booking_request",
      title: b.match ? "Un match demande votre terrain" : "Demande de créneau",
      body: `${b.demandeur} demande ${b.venueName} le ${quand(b)}${b.match ? ` pour ${b.match}` : ""}.`,
      link: "/mes-terrains/reservations",
    },
    {
      sujet: `Nouvelle demande sur ${b.venueName}`,
      html: bookingRequestHtml(proprietaire.prenom || "toi", b.venueName, b.demandeur, quand(b), {
        match: b.match, telephone: b.telephone, message: b.message,
      }),
    },
  );
}

// ─── Le match et son terrain ────────────────────────────────

/** La réservation, recopiée sur le match pour que son manager la voie. */
export async function recopierSurLeMatch(
  matchId: string,
  valeur: FirestoreReservationDuMatch | null,
): Promise<void> {
  const ref = adminDb.collection("matches").doc(matchId);
  // Un match supprimé entre-temps n'a plus rien à recevoir.
  const snap = await ref.get();
  if (!snap.exists) return;
  await ref.update({ venue_booking: valeur, updated_at: FieldValue.serverTimestamp() });
}

export function surLeMatch(
  id: string,
  b: Pick<FirestoreBooking, "venue_id" | "venue_name">,
  status: EtatReservationMatch,
  proposition: PropositionCreneau | null = null,
): FirestoreReservationDuMatch {
  return { booking_id: id, venue_id: b.venue_id, venue_name: b.venue_name, status, proposition };
}

const libelleDuMatch = (m: FirestoreMatch) => `${m.home_team_name} vs ${m.away_team_name}`;

/**
 * Aligner la réservation du terrain sur l'état du match.
 *
 * Appelé après chaque geste sur un match (voir lib/reservations pour la
 * règle). Idempotent : l'appeler deux fois ne demande pas deux fois.
 *
 * Le demandeur est toujours celui qui a PROGRAMMÉ le match, même quand c'est
 * l'adversaire qui déclenche le calcul en refusant le défi : c'est lui que le
 * propriétaire doit pouvoir appeler.
 */
export async function synchroniserTerrain(
  matchId: string,
  uid: string,
): Promise<FirestoreReservationDuMatch | null> {
  const matchSnap = await adminDb.collection("matches").doc(matchId).get();
  const match = matchSnap.exists ? (matchSnap.data() as FirestoreMatch) : null;

  if (match && uid !== match.manager_id && uid !== match.away_manager_id) {
    throw new ErreurReservation("Ce match n'est pas le vôtre", 403);
  }

  // Un match SUPPRIMÉ ne dit plus qui en était le manager : on ne libère que
  // ce que l'appelant avait lui-même demandé.
  let requete = adminDb.collection("bookings").where("match_id", "==", matchId);
  if (!match) requete = requete.where("user_id", "==", uid);
  const liees = (await requete.get()).docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() as FirestoreBooking }));

  const plan = planTerrain(
    match
      ? {
          status: match.status,
          venueId: match.venue_id ?? null,
          date: match.date,
          time: match.time,
          format: match.format,
        }
      : null,
    liees.map((b): ReservationLiee => ({
      id: b.id,
      venueId: b.data.venue_id,
      date: b.data.date,
      time: b.data.time,
      status: b.data.status,
      cancelledBy: b.data.cancelled_by ?? null,
      proposition: b.data.proposition ?? null,
    })),
  );

  // 1. Libérer ce qui ne correspond plus, et le dire au propriétaire : c'est
  //    un créneau qu'il peut redonner.
  for (const id of plan.liberer) {
    const b = liees.find((x) => x.id === id)!;
    await b.ref.update({ status: "cancelled", cancelled_by: "systeme", updated_at: FieldValue.serverTimestamp() });
    if (b.data.owner_id !== b.data.user_id) {
      await notifier(b.data.owner_id, {
        type: "booking_answer",
        title: "Créneau libéré",
        body: `${b.data.match_label ?? "Le match"} ne se jouera pas sur ${b.data.venue_name} le ${quand(b.data)}.`,
        link: "/mes-terrains/reservations",
      });
    }
  }

  if (!match) return null;

  // 2. Ce que le match doit afficher.
  if (plan.garder) {
    const b = liees.find((x) => x.id === plan.garder)!;
    const valeur = surLeMatch(b.id, b.data, b.data.status === "confirmed" ? "confirmed" : "pending");
    await recopierSurLeMatch(matchId, valeur);
    return valeur;
  }

  if (plan.refus) {
    const b = liees.find((x) => x.id === plan.refus!.id)!;
    const valeur = surLeMatch(b.id, b.data, "refused", b.data.proposition ?? null);
    await recopierSurLeMatch(matchId, valeur);
    return valeur;
  }

  if (!plan.demander) {
    await recopierSurLeMatch(matchId, null);
    return null;
  }

  // 3. Demander le créneau.
  const venueSnap = await adminDb.collection("venues").doc(plan.demander.venueId).get();
  const venue = venueSnap.data();
  if (!venueSnap.exists || typeof venue?.owner_id !== "string") {
    // Le terrain a été retiré de l'annuaire : il n'y a plus personne à qui
    // demander. Le match garde son nom de lieu, sans réservation.
    await recopierSurLeMatch(matchId, null);
    return null;
  }

  const demandeur = await lireProfil(match.manager_id);
  // SON PROPRE TERRAIN : le propriétaire qui programme un match chez lui n'a
  // pas à se demander la permission.
  const chezLui = venue.owner_id === match.manager_id;
  const confirmee = plan.demander.confirmee || chezLui;

  const nouvelle: Omit<FirestoreBooking, "created_at" | "updated_at"> = {
    venue_id: plan.demander.venueId,
    venue_name: String(venue.name ?? match.venue_name ?? "Terrain"),
    owner_id: venue.owner_id,
    user_id: match.manager_id,
    user_name: demandeur.nom || "Un manager",
    date: plan.demander.date,
    time: plan.demander.time,
    duration: plan.demander.duration,
    total_price: 0,
    status: confirmee ? "confirmed" : "pending",
    kind: "match",
    match_id: matchId,
    match_label: libelleDuMatch(match),
    contact: { telephone: demandeur.telephone, email: demandeur.email },
    message: null,
    proposition: null,
    note: null,
    cancelled_by: null,
  };
  const ref = await adminDb.collection("bookings").add({
    ...nouvelle,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  if (!chezLui) {
    if (confirmee) {
      await notifier(venue.owner_id, {
        type: "booking_answer",
        title: "Votre proposition est prise",
        body: `${nouvelle.match_label} se jouera sur ${nouvelle.venue_name} le ${quand(nouvelle)}.`,
        link: "/mes-terrains/reservations",
      });
    } else {
      await annoncerDemande(venue.owner_id, {
        venueName: nouvelle.venue_name,
        date: nouvelle.date,
        time: nouvelle.time,
        demandeur: nouvelle.user_name,
        match: nouvelle.match_label,
        telephone: demandeur.telephone,
      });
    }
  }

  const valeur = surLeMatch(ref.id, nouvelle, confirmee ? "confirmed" : "pending");
  await recopierSurLeMatch(matchId, valeur);
  return valeur;
}
