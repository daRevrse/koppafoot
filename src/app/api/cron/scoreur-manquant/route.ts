import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/fcm-server";
import type { FirestoreMatch } from "@/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/scoreur-manquant, la relance de la veille.
 *
 * Un amical se joue demain et personne ne le couvre : on prévient celui qui
 * l'a créé, la veille, pour qu'il tienne la console lui-même ou trouve
 * quelqu'un.
 *
 * POURQUOI LA VEILLE, et pas le matin même. Trouver un bénévole demande des
 * messages et des réponses ; prévenir à trois heures du matin le jour du match
 * revient à ne pas prévenir. La veille laisse une soirée pour s'organiser.
 *
 * POURQUOI PAS PLUS TÔT non plus : un match programmé trois semaines à
 * l'avance n'a aucune raison d'avoir déjà son scoreur, et relancer dès la
 * création apprendrait à ignorer la notification.
 *
 * SIX HEURES, et pas trois comme l'autre tâche : le Togo est à UTC+0, et une
 * notification à trois heures du matin réveille pour de vrai.
 *
 * ON NE RELANCE QU'UNE FOIS. `scoreur_relance_le` marque le passage : sans
 * lui, une exécution rejouée — Vercel réessaie une tâche en échec — enverrait
 * la même alerte deux fois, et c'est exactement le genre de détail qui fait
 * couper les notifications.
 */
export async function GET(request: Request) {
  const entete = request.headers.get("authorization");
  if (process.env.CRON_SECRET && entete !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // « Demain », au format des dates de match (AAAA-MM-JJ).
    const demain = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const jour = `${demain.getFullYear()}-${pad(demain.getMonth() + 1)}-${pad(demain.getDate())}`;

    const snap = await adminDb
      .collection("matches")
      .where("date", "==", jour)
      .where("status", "in", ["upcoming", "pending"])
      .get();

    let relances = 0;
    const ignores: string[] = [];

    for (const doc of snap.docs) {
      const m = doc.data() as FirestoreMatch;

      // Quelqu'un le couvre déjà : rien à dire.
      if ((m.moderator_ids ?? []).length > 0) continue;
      // Déjà relancé pour ce match.
      if (m.scoreur_relance_le) { ignores.push(doc.id); continue; }

      const createur = m.manager_id;
      if (!createur) continue;

      await sendPushToUser(createur, {
        title: "Ton match de demain n'a pas de scoreur",
        body: `${m.home_team_name} – ${m.away_team_name}. Tiens la console toi-même, ou invite quelqu'un.`,
        link: `/matches/${doc.id}`,
        // « perso » : c'est adressé à lui, sur son match, et ça appelle une
        // action de sa part. Ce n'est pas la vie d'une équipe qu'il suit.
        category: "perso",
      }).catch((err) => console.error("relance scoreur, push échoué:", doc.id, err));

      await doc.ref.update({ scoreur_relance_le: new Date().toISOString() });
      relances += 1;
    }

    return NextResponse.json({
      success: true,
      jour,
      examines: snap.size,
      relances,
      dejaRelances: ignores.length,
    });
  } catch (err) {
    console.error("[cron/scoreur-manquant]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
