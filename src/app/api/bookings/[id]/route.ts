import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  ErreurReservation, annoncerDemande, appelant, lienDuMatch, notifier, quand, recopierSurLeMatch, surLeMatch,
} from "@/lib/reservations-server";
import { seChevauchent } from "@/lib/terrains";
import type { FirestoreBooking, PropositionCreneau } from "@/types";

// ============================================
// PATCH /api/bookings/[id], répondre à une demande de créneau.
//
//  - confirmer / refuser : le PROPRIÉTAIRE. En refusant, il peut proposer un
//    autre créneau : un « non » sec laissait l'équipe chercher à l'aveugle un
//    soir qui lui irait, alors que lui sait lesquels sont libres ;
//  - annuler : l'un ou l'autre. Le propriétaire qui annule un créneau déjà
//    confirmé REFUSE, au sens de la synchronisation des matchs : on ne le lui
//    redemandera pas. Sur un blocage répété, `serie: true` débloque d'un coup
//    cette date et toutes les suivantes de la série ;
//  - prendre-proposition : le DEMANDEUR accepte le créneau que le propriétaire
//    lui a proposé. La nouvelle demande naît confirmée : il l'a déjà acceptée
//    en la proposant. Réservé aux demandes faites depuis la fiche : pour un
//    match, c'est en déplaçant le match que le manager la prend (voir
//    lib/reservations).
//
// L'AUTRE PARTIE EST TOUJOURS PRÉVENUE, et le match recopie l'état de sa
// réservation quand elle en a un : c'est sur la carte de son match que le
// manager apprend que le terrain a dit non.
// ============================================

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

type Action = "confirmer" | "refuser" | "annuler" | "prendre-proposition";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const uid = await appelant(req);
    const { id } = await params;
    const corps = (await req.json()) as {
      action?: Action; proposition?: Partial<PropositionCreneau> | null; serie?: boolean;
    };

    const ref = adminDb.collection("bookings").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    const b = snap.data() as FirestoreBooking;

    const proprietaire = b.owner_id === uid;
    const demandeur = b.user_id === uid;
    if (!proprietaire && !demandeur) {
      return NextResponse.json({ error: "Cette demande n'est pas la tienne" }, { status: 403 });
    }
    const blocage = b.kind === "blocage";
    // Le match de la réservation, amical ou de compétition, s'il y en a un.
    const match = b.match_id ? { mid: b.match_id, cid: b.competition_id ?? null } : null;
    const lien = match ? lienDuMatch(match) : "/mes-reservations";

    switch (corps.action) {
      case "confirmer": {
        if (!proprietaire) return interdit();
        if (b.status !== "pending") return deja();
        await ref.update({ status: "confirmed", updated_at: FieldValue.serverTimestamp() });
        if (match) await recopierSurLeMatch(match, surLeMatch(id, b, "confirmed"));
        await notifier(b.user_id, {
          type: "booking_answer",
          title: "Créneau confirmé",
          body: `${b.venue_name} est à toi le ${quand(b)}${b.match_label ? ` pour ${b.match_label}` : ""}.`,
          link: lien,
        });
        return NextResponse.json({ ok: true });
      }

      case "refuser":
      case "annuler": {
        if (b.status !== "pending" && b.status !== "confirmed") return deja();
        if (corps.action === "refuser" && (!proprietaire || b.status !== "pending")) return interdit();
        // La réservation d'un match suit le match : c'est en l'annulant, en le
        // déplaçant ou en changeant de terrain que son manager la libère.
        // L'annuler ici, la synchronisation suivante la redemanderait.
        if (b.match_id && !proprietaire) return interdit();

        // Le propriétaire qui dit non peut proposer mieux.
        let proposition: PropositionCreneau | null = null;
        if (proprietaire && !blocage && corps.proposition) {
          const { date, time } = corps.proposition;
          if (typeof date !== "string" || !DATE.test(date) || typeof time !== "string" || !HEURE.test(time)) {
            return NextResponse.json({ error: "Créneau proposé invalide" }, { status: 400 });
          }
          proposition = { date, time };
        }

        const parQui = proprietaire ? "proprietaire" : "demandeur";
        await ref.update({
          status: "cancelled",
          cancelled_by: parQui,
          proposition,
          updated_at: FieldValue.serverTimestamp(),
        });

        if (blocage) {
          // Toute la série à partir de cette date : les jeudis déjà passés
          // restent dans l'historique tels qu'ils ont été.
          if (corps.serie === true && b.serie_id && proprietaire) {
            const serie = await adminDb.collection("bookings").where("serie_id", "==", b.serie_id).get();
            const lot = adminDb.batch();
            let n = 0;
            for (const d of serie.docs) {
              const x = d.data() as FirestoreBooking;
              if (d.id === id || x.owner_id !== uid || x.status !== "confirmed" || x.date < b.date) continue;
              lot.update(d.ref, { status: "cancelled", cancelled_by: "proprietaire", updated_at: FieldValue.serverTimestamp() });
              n += 1;
            }
            if (n) await lot.commit();
            return NextResponse.json({ ok: true, nombre: n + 1 });
          }
          return NextResponse.json({ ok: true, nombre: 1 });
        }

        if (match) {
          await recopierSurLeMatch(
            match,
            surLeMatch(id, b, proprietaire ? "refused" : "cancelled", proposition),
          );
        }

        const offre = proposition ? ` Il propose le ${quand(proposition)}.` : "";
        if (proprietaire) {
          await notifier(b.user_id, {
            type: "booking_answer",
            title: b.status === "confirmed" ? "Créneau annulé" : "Créneau refusé",
            body: `${b.venue_name} n'est pas disponible le ${quand(b)}${b.match_label ? ` pour ${b.match_label}` : ""}.${offre}`
              + (b.match_id ? " Change d'horaire ou de terrain." : ""),
            link: lien,
          });
        } else {
          await notifier(b.owner_id, {
            type: "booking_answer",
            title: "Demande annulée",
            body: `${b.user_name || "Une équipe"} libère ${b.venue_name} du ${quand(b)}.`,
            link: "/mes-terrains/reservations",
          });
        }
        return NextResponse.json({ ok: true });
      }

      case "prendre-proposition": {
        if (!demandeur || b.match_id) return interdit();
        if (b.status !== "cancelled" || !b.proposition) {
          return NextResponse.json({ error: "Aucune proposition à prendre" }, { status: 409 });
        }
        const creneau = { date: b.proposition.date, time: b.proposition.time, duration: b.duration };

        // La proposition a pu être donnée à quelqu'un d'autre entre-temps :
        // on vérifie, et on redemande plutôt que de confirmer un doublon.
        const memeJour = await adminDb.collection("bookings")
          .where("venue_id", "==", b.venue_id)
          .where("date", "==", creneau.date)
          .get();
        const libre = !memeJour.docs.some((d) => {
          const x = d.data() as FirestoreBooking;
          return x.status === "confirmed" && seChevauchent(x, creneau);
        });

        const nouvelle: Omit<FirestoreBooking, "created_at" | "updated_at"> = {
          ...b,
          ...creneau,
          status: libre ? "confirmed" : "pending",
          proposition: null,
          cancelled_by: null,
        };
        const cree = await adminDb.collection("bookings").add({
          ...nouvelle,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
        // L'ancienne demande ne propose plus rien : on ne la prend pas deux fois.
        await ref.update({ proposition: null, updated_at: FieldValue.serverTimestamp() });

        if (libre) {
          await notifier(b.owner_id, {
            type: "booking_answer",
            title: "Ta proposition est prise",
            body: `${b.user_name || "L'équipe"} prend ${b.venue_name} le ${quand(creneau)}.`,
            link: "/mes-terrains/reservations",
          });
        } else {
          await annoncerDemande(b.owner_id, {
            venueName: b.venue_name, date: creneau.date, time: creneau.time,
            demandeur: b.user_name || "Une équipe",
            telephone: b.contact?.telephone, message: b.message,
          });
        }
        return NextResponse.json({ id: cree.id, status: nouvelle.status });
      }

      default:
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof ErreurReservation) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/bookings/[id] failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

const interdit = () => NextResponse.json({ error: "Ce geste ne te revient pas" }, { status: 403 });
const deja = () => NextResponse.json({ error: "Cette demande a déjà été traitée" }, { status: 409 });
