import { adminDb } from "@/lib/firebase-admin";
import { notifierCompte } from "@/lib/notifier-serveur";
import type { FirestoreMatch, FirestoreParticipation } from "@/types";

// ============================================
// Le rappel du matin : « tu joues aujourd'hui ».
//
// La convocation part quand le match est programmé, parfois trois semaines
// avant. Le jour venu, rien ne le rappelait : le joueur qui avait confirmé
// devait s'en souvenir seul, et celui qui n'avait jamais répondu n'était
// relancé par personne. Le manager comptait ses joueurs sur le terrain.
//
// Un rappel par joueur et par match, le matin (tâche de 6 h, voir
// /api/cron/scoreur-manquant) :
//  - convocation confirmée : l'heure et le lieu ;
//  - sans réponse : l'heure, le lieu, et la demande de répondre.
// Ceux qui ont décliné n'ont rien à apprendre.
//
// UNE FOIS : `rappel_du_jour_le` marque le match, pour qu'une exécution
// rejouée ne sonne pas deux fois.
// ============================================

/** « AAAA-MM-JJ », le format des dates de match, pour aujourd'hui à Lomé (UTC+0). */
export function jourDeMatch(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export async function rappelerLesMatchsDuJour(maintenant = new Date()): Promise<{ matchs: number; joueurs: number }> {
  const jour = jourDeMatch(maintenant);
  const snap = await adminDb
    .collection("matches")
    .where("date", "==", jour)
    .where("status", "in", ["upcoming", "pending"])
    .get();

  let matchs = 0;
  let joueurs = 0;
  for (const doc of snap.docs) {
    const m = doc.data() as FirestoreMatch;
    if (m.rappel_du_jour_le) continue;

    const parts = await adminDb.collection("participations").where("match_id", "==", doc.id).get();
    const ou = m.venue_name ? `, ${m.venue_name}` : "";
    const heure = m.time ? ` à ${m.time.replace(":", "h")}` : "";
    const affiche = `${m.home_team_name} – ${m.away_team_name}`;

    await Promise.allSettled(
      parts.docs.map((p) => {
        const part = p.data() as FirestoreParticipation;
        if (!part.player_id || (part.status !== "confirmed" && part.status !== "pending")) return null;
        joueurs += 1;
        return notifierCompte(part.player_id, {
          type: "participation_request",
          title: "Tu joues aujourd'hui",
          body: part.status === "confirmed"
            ? `${affiche}${heure}${ou}.`
            : `${affiche}${heure}${ou}. Tu n'as pas encore répondu à la convocation.`,
          link: `/matches/${doc.id}`,
        });
      }),
    );

    await doc.ref.update({ rappel_du_jour_le: maintenant.toISOString() });
    matchs += 1;
  }
  return { matchs, joueurs };
}
