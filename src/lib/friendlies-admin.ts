// Server-only. Les matchs amicaux, pour le tableau du Direct.
//
// Pourquoi ici et pas via le SDK client : le Direct est rendu côté serveur
// pour le premier affichage et le partage. Les amicaux sont déjà en lecture
// publique dans firestore.rules (`match /matches/{matchId} { allow read: if
// true }`), donc les publier ne change rien à ce qui est visible, on change
// seulement l'endroit d'où on les lit.
//
// Ils sont rendus dans la forme d'un `CompMatch` et rattachés à une
// compétition synthétique. Le tableau du Direct groupe ses lignes par
// compétition ; sans ce rattachement il aurait fallu un second chemin de
// rendu pour une poignée de matchs qui s'affichent exactement pareil.

import { adminDb } from "@/lib/firebase-admin";
import type { CompMatch } from "@/types";
import { amicalVersCompMatch } from "@/lib/friendlies-shared";

export { FRIENDLY_COMP_ID, FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";

export async function getPublicFriendlies(max = 60): Promise<CompMatch[]> {
  try {
    const snap = await adminDb.collection("matches").get();
    const out: CompMatch[] = [];
    for (const doc of snap.docs) {
      const m = amicalVersCompMatch(doc.id, doc.data() as Record<string, unknown>);
      if (m) out.push(m);
    }
    return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, max);
  } catch (err) {
    console.error("getPublicFriendlies failed:", err);
    return [];
  }
}
