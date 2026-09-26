import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  ErreurReservation, appelant, lienDuMatch, notifier, quand, recopierSurLeMatch, surLeMatch,
} from "@/lib/reservations-server";
import { aujourdhui } from "@/lib/terrains";
import type { FirestoreBooking } from "@/types";

// ============================================
// GET    /api/venues/[id], ce que le retrait du terrain toucherait.
// DELETE /api/venues/[id], retirer le terrain.
//
// POURQUOI LE SERVEUR. Le terrain s'effaçait d'un `deleteDoc` dans le
// navigateur, et ce qui en dépendait restait en l'air : une équipe qui
// attendait une réponse l'attendait pour toujours, sur une fiche devenue
// introuvable, et un match gardait sa demande « en attente » sans que rien
// ne dise à son manager de changer de terrain.
//
// Au retrait, désormais :
//  - les demandes EN ATTENTE sont closes, comme un refus, et leurs équipes
//    prévenues — un match apprend que son terrain n'est plus là ;
//  - les BLOCAGES à venir disparaissent : ils ne gardaient le créneau que
//    pour la fiche ;
//  - les créneaux CONFIRMÉS restent. Le propriétaire les a promis, il les
//    retrouve dans ses réservations reçues et les honore ou les annule
//    lui-même, en prévenant l'équipe.
// ============================================

export const dynamic = "force-dynamic";

async function lireTerrain(id: string, uid: string) {
  const snap = await adminDb.collection("venues").doc(id).get();
  if (!snap.exists) throw new ErreurReservation("Terrain introuvable", 404);
  if (snap.data()?.owner_id !== uid) throw new ErreurReservation("Ce terrain n'est pas le tien", 403);
  return snap;
}

/** Les réservations à venir du terrain, rangées par ce que le retrait en fera. */
async function aVenir(id: string) {
  const jour = aujourdhui();
  const docs = (await adminDb.collection("bookings").where("venue_id", "==", id).get()).docs
    .map((d) => ({ ref: d.ref, id: d.id, b: d.data() as FirestoreBooking }))
    .filter((x) => x.b.date >= jour);
  return {
    enAttente: docs.filter((x) => x.b.status === "pending"),
    blocages: docs.filter((x) => x.b.status === "confirmed" && x.b.kind === "blocage"),
    confirmees: docs.filter((x) => x.b.status === "confirmed" && x.b.kind !== "blocage"),
  };
}

function erreur(err: unknown, geste: string) {
  if (err instanceof ErreurReservation) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(`${geste} /api/venues/[id] failed:`, err);
  return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const uid = await appelant(req);
    const { id } = await params;
    await lireTerrain(id, uid);
    const r = await aVenir(id);
    return NextResponse.json({ enAttente: r.enAttente.length, confirmees: r.confirmees.length });
  } catch (err) {
    return erreur(err, "GET");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const uid = await appelant(req);
    const { id } = await params;
    const terrain = await lireTerrain(id, uid);
    const nom = String(terrain.data()?.name ?? "Ce terrain");
    const r = await aVenir(id);

    for (const { ref, id: bid, b } of r.enAttente) {
      await ref.update({
        status: "cancelled",
        cancelled_by: "proprietaire",
        proposition: null,
        updated_at: FieldValue.serverTimestamp(),
      });
      const match = b.match_id ? { mid: b.match_id, cid: b.competition_id ?? null } : null;
      if (match) await recopierSurLeMatch(match, surLeMatch(bid, b, "refused"));
      await notifier(b.user_id, {
        type: "booking_answer",
        title: "Terrain retiré",
        body: `${nom} n'est plus référencé sur KoppaFoot : ta demande du ${quand(b)}`
          + `${b.match_label ? ` pour ${b.match_label}` : ""} est close.`
          + (match ? " Choisis un autre terrain." : ""),
        link: match ? lienDuMatch(match) : "/mes-reservations",
      });
    }

    const lot = adminDb.batch();
    for (const { ref } of r.blocages) lot.delete(ref);
    lot.delete(terrain.ref.collection("prive").doc("contact"));
    lot.delete(terrain.ref);
    await lot.commit();

    return NextResponse.json({ closes: r.enAttente.length, confirmees: r.confirmees.length });
  } catch (err) {
    return erreur(err, "DELETE");
  }
}
