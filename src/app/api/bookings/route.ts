import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  ErreurReservation, annoncerDemande, appelant, lireProfil,
} from "@/lib/reservations-server";
import { horairesLus, horsHoraires } from "@/lib/terrains";
import type { FirestoreBooking } from "@/types";

// ============================================
// POST /api/bookings, demander un créneau, ou en bloquer un.
//
// DEUX GESTES, UNE ADRESSE, parce qu'ils écrivent la même chose — un créneau
// sur un terrain — et que le propriétaire doit les voir dans la même liste :
//
//  - une ÉQUIPE demande un créneau depuis la fiche du terrain. Il lui faut un
//    téléphone : c'est avec lui que le propriétaire réglera le reste, le
//    paiement compris, puisque la plateforme n'encaisse rien. Et le créneau
//    doit tenir dans les horaires d'ouverture, quand le propriétaire en a
//    posé ;
//  - le PROPRIÉTAIRE bloque un créneau pris ailleurs — un habitué, un appel.
//    Sans ça, les équipes demandaient des soirs déjà pris, et il refusait à
//    la main ce que la fiche aurait pu leur dire. Un habitué revient chaque
//    semaine : le blocage peut se RÉPÉTER jusqu'à une date, en une série
//    qu'on débloque d'un geste (voir `serie_id`).
//
// Les demandes nées d'un MATCH ne passent pas ici : voir
// /api/matches/[mid]/terrain, qui les tient alignées sur le match.
// ============================================

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DUREES = [1, 1.5, 2, 3];
const TELEPHONE = /^\+?[\d\s.-]{6,20}$/;
/** Six mois de jeudis : au-delà, un habitué se redemande. */
const SEMAINES_MAX = 26;

/** La même date, une semaine plus tard. Calcul en UTC, comme les dates stockées. */
function semaineSuivante(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Hier, en UTC : la marge d'un jour couvre tous les fuseaux, et le produit
 * vit à Lomé, en UTC. Refuser « aujourd'hui » à quelqu'un dont le jour n'a
 * pas encore commencé côté serveur serait une erreur pire que d'accepter une
 * demande pour la veille.
 */
function hier(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const uid = await appelant(req);
    const corps = (await req.json()) as {
      venueId?: unknown; date?: unknown; time?: unknown; duration?: unknown;
      telephone?: unknown; message?: unknown; blocage?: unknown; note?: unknown;
      jusqua?: unknown; equipeId?: unknown;
    };

    const venueId = typeof corps.venueId === "string" ? corps.venueId : "";
    const date = typeof corps.date === "string" ? corps.date : "";
    const time = typeof corps.time === "string" ? corps.time : "";
    const duration = Number(corps.duration);
    if (!venueId || !DATE.test(date) || !HEURE.test(time) || !DUREES.includes(duration)) {
      return NextResponse.json({ error: "Créneau invalide" }, { status: 400 });
    }
    if (date < hier()) {
      return NextResponse.json({ error: "Cette date est déjà passée." }, { status: 400 });
    }

    const venueSnap = await adminDb.collection("venues").doc(venueId).get();
    const venue = venueSnap.data();
    if (!venueSnap.exists || typeof venue?.owner_id !== "string") {
      return NextResponse.json({ error: "Terrain introuvable" }, { status: 404 });
    }
    const venueName = String(venue.name ?? "Terrain");

    // ─── Le propriétaire bloque un créneau ───
    if (corps.blocage === true) {
      if (venue.owner_id !== uid) {
        return NextResponse.json({ error: "Ce terrain n'est pas le tien" }, { status: 403 });
      }
      const note = typeof corps.note === "string" ? corps.note.trim().slice(0, 120) : "";

      // Chaque semaine, du premier créneau jusqu'à `jusqua` inclus.
      const dates = [date];
      if (corps.jusqua !== undefined && corps.jusqua !== null && corps.jusqua !== "") {
        const jusqua = typeof corps.jusqua === "string" ? corps.jusqua : "";
        if (!DATE.test(jusqua) || jusqua < date) {
          return NextResponse.json(
            { error: "La fin de la répétition doit venir après le premier créneau." },
            { status: 400 },
          );
        }
        for (let d = semaineSuivante(date); d <= jusqua && dates.length < SEMAINES_MAX; d = semaineSuivante(d)) {
          dates.push(d);
        }
      }

      const serie = dates.length > 1 ? adminDb.collection("bookings").doc().id : null;
      const lot = adminDb.batch();
      const ids: string[] = [];
      for (const jour of dates) {
        const ref = adminDb.collection("bookings").doc();
        ids.push(ref.id);
        const blocage: Omit<FirestoreBooking, "created_at" | "updated_at"> = {
          venue_id: venueId, venue_name: venueName, owner_id: uid, user_id: uid,
          user_name: note || "Créneau bloqué",
          date: jour, time, duration, total_price: 0,
          status: "confirmed", kind: "blocage",
          match_id: null, match_label: null, contact: null, message: null,
          proposition: null, note: note || null, cancelled_by: null,
          serie_id: serie,
        };
        lot.set(ref, {
          ...blocage,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
      }
      await lot.commit();
      return NextResponse.json({ id: ids[0], nombre: dates.length, jusqua: dates[dates.length - 1] });
    }

    // ─── Une équipe demande un créneau ───
    if (venue.owner_id === uid) {
      return NextResponse.json(
        { error: "C'est ton terrain : bloque le créneau depuis tes réservations reçues." },
        { status: 400 },
      );
    }
    if (venue.available === false) {
      return NextResponse.json({ error: "Ce terrain ne prend pas de demande pour le moment." }, { status: 409 });
    }
    const hors = horsHoraires(horairesLus(venue.opening_hours), { date, time, duration });
    if (hors) return NextResponse.json({ error: hors }, { status: 400 });

    const telephone = typeof corps.telephone === "string" ? corps.telephone.trim() : "";
    if (!TELEPHONE.test(telephone)) {
      return NextResponse.json(
        { error: "Un numéro de téléphone est nécessaire : c'est par lui que le propriétaire te répondra." },
        { status: 400 },
      );
    }
    const message = typeof corps.message === "string" ? corps.message.trim().slice(0, 500) : "";

    // UN CRÉNEAU DÉJÀ PRIS SE DEMANDE QUAND MÊME : le formulaire prévient,
    // le propriétaire arbitre, et une demande sur un soir occupé peut servir
    // si l'autre équipe se désiste. On ne bloque que ce qu'il a lui-même
    // exclu — ses horaires.

    // L'équipe pour laquelle on demande : seulement une équipe que l'appelant
    // manage, sinon n'importe qui se présenterait au nom de n'importe qui.
    let equipe: { id: string; nom: string } | null = null;
    if (typeof corps.equipeId === "string" && corps.equipeId) {
      const t = await adminDb.collection("teams").doc(corps.equipeId).get();
      if (!t.exists || t.data()?.manager_id !== uid) {
        return NextResponse.json({ error: "Tu ne manages pas cette équipe." }, { status: 403 });
      }
      equipe = { id: t.id, nom: String(t.data()?.name ?? "Équipe") };
    }

    const profil = await lireProfil(uid);
    const demande: Omit<FirestoreBooking, "created_at" | "updated_at"> = {
      venue_id: venueId, venue_name: venueName, owner_id: venue.owner_id, user_id: uid,
      user_name: profil.nom || "Une équipe",
      team_id: equipe?.id ?? null,
      team_name: equipe?.nom ?? null,
      date, time, duration, total_price: 0,
      status: "pending", kind: "demande",
      match_id: null, match_label: null,
      contact: { telephone, email: profil.email },
      message: message || null,
      proposition: null, note: null, cancelled_by: null,
    };
    const ref = await adminDb.collection("bookings").add({
      ...demande,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    // Le numéro saisi ici rejoint le compte s'il n'en avait pas : la prochaine
    // demande le trouvera prérempli, et « Contacter » sur ses terrains à lui
    // aussi.
    if (!profil.telephone) {
      await adminDb.collection("users").doc(uid)
        .update({ phone: telephone, updated_at: FieldValue.serverTimestamp() })
        .catch(() => {});
    }

    await annoncerDemande(venue.owner_id, {
      venueName, date, time,
      demandeur: equipe ? `${demande.user_name} (${equipe.nom})` : demande.user_name,
      telephone, message: demande.message,
    });

    return NextResponse.json({ id: ref.id });
  } catch (err) {
    if (err instanceof ErreurReservation) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/bookings failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
