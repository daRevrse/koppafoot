import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const maxDuration = 60; // 1 minute max duration
export const dynamic = "force-dynamic";

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

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    // Query for matches completed but still pending validation
    const matchesRef = adminDb.collection("matches");
    const snapshot = await matchesRef
      .where("status", "==", "completed")
      .where("validation_status", "==", "pending")
      .where("completed_at", "<", twelveHoursAgo.toISOString())
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No matches to auto-validate",
        count: 0
      });
    }

    // Use a batch to update standard matches
    const batch = adminDb.batch();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      // Validate the match automatically
      batch.update(doc.ref, {
        validation_status: "validated",
        updatedAt: new Date().toISOString()
      });
      count++;
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Successfully auto-validated ${count} match(es)`,
      count
    });
  } catch (error: any) {
    console.error("Error in auto-validate cron:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
