import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  sendNotificationEmail,
  organizerApplicationReceivedHtml,
  organizerApplicationAdminHtml,
} from "@/lib/email";

/**
 * Organizer applications — the "Organiser" button is an application form,
 * reviewed by the system admin (see /admin/organizers + the PATCH route).
 *
 * Everything goes through the Admin SDK: the `organizer_applications`
 * collection needs no Firestore rules (clients never touch it directly).
 *
 * POST  — submit an application (any authenticated non-organizer).
 * GET   — superadmin: all applications; others: their own only.
 */

async function verifyBearer(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyBearer(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { motivation, competitionName, city, phone } = (await req.json()) as {
      motivation?: string; competitionName?: string; city?: string; phone?: string;
    };
    if (!motivation?.trim() || motivation.trim().length < 20) {
      return NextResponse.json(
        { error: "Décris ton projet en quelques phrases (20 caractères minimum)." },
        { status: 400 },
      );
    }

    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }
    const u = userSnap.data()!;
    if (u.user_type === "organizer" || u.user_type === "superadmin") {
      return NextResponse.json({ error: "Tu es déjà organisateur." }, { status: 409 });
    }

    // One pending application at a time.
    const pending = await adminDb
      .collection("organizer_applications")
      .where("uid", "==", uid)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!pending.empty) {
      return NextResponse.json(
        { error: "Ta candidature est déjà en cours d'examen." },
        { status: 409 },
      );
    }

    const applicantName = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Utilisateur";
    const doc = await adminDb.collection("organizer_applications").add({
      uid,
      name: applicantName,
      email: u.email ?? null,
      phone: phone?.trim() || u.phone || null,
      city: city?.trim() || u.location_city || null,
      motivation: motivation.trim(),
      competition_name: competitionName?.trim() || null,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      created_at: FieldValue.serverTimestamp(),
    });

    // Emails — best-effort, never block the submission.
    if (u.email) {
      sendNotificationEmail(
        u.email,
        "Candidature organisateur reçue — KoppaFoot",
        organizerApplicationReceivedHtml(u.first_name ?? "toi"),
      ).catch((e) => console.warn("[organizer-applications] applicant email failed:", e?.message));
    }
    adminDb
      .collection("users")
      .where("user_type", "==", "superadmin")
      .get()
      .then((admins) =>
        Promise.allSettled(
          admins.docs
            .map((d) => d.data()?.email)
            .filter(Boolean)
            .map((email: string) =>
              sendNotificationEmail(
                email,
                `Nouvelle candidature organisateur — ${applicantName}`,
                organizerApplicationAdminHtml(
                  applicantName,
                  u.email ?? "—",
                  city?.trim() || u.location_city || "",
                  motivation.trim(),
                ),
              ),
            ),
        ),
      )
      .catch((e) => console.warn("[organizer-applications] admin email failed:", e?.message));

    return NextResponse.json({ ok: true, id: doc.id });
  } catch (err) {
    console.error("[organizer-applications POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const uid = await verifyBearer(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const callerSnap = await adminDb.collection("users").doc(uid).get();
    const isSuperadmin = callerSnap.exists && callerSnap.data()?.user_type === "superadmin";

    const base = adminDb.collection("organizer_applications");
    const snap = isSuperadmin
      ? await base.orderBy("created_at", "desc").limit(200).get()
      : await base.where("uid", "==", uid).get();

    const applications = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        uid: x.uid,
        name: x.name ?? "",
        email: x.email ?? null,
        phone: x.phone ?? null,
        city: x.city ?? null,
        motivation: x.motivation ?? "",
        competitionName: x.competition_name ?? null,
        status: x.status ?? "pending",
        createdAt: x.created_at?.toDate?.()?.toISOString() ?? null,
        reviewedAt: x.reviewed_at?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ applications });
  } catch (err) {
    console.error("[organizer-applications GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
