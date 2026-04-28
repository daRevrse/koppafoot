import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendPushToUser } from "@/lib/fcm-server";
import {
  sendNotificationEmail,
  campaignManagerNoTeamHtml,
  campaignPlayerNoTeamHtml,
  campaignWelcomeManagerHtml,
} from "@/lib/email";

// ── Auth guard ──────────────────────────────────────────────

async function verifySuperadmin(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(header.split("Bearer ")[1]);
    const doc = await adminDb.collection("users").doc(decoded.uid).get();
    return doc.data()?.user_type === "superadmin" ? decoded.uid : null;
  } catch {
    return null;
  }
}

// ── Campaign definitions ────────────────────────────────────

export type CampaignType =
  | "manager_no_team"
  | "player_no_team"
  | "manager_welcome";

const CAMPAIGN_DEFAULTS: Record<
  CampaignType,
  { title: string; body: string; link: string }
> = {
  manager_no_team: {
    title: "Votre équipe vous attend 👋",
    body: "Créez votre équipe en 2 minutes et commencez à recruter vos joueurs.",
    link: "/teams",
  },
  player_no_team: {
    title: "Des équipes cherchent un joueur comme vous ⚽",
    body: "Des équipes actives près de chez vous cherchent des joueurs. Candidatez maintenant.",
    link: "/mercato",
  },
  manager_welcome: {
    title: "Bienvenue sur KoppaFoot ! 🎉",
    body: "Votre compte manager est prêt. Créez votre équipe et défiez vos premiers adversaires.",
    link: "/teams",
  },
};

// ── Targeting queries ───────────────────────────────────────

async function getTargetIds(type: CampaignType): Promise<string[]> {
  if (type === "manager_no_team") {
    const managersSnap = await adminDb
      .collection("users")
      .where("user_type", "==", "manager")
      .get();
    const managerIds = managersSnap.docs.map((d) => d.id);
    if (!managerIds.length) return [];

    const teamsSnap = await adminDb.collection("teams").get();
    const managersWithTeam = new Set(
      teamsSnap.docs.map((d) => d.data().manager_id as string).filter(Boolean)
    );
    return managerIds.filter((id) => !managersWithTeam.has(id));
  }

  if (type === "player_no_team") {
    const playersSnap = await adminDb
      .collection("users")
      .where("user_type", "==", "player")
      .get();
    const playerIds = playersSnap.docs.map((d) => d.id);
    if (!playerIds.length) return [];

    const jrSnap = await adminDb.collection("join_requests").get();
    const playersWithRequest = new Set(
      jrSnap.docs.map((d) => d.data().player_id as string).filter(Boolean)
    );
    return playerIds.filter((id) => !playersWithRequest.has(id));
  }

  if (type === "manager_welcome") {
    const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const snap = await adminDb
      .collection("users")
      .where("user_type", "==", "manager")
      .get();
    return snap.docs
      .filter((d) => {
        const ca = d.data().created_at;
        const date = typeof ca === "string" ? ca : ca?.toDate?.()?.toISOString?.() ?? "";
        return date >= cutoff;
      })
      .map((d) => d.id);
  }

  return [];
}

// ── GET — stats ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!(await verifySuperadmin(req))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const types: CampaignType[] = ["manager_no_team", "player_no_team", "manager_welcome"];
  const results = await Promise.all(
    types.map(async (type) => {
      const userIds = await getTargetIds(type);
      return { type, count: userIds.length, defaults: CAMPAIGN_DEFAULTS[type] };
    })
  );

  return NextResponse.json(results);
}

// ── POST — send campaign ────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await verifySuperadmin(req))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { campaignType, title, body } = (await req.json()) as {
    campaignType: CampaignType;
    title: string;
    body: string;
  };

  if (!campaignType || !title || !body) {
    return NextResponse.json({ error: "campaignType, title et body requis" }, { status: 400 });
  }
  if (!CAMPAIGN_DEFAULTS[campaignType]) {
    return NextResponse.json({ error: "campaignType invalide" }, { status: 400 });
  }

  const defaults = CAMPAIGN_DEFAULTS[campaignType];
  const userIds = await getTargetIds(campaignType);
  if (!userIds.length) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  // Write in-app notifications in Firestore batches (max 500 per batch)
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 500) chunks.push(userIds.slice(i, i + 500));
  for (const chunk of chunks) {
    const batch = adminDb.batch();
    for (const uid of chunk) {
      batch.set(adminDb.collection("notifications").doc(), {
        user_id: uid,
        type: "admin_message",
        title,
        body,
        link: defaults.link,
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  // Push + personalized email — best effort, parallel
  await Promise.allSettled(
    userIds.map(async (uid) => {
      const userSnap = await adminDb.collection("users").doc(uid).get();
      const data = userSnap.data();
      if (!data) return;

      const firstName: string = data.first_name ?? "";
      const email: string | undefined = data.email;

      await sendPushToUser(uid, { title, body, link: defaults.link }).catch(() => {});

      if (email) {
        let html = "";
        if (campaignType === "manager_no_team") html = campaignManagerNoTeamHtml(firstName);
        if (campaignType === "player_no_team") html = campaignPlayerNoTeamHtml(firstName);
        if (campaignType === "manager_welcome") html = campaignWelcomeManagerHtml(firstName);
        if (html) await sendNotificationEmail(email, title, html).catch(() => {});
      }
    })
  );

  return NextResponse.json({ ok: true, count: userIds.length });
}
