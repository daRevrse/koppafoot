// ============================================
// Firestore date normalisation, shared, pure, SDK-agnostic (no web SDK and
// no admin SDK import) so client mappers, server mappers and the auth
// context can all use it.
//
// Firestore hands back a Timestamp object for anything written with
// serverTimestamp(), even where the TypeScript type says `string`. Passing
// that object to `new Date(...)` yields Invalid Date, so every read path has
// to go through here.
// ============================================

export type FirestoreDate =
  | string
  | { seconds?: number; toDate?: () => Date }
  | null
  | undefined;

/** Convert a Firestore date (string or Timestamp, web or admin) to an ISO string. */
export function formatDate(date: FirestoreDate): string {
  if (!date) return new Date().toISOString();
  if (typeof date === "string") return date;
  // Handle Firestore serverTimestamp placeholder (no toDate or seconds on first snapshot)
  if (!date.seconds && !date.toDate) return new Date().toISOString();
  if (typeof date.toDate === "function") return date.toDate().toISOString();
  if (date.seconds) return new Date(date.seconds * 1000).toISOString();
  return new Date().toISOString();
}

// ---- Le jour, tel qu'on l'ecrit a quelqu'un ---------------------------------
//
// CES TROIS FONCTIONS VIVAIENT DANS LE DIRECT, et elles y vivaient DEUX fois
// — une copie dans `DirectHome`, une autre dans `DirectHomeV2`, plus une
// troisieme variante dans `WorldMatchList`. Une quatrieme copie etait sur le
// point de naitre avec la liste des matchs d'une equipe, qui affichait jusque
// la sa date brute : « 2026-09-05 », c'est-a-dire ce que la base stocke et non
// ce qu'on dit a quelqu'un.
//
// Elles atterrissent ici parce que ce module ne depend d'aucun SDK et se lit
// donc du serveur comme du navigateur, ce qui est exactement la contrainte
// qui avait fait naitre les copies.

/** Une date au format que la base stocke : « 2026-09-05 ». */
export function cleDuJour(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** La meme cle, decalee de `delta` jours. */
export function decalerDeJours(cle: string, delta: number): string {
  const d = new Date(`${cle}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return cleDuJour(d);
}

/**
 * « Aujourd'hui », « Demain », « Hier », sinon « sam. 23 août ».
 *
 * LES TROIS PREMIERS VALENT MIEUX QU'UNE DATE, et c'est tout l'interet : on
 * ne compte pas les jours pour savoir si un match est demain. Au-dela, le jour
 * de la semaine porte plus que l'annee — personne ne consulte le calendrier
 * d'un club de quartier a douze mois.
 */
export function libelleDuJour(cle: string): string {
  const aujourdhui = cleDuJour(new Date());
  if (cle === aujourdhui) return "Aujourd'hui";
  if (cle === decalerDeJours(aujourdhui, 1)) return "Demain";
  if (cle === decalerDeJours(aujourdhui, -1)) return "Hier";
  try {
    return new Date(`${cle}T00:00:00`).toLocaleDateString("fr-FR", {
      weekday: "short", day: "numeric", month: "short",
    });
  } catch {
    return cle;
  }
}
