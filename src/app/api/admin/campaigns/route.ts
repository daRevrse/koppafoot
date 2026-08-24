import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendPushToUser } from "@/lib/fcm-server";
import {
  sendNotificationEmail,
  campaignManagerNoTeamHtml,
  campaignPlayerNoTeamHtml,
  campaignWelcomeManagerHtml,
  campaignNoRoleHtml,
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
  | "manager_welcome"
  /**
   * Les comptes qui n'ont jamais choisi de rôle.
   *
   * C'est la population la plus grande et la plus muette du produit : un
   * compte sans rôle ne peut ni jouer, ni gérer, ni arbitrer, il ne voit
   * qu'un tableau de scores. Rien dans le produit ne vient le chercher — il
   * faut donc aller le chercher.
   */
  | "no_role";

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
  no_role: {
    title: "Vous jouez, vous coachez, vous arbitrez ? ⚽",
    body: "Choisissez votre rôle pour ouvrir votre espace : effectif, feuilles de match, convocations.",
    link: "/evolution",
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

  if (type === "no_role") {
    // Firestore ne sait pas demander « ce champ est absent » : un compte
    // d'avant l'onboarding Évolution n'a pas la clé du tout, un autre l'a à
    // null. Les deux comptent, donc le tri se fait en mémoire — comme les
    // autres campagnes de ce fichier, qui parcourent déjà la collection.
    const snap = await adminDb.collection("users").get();
    return snap.docs
      .filter((d) => {
        const data = d.data();
        // Les comptes à casquette (organisateur, propriétaire) et les
        // administrateurs ne sont pas concernés : leur place dans le produit
        // ne passe pas par le rôle Évolution.
        if (data.user_type === "superadmin" || data.user_type === "organizer") return false;
        if (data.is_organizer === true || data.is_venue_owner === true) return false;
        if (data.is_active === false) return false;
        return !data.evolution_role;
      })
      .map((d) => d.id);
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

// ── GET, stats ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!(await verifySuperadmin(req))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const types: CampaignType[] = [
    "no_role", "manager_no_team", "player_no_team", "manager_welcome",
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
        if (campaignType === "manager_no_team") html = campaignManagerNoTeamHtml(firstName);
        if (campaignType === "player_no_team") html = campaignPlayerNoTeamHtml(firstName);
        if (campaignType === "manager_welcome") html = campaignWelcomeManagerHtml(firstName);
        if (campaignType === "no_role") html = campaignNoRoleHtml(firstName);
        if (html) await sendNotificationEmail(email, title, html).catch(() => {});
      }
    })
  );

  return NextResponse.json({ ok: true, count: userIds.length });
}
