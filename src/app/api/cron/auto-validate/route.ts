import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { COLLECTION_VALIDATIONS } from "@/lib/validation-server";
import type { FirestoreMatchValidation } from "@/types";

export const maxDuration = 60; // 1 minute max duration
export const dynamic = "force-dynamic";

/**
 * La validation tacite : un match joué en direct entre deux comptes, que
 * personne n'a contesté dans les douze heures, est validé. C'est ce que la
 * fiche promet au manager (« sans action sous 12h… »).
 *
 * CETTE ROUTE N'AVAIT JAMAIS RIEN VALIDÉ. Elle cherchait les matchs par
 * `completed_at < <date en texte>`, alors que `completed_at` est un horodatage
 * Firestore : une comparaison entre deux types différents ne renvoie rien. La
 * requête croisait en plus trois champs, ce qui demandait un index composite
 * qui n'existait pas.
 *
 * Elle lit désormais `match_validations`, par échéance (`auto_validate_at`,
 * posée à la fin du match — voir /api/matches/complete) : un seul champ, donc
 * l'index automatique suffit. L'échéance s'efface dès que le match est
 * tranché, et la requête ne trouve que ce qu'il reste à faire. Un match
 * RENSEIGNÉ n'en a pas : il attend une contresignature, pas un délai, et le
 * valider en silence reviendrait à ne jamais créditer ses buteurs.
 */
export async function GET(request: Request) {
  try {
    // Vercel Cron signe sa requête quand CRON_SECRET est défini.
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const echues = await adminDb
      .collection(COLLECTION_VALIDATIONS)
      .where("auto_validate_at", "<=", Timestamp.now())
      .get();

    let batch = adminDb.batch();
    let ops = 0;
    let validees = 0;

    for (const doc of echues.docs) {
      const v = doc.data() as FirestoreMatchValidation;
      if (v.status === "pending") {
        batch.update(doc.ref, {
          status: "validated",
          auto_validated: true,
          auto_validate_at: FieldValue.delete(),
          updated_at: FieldValue.serverTimestamp(),
        });
        validees += 1;
      } else {
        // Tranché par une voie qui n'aurait pas effacé l'échéance : on la
        // retire, sans toucher au statut.
        batch.update(doc.ref, {
          auto_validate_at: FieldValue.delete(),
          updated_at: FieldValue.serverTimestamp(),
        });
      }
      ops += 1;
      if (ops >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    return NextResponse.json({
      success: true,
      message: validees > 0 ? `${validees} match(s) validé(s) tacitement` : "Aucun match à valider",
      count: validees,
    });
  } catch (error) {
    console.error("Error in auto-validate cron:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
