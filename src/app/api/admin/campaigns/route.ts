import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendPushToUser } from "@/lib/fcm-server";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { ciblesDeCampagne, type Campagne } from "@/lib/admin-segments";
import {
  sendNotificationEmail,
  campaignManagerNoTeamHtml,
  campaignPlayerNoTeamHtml,
  campaignWelcomeManagerHtml,
  campaignSansEspaceHtml,
} from "@/lib/email";
import { lireGenre } from "@/lib/genre";

// ── Auth guard ──────────────────────────────────────────────

async function verifySuperadmin(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(header.split("Bearer ")[1]);
    const doc = await adminDb.collection("users").doc(decoded.uid).get();
    return estSuperadmin(doc.data()) ? decoded.uid : null;
  } catch {
    return null;
  }
}

// ── Campaign definitions ────────────────────────────────────

/**
 * Les campagnes (voir `Campagne`, lib/admin-segments). « sans_espace » vise
 * les comptes qui n'ouvrent AUCUN espace : ni rôle choisi, ni casquette.
 * C'est la population la plus grande et la plus muette du produit — elle ne
 * voit qu'un tableau de scores, et rien dans le produit ne vient la chercher.
 */
type CampaignType = Campagne;

const CAMPAIGN_DEFAULTS: Record<
  CampaignType,
  { title: string; body: string; link: string }
> = {
  manager_no_team: {
    title: "Ton équipe t'attend 👋",
    body: "Crée ton équipe en 2 minutes et commence à recruter tes joueurs.",
    link: "/teams",
  },
  player_no_team: {
    // Sans accord : la même annonce part à des joueurs et à des joueuses.
    title: "Des équipes recrutent près de chez toi ⚽",
    body: "Des équipes actives près de chez toi cherchent des joueurs. Candidate maintenant.",
    link: "/mercato",
  },
  manager_welcome: {
    title: "Bienvenue sur KoppaFoot ! 🎉",
    body: "Ton compte manager est prêt. Crée ton équipe et défie tes premiers adversaires.",
    link: "/teams",
  },
  sans_espace: {
    title: "Tu joues, tu coaches, tu arbitres ? ⚽",
    body: "Choisis ton rôle pour ouvrir ton espace : effectif, feuilles de match, convocations.",
    link: "/roles#choisir",
  },
};

// ── Targeting ───────────────────────────────────────────────

/** Voir `ciblesDeCampagne` (lib/admin-segments) : le rôle effectif, pas `user_type`. */
async function getTargetIds(type: CampaignType): Promise<string[]> {
  const [comptes, equipes, demandes] = await Promise.all([
    adminDb.collection("users").get(),
    adminDb.collection("teams").select("manager_id", "member_ids", "is_ghost").get(),
    adminDb.collection("join_requests").where("status", "==", "pending").select("player_id").get(),
  ]);
  return ciblesDeCampagne(
    type,
    comptes.docs.map((d) => ({ uid: d.id, data: d.data() })),
    equipes.docs.map((d) => d.data()),
    new Set(demandes.docs.map((d) => String(d.data().player_id ?? ""))),
    new Date(),
  );
}

// ── GET, stats ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!(await verifySuperadmin(req))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const types: CampaignType[] = [
    "sans_espace", "manager_no_team", "player_no_team", "manager_welcome",
  ];
  const results = await Promise.all(
    types.map(async (type) => {
      const userIds = await getTargetIds(type);
      return { type, count: userIds.length, defaults: CAMPAIGN_DEFAULTS[type] };
    })
  );

  return NextResponse.json(results);
}

// ── POST, send campaign ────────────────────────────────────

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

  // Push + personalized email, best effort, parallel
  await Promise.allSettled(
    userIds.map(async (uid) => {
      const userSnap = await adminDb.collection("users").doc(uid).get();
      const data = userSnap.data();
      if (!data) return;

      const firstName: string = data.first_name ?? "";
      const email: string | undefined = data.email;

      await sendPushToUser(uid, { title, body, link: defaults.link, category: "annonces" }).catch(() => {});

      if (email) {
        let html = "";
        if (campaignType === "manager_no_team") html = campaignManagerNoTeamHtml(firstName, lireGenre(data.gender));
        if (campaignType === "player_no_team") html = campaignPlayerNoTeamHtml(firstName);
        if (campaignType === "manager_welcome") html = campaignWelcomeManagerHtml(firstName);
        if (campaignType === "sans_espace") html = campaignSansEspaceHtml(firstName);
        if (html) await sendNotificationEmail(email, title, html).catch(() => {});
      }
    })
  );

  return NextResponse.json({ ok: true, count: userIds.length });
}
