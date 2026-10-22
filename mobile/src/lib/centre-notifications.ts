import type { Notification, NotificationType } from "@/types";

// Le centre de notifications (app/(app)/notifications du site) : les
// libellés et les familles de types, les filtres, le rangement par jour.

/** Le nom d'un type, celui du site (TYPE_META). */
export const LIBELLE_NOTIFICATION: Record<NotificationType, string> = {
  invitation: "Invitation",
  join_request: "Candidature",
  match_challenge: "Défi",
  match_update: "Match",
  participation_request: "Convocation",
  admin_message: "Message",
  team_activity: "Mon équipe",
  follow_activity: "Suivi",
  booking_request: "Créneau",
  booking_answer: "Créneau",
  venue_application: "Terrain",
  arbitrage: "Arbitrage",
  tribune_comment: "Tribune",
  offre: "Offre",
};

export type FiltreNotifications = "toutes" | "non-lues" | "equipe" | "mercato" | "terrains" | "arbitrage" | "tribune";

/** Les familles du site : quels types chaque filtre garde. */
const FAMILLES: { cle: Exclude<FiltreNotifications, "toutes" | "non-lues">; libelle: string; types: NotificationType[] }[] = [
  { cle: "equipe", libelle: "Mon équipe", types: ["team_activity", "follow_activity", "match_challenge", "match_update", "participation_request"] },
  { cle: "mercato", libelle: "Mercato", types: ["invitation", "join_request"] },
  { cle: "terrains", libelle: "Terrains", types: ["booking_request", "booking_answer", "venue_application"] },
  { cle: "arbitrage", libelle: "Arbitrage", types: ["arbitrage"] },
  { cle: "tribune", libelle: "Tribune", types: ["tribune_comment"] },
];

export function notificationsDuFiltre(notifications: Notification[], filtre: FiltreNotifications): Notification[] {
  if (filtre === "toutes") return notifications;
  if (filtre === "non-lues") return notifications.filter((n) => !n.read);
  const famille = FAMILLES.find((f) => f.cle === filtre);
  return famille ? notifications.filter((n) => famille.types.includes(n.type)) : notifications;
}

/**
 * Les filtres qui ont quelque chose à montrer : le site en propose sept, mais
 * un supporter n'a ni terrain ni arbitrage — une pastille vide ne sert à rien.
 */
export function filtresDisponibles(notifications: Notification[]): { cle: FiltreNotifications; libelle: string }[] {
  return [
    { cle: "toutes" as const, libelle: "Toutes" },
    ...(notifications.some((n) => !n.read) ? [{ cle: "non-lues" as const, libelle: "Non lues" }] : []),
    ...FAMILLES.filter((f) => notifications.some((n) => f.types.includes(n.type))).map((f) => ({ cle: f.cle, libelle: f.libelle })),
  ];
}

const cleDuJour = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Les notifications par jour, comme la liste arrive (la plus récente d'abord) : « Aujourd'hui », « Hier », puis la date. */
export function joursDesNotifications(
  notifications: Notification[],
  maintenant: Date = new Date(),
): { cle: string; titre: string; notifications: Notification[] }[] {
  const aujourdhui = cleDuJour(maintenant);
  const veille = new Date(maintenant);
  veille.setDate(maintenant.getDate() - 1);
  const hier = cleDuJour(veille);

  const jours = new Map<string, Notification[]>();
  for (const n of notifications) {
    const d = new Date(n.createdAt);
    const cle = Number.isNaN(d.getTime()) ? "?" : cleDuJour(d);
    jours.set(cle, [...(jours.get(cle) ?? []), n]);
  }
  return [...jours.entries()].map(([cle, liste]) => {
    let titre = cle;
    if (cle === aujourdhui) titre = "Aujourd'hui";
    else if (cle === hier) titre = "Hier";
    else if (cle !== "?") {
      const date = new Date(`${cle}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      titre = date.charAt(0).toUpperCase() + date.slice(1);
    }
    return { cle, titre, notifications: liste };
  });
}
