import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { normalizeStaffCode, scopeFromFirestore } from "@/lib/staff-scope";
import type {
  FirestoreCompetition,
  FirestoreStaffCode,
  FirestoreStaffGrant,
} from "@/types";

// ============================================
// Redeem a staff access code
//
// The volunteer must be signed in — the grant hangs off a uid, and that is
// what keeps live actions attributable to a person. What they do NOT need is
// an invitation, an e-mail known to the organizer, or any role on the
// platform.
// ============================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = typeof body?.code === "string" ? body.code : "";
    const code = normalizeStaffCode(raw);
    if (!code) {
      return NextResponse.json({ error: "Code requis" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Connecte-toi pour activer un code" }, { status: 401 });
    }
    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const codeRef = adminDb.collection("staff_codes").doc(code);
    const codeSnap = await codeRef.get();
    // Same message whether the code never existed or was revoked: a probe
    // should not learn which codes are real.
    const invalid = NextResponse.json(
      { error: "Ce code n'existe pas ou n'est plus valable" },
      { status: 404 },
    );
    if (!codeSnap.exists) return invalid;

    const codeData = codeSnap.data() as FirestoreStaffCode;
    if (codeData.revoked === true) return invalid;

    const expiresMs = codeData.expires_at ? new Date(codeData.expires_at).getTime() : null;
    if (expiresMs != null && expiresMs <= Date.now()) {
      return NextResponse.json({ error: "Ce code a expiré" }, { status: 410 });
    }

    const cid = codeData.competition_id;
    const compSnap = await adminDb.collection("competitions").doc(cid).get();
    if (!compSnap.exists) return invalid;
    const competition = compSnap.data() as FirestoreCompetition;

    // Organizers and moderators already hold strictly more than any code
    // grants — writing a scoped grant would only narrow the staff screen's
    // reading of who they are.
    if (
      (competition.organizer_ids ?? []).includes(uid) ||
      (competition.moderator_ids ?? []).includes(uid)
    ) {
      return NextResponse.json({
        cid,
        competitionName: competition.name,
        scope: scopeFromFirestore(codeData.scope),
        label: codeData.label,
        alreadyStaff: true,
      });
    }

    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();
    const name =
      [userData?.first_name, userData?.last_name].filter(Boolean).join(" ").trim() ||
      userData?.email ||
      codeData.label;

    const grant: FirestoreStaffGrant = {
      uid,
      name,
      code,
      label: codeData.label,
      scope: codeData.scope,
      granted_at: new Date().toISOString(),
      expires_at_ms: expiresMs,
      revoked: false,
    };

    await adminDb
      .collection("competitions")
      .doc(cid)
      .collection("staff_grants")
      .doc(uid)
      .set(grant);

    await codeRef.update({
      used_count: FieldValue.increment(1),
      last_used_at: new Date().toISOString(),
    });

    return NextResponse.json({
      cid,
      competitionName: competition.name,
      scope: scopeFromFirestore(codeData.scope),
      label: codeData.label,
      alreadyStaff: false,
    });
  } catch (err) {
    console.error("Staff code redeem error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
