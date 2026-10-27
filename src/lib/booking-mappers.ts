// ============================================
// Booking mapper, shared, pure, SDK-agnostic: the site (lib/firestore) and
// the mobile app (the venue owner's « Mes terrains ») read bookings with it.
// Same pattern as match-mappers and competition-mappers.
// ============================================

import { formatDate } from "@/lib/dates";
import type { Booking, FirestoreBooking } from "@/types";

export function toBooking(id: string, d: FirestoreBooking): Booking {
  return {
    id,
    venueId: d.venue_id,
    venueName: d.venue_name,
    ownerId: d.owner_id,
    userId: d.user_id,
    userName: d.user_name,
    date: d.date,
    time: d.time,
    duration: d.duration,
    totalPrice: d.total_price,
    status: d.status,
    kind: d.kind ?? (d.match_id ? "match" : "demande"),
    matchId: d.match_id ?? null,
    competitionId: d.competition_id ?? null,
    matchLabel: d.match_label ?? null,
    contact: d.contact ?? null,
    message: d.message ?? null,
    proposition: d.proposition ?? null,
    reglementVu: d.reglement_vu ?? null,
    note: d.note ?? null,
    cancelledBy: d.cancelled_by ?? null,
    serieId: d.serie_id ?? null,
    teamId: d.team_id ?? null,
    teamName: d.team_name ?? null,
    createdAt: formatDate(d.created_at),
    updatedAt: formatDate(d.updated_at),
  };
}
