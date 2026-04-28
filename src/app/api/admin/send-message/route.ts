import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendPushToUser } from "@/lib/fcm-server";
import { sendNotificationEmail, adminMessageEmailHtml } from "@/lib/email";

const VALID_ROLES = ["player", "manager", "referee", "venue_owner"];

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const callerDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (callerDoc.data()?.user_type !== "superadmin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const { title, body, target } = await req.json();
  if (!title || !body || !target) {
    return NextResponse.json({ error: "title, body et target requis" }, { status: 400 });
  }

  // Resolve recipient user IDs and emails
  const userIds: string[] = [];
  const emails: Record<string, string> = {};

  if (target === "all") {
    const snap = await adminDb.collection("users").select("email").get();
    snap.docs.forEach((d) => {
      userIds.push(d.id);
      const email = d.data().email;
      if (email) emails[d.id] = email;
    });
  } else if (VALID_ROLES.includes(target)) {
    const snap = await adminDb.collection("users").where("user_type", "==", target).select("email").get();
    snap.docs.forEach((d) => {
      userIds.push(d.id);
      const email = d.data().email;
      if (email) emails[d.id] = email;
    });
  } else {
    // treat target as email address
    const snap = await adminDb.collection("users").where("email", "==", target).limit(1).get();
    if (snap.empty) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }
    const d = snap.docs[0];
    userIds.push(d.id);
    const email = d.data().email;
    if (email) emails[d.id] = email;
  }

  // Write notifications in Firestore batches (max 500 per batch)
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 500) chunks.push(userIds.slice(i, i + 500));

  for (const chunk of chunks) {
    const batch = adminDb.batch();
    for (const uid of chunk) {
      const ref = adminDb.collection("notifications").doc();
      batch.set(ref, {
        user_id: uid,
        type: "admin_message",
        title,
        body,
        link: "/dashboard",
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  // Push + email — best effort, parallel
  const html = adminMessageEmailHtml(title, body);
  await Promise.allSettled(
    userIds.map(async (uid) => {
      await sendPushToUser(uid, { title, body, link: "/dashboard" }).catch(() => {});
      const email = emails[uid];
      if (email) {
        await sendNotificationEmail(email, title, html).catch(() => {});
      }
    })
  );

  return NextResponse.json({ ok: true, count: userIds.length });
}
