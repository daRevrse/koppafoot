import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { authorizeOrganizer } from "@/lib/competition-api-auth";
import {
  generateStaffCode,
  normalizeStaffCode,
  parseStaffScope,
  scopeFromFirestore,
  scopeToFirestore,
} from "@/lib/staff-scope";
import type { FirestoreStaffCode } from "@/types";

// ============================================
// Staff access codes — organizer side
//
// Codes live in a top-level `staff_codes/{CODE}` collection that Firestore
// rules make unreadable to every client: a code is a secret, and the only way
// to see one is through this route, as an organizer of its competition.
// ============================================

const MAX_CODES_PER_COMPETITION = 50;

/** GET /api/competitions/staff-codes?cid=… — every code of the competition. */
export async function GET(req: NextRequest) {
  try {
    const cid = req.nextUrl.searchParams.get("cid");
    if (!cid) {
      return NextResponse.json({ error: "cid requis" }, { status: 400 });
    }

    const authResult = await authorizeOrganizer(req, cid);
    if ("error" in authResult) return authResult.error;

    const snap = await adminDb
      .collection("staff_codes")
      .where("competition_id", "==", cid)
      .get();

    const codes = snap.docs
      .map((d) => {
        const data = d.data() as FirestoreStaffCode;
        return {
          code: d.id,
          competitionId: data.competition_id,
          competitionName: data.competition_name,
          label: data.label,
          scope: scopeFromFirestore(data.scope),
          createdBy: data.created_by,
          createdAt: data.created_at,
          expiresAt: data.expires_at,
          revoked: data.revoked === true,
          usedCount: data.used_count ?? 0,
          lastUsedAt: data.last_used_at ?? null,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ codes });
  } catch (err) {
    console.error("Staff codes list error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** POST — mint a code. Body: { cid, label, scope, expiresAt? }. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cid, label, scope: rawScope, expiresAt } = body ?? {};
    if (!cid) {
      return NextResponse.json({ error: "cid requis" }, { status: 400 });
    }

    const trimmedLabel = typeof label === "string" ? label.trim() : "";
    if (!trimmedLabel) {
      return NextResponse.json({ error: "Donne un nom à ce code" }, { status: 400 });
    }

    // An unknown scope would be stored and then silently refused by the rules,
    // so it is rejected here rather than handed out as a dead code.
    const scope = parseStaffScope(rawScope);
    if (!scope) {
      return NextResponse.json({ error: "Portée invalide" }, { status: 400 });
    }

    let expiresIso: string | null = null;
    if (typeof expiresAt === "string" && expiresAt.trim()) {
      const d = new Date(expiresAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Date d'expiration invalide" }, { status: 400 });
      }
      if (d.getTime() <= Date.now()) {
        return NextResponse.json({ error: "L'expiration est déjà passée" }, { status: 400 });
      }
      expiresIso = d.toISOString();
    }

    const authResult = await authorizeOrganizer(req, cid);
    if ("error" in authResult) return authResult.error;
    const { callerUid, competition } = authResult;

    const existing = await adminDb
      .collection("staff_codes")
      .where("competition_id", "==", cid)
      .count()
      .get();
    if (existing.data().count >= MAX_CODES_PER_COMPETITION) {
      return NextResponse.json(
        { error: `Maximum ${MAX_CODES_PER_COMPETITION} codes par compétition — révoque les anciens` },
        { status: 400 },
      );
    }

    // Collisions are vanishingly rare (29^8) but a duplicate would hand two
    // competitions the same secret, so the write refuses to overwrite.
    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateStaffCode();
      const ref = adminDb.collection("staff_codes").doc(candidate);
      const payload: FirestoreStaffCode = {
        competition_id: cid,
        competition_name: competition.name,
        label: trimmedLabel,
        scope: scopeToFirestore(scope),
        created_by: callerUid,
        created_at: new Date().toISOString(),
        expires_at: expiresIso,
        revoked: false,
        used_count: 0,
        last_used_at: null,
      };
      try {
        await ref.create(payload);
        code = candidate;
        break;
      } catch {
        // Taken — try another one.
      }
    }
    if (!code) {
      return NextResponse.json({ error: "Impossible de générer un code" }, { status: 500 });
    }

    return NextResponse.json({ code, label: trimmedLabel, scope, expiresAt: expiresIso });
  } catch (err) {
    console.error("Staff code create error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE — revoke a code. Body: { cid, code }.
 *
 * Revoking also cuts every access already redeemed from it: an organizer who
 * kills a code that leaked expects the people holding it to lose the console,
 * not to keep it until the tournament ends.
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { cid, code } = body ?? {};
    if (!cid || typeof code !== "string") {
      return NextResponse.json({ error: "cid et code requis" }, { status: 400 });
    }

    const authResult = await authorizeOrganizer(req, cid);
    if ("error" in authResult) return authResult.error;

    const codeId = normalizeStaffCode(code);
    const ref = adminDb.collection("staff_codes").doc(codeId);
    const snap = await ref.get();
    if (!snap.exists || (snap.data() as FirestoreStaffCode).competition_id !== cid) {
      return NextResponse.json({ error: "Code introuvable" }, { status: 404 });
    }

    await ref.update({ revoked: true });

    const grants = await adminDb
      .collection("competitions")
      .doc(cid)
      .collection("staff_grants")
      .where("code", "==", codeId)
      .get();
    if (!grants.empty) {
      const batch = adminDb.batch();
      for (const g of grants.docs) batch.update(g.ref, { revoked: true });
      await batch.commit();
    }

    return NextResponse.json({ ok: true, revokedGrants: grants.size });
  } catch (err) {
    console.error("Staff code revoke error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
