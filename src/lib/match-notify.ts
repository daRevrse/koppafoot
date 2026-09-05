import { auth } from "@/lib/firebase";

// ============================================
// Prévenir ceux qui suivent CE match.
//
// Le jumeau de competition-notify, et il en garde la règle : sans effet et
// sans bruit en cas d'échec. Une notification qui rate ne doit jamais retarder
// ni bloquer le direct — celui qui tient la console a mieux à faire que
// d'attendre un accusé de réception.
//
// Les deux coexistent et ne font pas double emploi : suivre une compétition,
// c'est recevoir ses quarante matchs ; suivre un match, c'est n'en recevoir
// qu'un. La console appelle les deux, chacun a ses abonnés.
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
