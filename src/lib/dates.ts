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
