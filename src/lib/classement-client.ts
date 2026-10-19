import { auth } from "@/lib/firebase";

// ============================================
// Demander au serveur de refaire le classement des joueurs (voir
// /api/rankings/rebuild).
//
// À CHAQUE GESTE QUI TERMINE OU CORRIGE UN MATCH : le coup de sifflet de la
// console, et la saisie d'un résultat après coup. Ce second chemin ne le
// demandait pas, et un score rattrapé le lendemain attendait le match
// suivant — n'importe où sur la plateforme — pour entrer au classement.
//
// Silencieuse de bout en bout : l'appelant n'attend rien et ne veut rien
// savoir. Un classement en retard d'un match est un désagrément, un résultat
// qui échoue à s'enregistrer est une perte.
// ============================================

export function demanderLeRecalculDuClassement(): void {
  void (async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      await fetch("/api/rankings/rebuild", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Voir plus haut : rien à faire, et surtout rien à dire.
    }
  })();
}
