/**
 * Ce qu'on dit au manager quand un geste échoue : le message de la route quand
 * elle en donne un (« Créer une équipe demande le rôle manager. »), jamais le
 * refus en anglais des règles Firestore.
 */
export function messageDe(e: unknown, parDefaut = "Réessaie dans un instant."): string {
  if (!(e instanceof Error) || !e.message) return parDefaut;
  if (/permission|insufficient/i.test(e.message)) return "Tu n'as pas les droits pour faire ça.";
  if (/network|offline|unavailable|failed to fetch/i.test(e.message)) return "Pas de connexion. Réessaie quand le réseau revient.";
  return e.message;
}
