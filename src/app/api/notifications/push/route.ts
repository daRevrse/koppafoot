import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/fcm-server";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const { userId, title, body, link, type } = await req.json();
  if (!userId || !title || !body) {
    return NextResponse.json({ error: "userId, title et body requis" }, { status: 400 });
  }

  await sendPushToUser(userId, { title, body, link }).catch(() => {});

  // Email pour les types haute priorité
  if (type === "invitation" || type === "join_request" || type === "admin_message") {
    const { sendNotificationEmail, adminMessageEmailHtml } = await import("@/lib/email");
    const userSnap = await adminDb.collection("users").doc(userId).get();
    const email = userSnap.data()?.email;
    if (email) {
      const html = adminMessageEmailHtml(title, body);
      await sendNotificationEmail(email, title, html).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
