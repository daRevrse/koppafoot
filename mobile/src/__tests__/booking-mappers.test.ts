import { toBooking } from "@/lib/booking-mappers";
import type { FirestoreBooking } from "@/types";

describe("toBooking", () => {
  it("lit une réservation de la base", () => {
    const b = toBooking("r1", {
      venue_id: "v1", venue_name: "Terrain du Lac", owner_id: "o1", user_id: "u1", user_name: "Kossi",
      date: "2026-10-27", time: "18:00", duration: 90, total_price: 15000, status: "pending",
      team_name: "FC Koppa", created_at: "2026-10-20T10:00:00.000Z", updated_at: "2026-10-21T10:00:00.000Z",
    } as unknown as FirestoreBooking);
    expect(b).toMatchObject({
      id: "r1", venueId: "v1", venueName: "Terrain du Lac", ownerId: "o1", userName: "Kossi", date: "2026-10-27",
      time: "18:00", duration: 90, totalPrice: 15000, status: "pending", teamName: "FC Koppa", kind: "demande",
      matchId: null, createdAt: "2026-10-20T10:00:00.000Z",
    });
  });

  it("reconnaît la réservation d'un match à son identifiant de match", () => {
    expect(toBooking("r2", { match_id: "m1" } as unknown as FirestoreBooking).kind).toBe("match");
  });
});
