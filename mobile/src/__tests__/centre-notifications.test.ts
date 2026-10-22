import type { Notification } from "@/types";
import {
  filtresDisponibles, joursDesNotifications, LIBELLE_NOTIFICATION, notificationsDuFiltre,
} from "~/lib/centre-notifications";

const notif = (id: string, p: Partial<Notification> = {}): Notification =>
  ({ id, userId: "u", type: "admin_message", title: id, body: "", read: true, createdAt: "2026-10-22T10:00:00", ...p } as Notification);

describe("joursDesNotifications", () => {
  const maintenant = new Date("2026-10-22T18:00:00");

  it("range par jour, du plus récent au plus ancien, avec Aujourd'hui et Hier", () => {
    const jours = joursDesNotifications([
      notif("a", { createdAt: "2026-10-22T09:00:00" }),
      notif("b", { createdAt: "2026-10-21T20:00:00" }),
      notif("c", { createdAt: "2026-10-18T08:00:00" }),
      notif("d", { createdAt: "2026-10-22T07:00:00" }),
    ], maintenant);
    expect(jours.map((j) => [j.titre, j.notifications.map((n) => n.id)])).toEqual([
      ["Aujourd'hui", ["a", "d"]],
      ["Hier", ["b"]],
      ["Dimanche 18 octobre", ["c"]],
    ]);
  });
});

describe("les filtres", () => {
  const liste = [
    notif("equipe", { type: "team_activity", read: false }),
    notif("suivi", { type: "follow_activity" }),
    notif("terrain", { type: "booking_answer" }),
    notif("message", { type: "admin_message" }),
  ];

  it("ne proposent que ce qui a quelque chose à montrer", () => {
    expect(filtresDisponibles(liste).map((f) => f.libelle)).toEqual(["Toutes", "Non lues", "Mon équipe", "Terrains"]);
    expect(filtresDisponibles([notif("x")]).map((f) => f.libelle)).toEqual(["Toutes"]);
  });

  it("gardent les familles du site", () => {
    expect(notificationsDuFiltre(liste, "non-lues").map((n) => n.id)).toEqual(["equipe"]);
    expect(notificationsDuFiltre(liste, "equipe").map((n) => n.id)).toEqual(["equipe", "suivi"]);
    expect(notificationsDuFiltre(liste, "terrains").map((n) => n.id)).toEqual(["terrain"]);
    expect(notificationsDuFiltre(liste, "toutes")).toHaveLength(4);
  });
});

describe("LIBELLE_NOTIFICATION", () => {
  it("nomme chaque type comme le site", () => {
    expect(LIBELLE_NOTIFICATION.match_challenge).toBe("Défi");
    expect(LIBELLE_NOTIFICATION.tribune_comment).toBe("Tribune");
  });
});
