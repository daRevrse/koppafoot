import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export const maxDuration = 60; // 1 minute max duration
export const dynamic = "force-dynamic";

/**
 * La validation automatique : passé 12 h, un amical terminé que personne n'a
 * contesté devient définitif.
 *
 * ELLE N'A JAMAIS TOURNÉ, et deux défauts s'y empilaient :
 *
 *  - la requête croise deux égalités et UNE INÉGALITÉ (`completed_at`), ce qui
 *    réclame un index composite. Il n'existait pas — aucun index ne portait
 *    `validation_status` — donc Firestore rejetait la requête, le `catch` la
 *    changeait en 500, et rien n'était jamais validé. C'est le symptôme qu'on
 *    voit : un match joué samedi, encore « en attente » le jeudi suivant.
 *
 *  - `completed_at` est un Timestamp (écrit par `FieldValue.serverTimestamp()`
 *    dans /api/matches/complete et /api/matches/record), et il était comparé à
 *    une CHAÎNE ISO. Firestore ordonne d'abord par type, et les Timestamp
 *    passent avant les chaînes : la borne aurait donc laissé passer TOUS les
 *    matchs en attente, quel que soit leur âge. Réparer l'index sans réparer
 *    la comparaison aurait validé les matchs dans la minute qui suit le coup
 *    de sifflet — l'inverse exact des 12 h promises à l'écran.
 *
 * Les deux se réparent donc ensemble, jamais l'un sans l'autre.
 */
export async function GET(request: Request) {
  try {
    // Authenticate cron request (optional, could use a secret token)
    // For Vercel Cron, you can verify process.env.CRON_SECRET if provided
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const twelveHoursAgo = Timestamp.fromDate(
      new Date(Date.now() - 12 * 60 * 60 * 1000),
    );

    // Query for matches completed but still pending validation.
    // L'index qui porte ces trois champs est déclaré dans firestore.indexes.json.
    const matchesRef = adminDb.collection("matches");
    const snapshot = await matchesRef
      .where("status", "==", "completed")
      .where("validation_status", "==", "pending")
      .where("completed_at", "<", twelveHoursAgo)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No matches to auto-validate",
        count: 0
      });
    }

    // PAR PAQUETS DE 450 : un batch Firestore plafonne à 500 écritures, et le
    // premier passage qui aboutira reprendra tout l'arriéré accumulé depuis
    // que ce cron échoue. Un seul batch aurait échoué à son tour, sur une
    // limite cette fois.
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = adminDb.batch();
      for (const doc of docs.slice(i, i + 450)) {
        batch.update(doc.ref, {
          validation_status: "validated",
          // `updated_at`, et non `updatedAt` : tout le schéma est en
          // snake_case. L'ancien nom créait un champ parasite et laissait la
          // vraie date de modification inchangée.
          updated_at: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      message: `Successfully auto-validated ${docs.length} match(es)`,
      count: docs.length
    });
  } catch (error) {
    console.error("Error in auto-validate cron:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
