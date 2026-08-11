import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { authorizeOrganizer } from "@/lib/competition-api-auth";

// ============================================
// Staff grants — cut one person's access
//
// Revoking a CODE (see ../staff-codes) cuts everyone who redeemed it. This
// route is the finer instrument: one volunteer loses the console, the code
// stays valid for the others.
// ============================================

/** DELETE — revoke one grant. Body: { cid, uid }. */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { cid, uid } = body ?? {};
    if (!cid || !uid) {
      return NextResponse.json({ error: "cid et uid requis" }, { status: 400 });
    }

    const authResult = await authorizeOrganizer(req, cid);
    if ("error" in authResult) return authResult.error;

    const ref = adminDb
      .collection("competitions")
      .doc(cid)
      .collection("staff_grants")
      .doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Accès introuvable" }, { status: 404 });
    }

    // Kept, not deleted: the staff screen still shows who held the console
    // during the tournament, and a deleted doc would erase that trail.
    await ref.update({ revoked: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Staff grant revoke error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
