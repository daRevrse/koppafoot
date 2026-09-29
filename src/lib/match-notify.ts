import { auth } from "@/lib/firebase";

// ============================================
// Prévenir ceux qui suivent CE match.
//
// Sans effet et sans bruit en cas d'échec : une notification qui rate ne doit
// jamais retarder ni bloquer le direct — celui qui tient la console a mieux à
// faire que d'attendre un accusé de réception.
//
// Avec `cid`, les abonnés de la compétition sont prévenus AUSSI, par le même
// envoi : suivre une compétition, c'est recevoir ses quarante matchs ; suivre
// un match, c'est n'en recevoir qu'un. La route réunit les deux listes, et
// qui figure sur les deux ne reçoit le but qu'une fois.
// ============================================

export function notifierAbonnesDuMatch(input: {
  mid: string;
  cid?: string | null;
  title: string;
  body: string;
  link?: string;
}): void {
  void (async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      await fetch("/api/notifications/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
      });
    } catch {
      // Best-effort, par construction.
    }
  })();
}
