import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/fcm-server";
import { categorieDuType } from "@/lib/push-categories";
import { bookingRequestHtml, bookingRequestsDigestHtml, sendNotificationEmail } from "@/lib/email";
import { planTerrain, type MatchPourTerrain, type ReservationLiee } from "@/lib/reservations";
import { dateLongue, dureeEnCompetition } from "@/lib/terrains";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { matchDuration } from "@/lib/competition-format";
import type {
  CompetitionFormat, EtatReservationMatch, FirestoreBooking, FirestoreCompMatch, FirestoreMatch,
  FirestoreReservationDuMatch, NotificationType, PropositionCreneau,
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

/** Une demande à annoncer au propriétaire. */
export interface Annonce {
  venueName: string; date: string; time: string; demandeur: string;
  match?: string | null; telephone?: string | null; message?: string | null;
}

/** Prévenir le propriétaire d'une nouvelle demande : cloche, téléphone ET email. */
export async function annoncerDemande(ownerId: string, b: Annonce): Promise<void> {
  const proprietaire = await lireProfil(ownerId);
  await notifier(
    ownerId,
    {
      type: "booking_request",
      title: b.match ? "Un match demande ton terrain" : "Demande de créneau",
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

/**
 * Un match, amical ou de compétition.
 *
 * Les deux vivent à des endroits différents — `matches/{mid}` et
 * `competitions/{cid}/comp_matches/{mid}` — et la réservation retient
 * lequel (`competition_id`) : c'est le seul moyen de retrouver le match à
 * mettre à jour quand le propriétaire répond.
 */
export interface RefMatch {
  mid: string;
  cid?: string | null;
}

const documentDuMatch = (ref: RefMatch) =>
  ref.cid
    ? adminDb.collection("competitions").doc(ref.cid).collection("comp_matches").doc(ref.mid)
    : adminDb.collection("matches").doc(ref.mid);

/** Où le demandeur suit la réponse : ses matchs, ou le calendrier de sa compétition. */
export const lienDuMatch = (ref: RefMatch) =>
  ref.cid ? `/organizer/competitions/${ref.cid}/schedule` : "/matches";

/** La réservation, recopiée sur le match pour que son manager la voie. */
export async function recopierSurLeMatch(
  ref: RefMatch,
  valeur: FirestoreReservationDuMatch | null,
): Promise<void> {
  const doc = documentDuMatch(ref);
  // Un match supprimé entre-temps n'a plus rien à recevoir.
  const snap = await doc.get();
  if (!snap.exists) return;
  await doc.update({ venue_booking: valeur, updated_at: FieldValue.serverTimestamp() });
}

export function surLeMatch(
  id: string,
  b: Pick<FirestoreBooking, "venue_id" | "venue_name">,
  status: EtatReservationMatch,
  proposition: PropositionCreneau | null = null,
): FirestoreReservationDuMatch {
  return { booking_id: id, venue_id: b.venue_id, venue_name: b.venue_name, status, proposition };
}

/**
 * Annoncer des demandes, groupées par propriétaire.
 *
 * UNE JOURNÉE DE CHAMPIONNAT, UN EMAIL. Chaque demande sonne dans l'appli —
 * c'est là qu'on y répond — mais vingt emails pour les vingt matchs d'un
 * calendrier, c'est une boîte qu'on ne lit plus. Au-delà d'une demande, le
 * propriétaire reçoit un récapitulatif.
 */
export async function annoncer(annonces: (Annonce & { ownerId: string })[]): Promise<void> {
  const parProprietaire = new Map<string, (Annonce & { ownerId: string })[]>();
  for (const a of annonces) {
    const liste = parProprietaire.get(a.ownerId) ?? [];
    liste.push(a);
    parProprietaire.set(a.ownerId, liste);
  }
  for (const [ownerId, liste] of parProprietaire) {
    if (liste.length === 1) {
      await annoncerDemande(ownerId, liste[0]);
      continue;
    }
    for (const a of liste) {
      await notifier(ownerId, {
        type: "booking_request",
        title: a.match ? "Un match demande ton terrain" : "Demande de créneau",
        body: `${a.demandeur} demande ${a.venueName} le ${quand(a)}${a.match ? ` pour ${a.match}` : ""}.`,
        link: "/mes-terrains/reservations",
      });
    }
    const proprietaire = await lireProfil(ownerId);
    if (proprietaire.email) {
      await sendNotificationEmail(
        proprietaire.email,
        `${liste.length} demandes de créneau sur tes terrains`,
        bookingRequestsDigestHtml(
          proprietaire.prenom || "toi",
          liste.map((a) => ({ terrain: a.venueName, quand: quand(a), match: a.match ?? null, demandeur: a.demandeur })),
        ),
      ).catch((e) => console.warn("[reservations] récapitulatif:", e?.message ?? e));
    }
  }
}

/** Ce qu'il faut savoir d'un match pour lui demander un terrain. */
interface MatchLu {
  etat: MatchPourTerrain | null;
  /** Celui au nom de qui la demande part. */
  demandeurId: string;
  libelle: string;
}

/**
 * Lire le match, et vérifier que l'appelant a la main dessus.
 *
 * AMICAL : l'un des deux managers ; le demandeur est celui qui l'a programmé,
 * même quand c'est l'adversaire qui déclenche le calcul en refusant le défi —
 * c'est lui que le propriétaire doit pouvoir appeler.
 *
 * COMPÉTITION : un organisateur ou un modérateur de la compétition ; le
 * demandeur est celui qui programme. La durée vient du format de la
 * compétition (voir `dureeEnCompetition`).
 */
async function lireLeMatch(ref: RefMatch, uid: string): Promise<MatchLu | null> {
  const snap = await documentDuMatch(ref).get();

  if (!ref.cid) {
    if (!snap.exists) return null;
    const m = snap.data() as FirestoreMatch;
    if (uid !== m.manager_id && uid !== m.away_manager_id) {
      throw new ErreurReservation("Ce match n'est pas le tien", 403);
    }
    return {
      etat: { status: m.status, venueId: m.venue_id ?? null, date: m.date, time: m.time, format: m.format },
      demandeurId: m.manager_id,
      libelle: `${m.home_team_name} vs ${m.away_team_name}`,
    };
  }

  const comp = (await adminDb.collection("competitions").doc(ref.cid).get()).data();
  if (!comp) throw new ErreurReservation("Compétition introuvable", 404);
  const equipe = [...(comp.organizer_ids ?? []), ...(comp.moderator_ids ?? [])] as string[];
  if (!equipe.includes(uid)) {
    const profil = (await adminDb.collection("users").doc(uid).get()).data();
    if (!estSuperadmin(profil)) throw new ErreurReservation("Cette compétition n'est pas la tienne", 403);
  }
  if (!snap.exists) return null;

  const m = snap.data() as FirestoreCompMatch;
  return {
    etat: {
      status: m.status,
      venueId: m.venue_id ?? null,
      date: m.date ?? "",
      time: m.time ?? "",
      format: "",
      duree: dureeEnCompetition(matchDuration((comp.format ?? {}) as CompetitionFormat)),
    },
    demandeurId: uid,
    libelle: `${comp.name ?? "Compétition"} · ${m.home_team_name || "À déterminer"} vs ${m.away_team_name || "À déterminer"}`,
  };
}

/**
 * Aligner la réservation du terrain sur l'état du match.
 *
 * Appelé après chaque geste sur un match (voir lib/reservations pour la
 * règle). Idempotent : l'appeler deux fois ne demande pas deux fois.
 *
 * `annonces` : quand il est fourni, les nouvelles demandes y sont RANGÉES au
 * lieu d'être annoncées tout de suite — l'appelant qui synchronise tout un
 * calendrier les annonce ensuite d'un coup (voir `annoncer`).
 */
export async function synchroniserTerrain(
  refOuMid: RefMatch | string,
  uid: string,
  annonces?: (Annonce & { ownerId: string })[],
): Promise<FirestoreReservationDuMatch | null> {
  const ref: RefMatch = typeof refOuMid === "string" ? { mid: refOuMid } : refOuMid;
  const lu = await lireLeMatch(ref, uid);

  // Les réservations de CE match : même identifiant, même compétition (ou
  // aucune). Un amical SUPPRIMÉ ne dit plus qui en était le manager : on ne
  // libère que ce que l'appelant avait lui-même demandé.
  const liees = (await adminDb.collection("bookings").where("match_id", "==", ref.mid).get()).docs
    .map((d) => ({ id: d.id, ref: d.ref, data: d.data() as FirestoreBooking }))
    .filter((b) => (b.data.competition_id ?? null) === (ref.cid ?? null))
    .filter((b) => lu || ref.cid || b.data.user_id === uid);

  const plan = planTerrain(
    lu?.etat ?? null,
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

  if (!lu) return null;

  // 2. Ce que le match doit afficher.
  if (plan.garder) {
    const b = liees.find((x) => x.id === plan.garder)!;
    const valeur = surLeMatch(b.id, b.data, b.data.status === "confirmed" ? "confirmed" : "pending");
    await recopierSurLeMatch(ref, valeur);
    return valeur;
  }

  if (plan.refus) {
    const b = liees.find((x) => x.id === plan.refus!.id)!;
    const valeur = surLeMatch(b.id, b.data, "refused", b.data.proposition ?? null);
    await recopierSurLeMatch(ref, valeur);
    return valeur;
  }

  if (!plan.demander) {
    await recopierSurLeMatch(ref, null);
    return null;
  }

  // 3. Demander le créneau.
  const venueSnap = await adminDb.collection("venues").doc(plan.demander.venueId).get();
  const venue = venueSnap.data();
  if (!venueSnap.exists || typeof venue?.owner_id !== "string") {
    // Le terrain a été retiré de l'annuaire : il n'y a plus personne à qui
    // demander. Le match garde son nom de lieu, sans réservation.
    await recopierSurLeMatch(ref, null);
    return null;
  }

  const demandeur = await lireProfil(lu.demandeurId);
  // SON PROPRE TERRAIN : le propriétaire qui programme un match chez lui n'a
  // pas à se demander la permission.
  const chezLui = venue.owner_id === lu.demandeurId;
  const confirmee = plan.demander.confirmee || chezLui;

  const nouvelle: Omit<FirestoreBooking, "created_at" | "updated_at"> = {
    venue_id: plan.demander.venueId,
    venue_name: String(venue.name ?? "Terrain"),
    owner_id: venue.owner_id,
    user_id: lu.demandeurId,
    user_name: demandeur.nom || (ref.cid ? "Un organisateur" : "Un manager"),
    date: plan.demander.date,
    time: plan.demander.time,
    duration: plan.demander.duration,
    total_price: 0,
    status: confirmee ? "confirmed" : "pending",
    kind: "match",
    match_id: ref.mid,
    competition_id: ref.cid ?? null,
    match_label: lu.libelle,
    contact: { telephone: demandeur.telephone, email: demandeur.email },
    message: null,
    proposition: null,
    note: null,
    cancelled_by: null,
  };
  const cree = await adminDb.collection("bookings").add({
    ...nouvelle,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  if (!chezLui) {
    if (confirmee) {
      await notifier(venue.owner_id, {
        type: "booking_answer",
        title: "Ta proposition est prise",
        body: `${nouvelle.match_label} se jouera sur ${nouvelle.venue_name} le ${quand(nouvelle)}.`,
        link: "/mes-terrains/reservations",
      });
    } else {
      const annonce = {
        ownerId: venue.owner_id,
        venueName: nouvelle.venue_name,
        date: nouvelle.date,
        time: nouvelle.time,
        demandeur: nouvelle.user_name,
        match: nouvelle.match_label,
        telephone: demandeur.telephone,
      };
      if (annonces) annonces.push(annonce);
      else await annoncerDemande(venue.owner_id, annonce);
    }
  }

  const valeur = surLeMatch(cree.id, nouvelle, confirmee ? "confirmed" : "pending");
  await recopierSurLeMatch(ref, valeur);
  return valeur;
}
