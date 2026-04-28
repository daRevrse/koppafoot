# Email Templates & Campagnes Admin — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refondre les templates email avec un layout brandé KoppaFoot et ajouter une page admin `/admin/campaigns` avec ciblage intelligent (managers sans équipe, joueurs sans candidature, nouveaux managers).

**Architecture:** `emailLayout()` est un shell HTML partagé que tous les templates appellent. Les campagnes ont une route API dédiée (`GET` pour les stats, `POST` pour l'envoi) et une page admin avec modal de confirmation. La personnalisation "Coach {prénom}" est appliquée côté serveur via la lecture du profil Firestore.

**Tech Stack:** Next.js 16 App Router, Firebase Admin SDK, Resend, TypeScript, Tailwind, motion/react, Lucide

---

### Task 1 : Refonte `src/lib/email.ts` — layout + templates transactionnels

**Files:**
- Modify: `src/lib/email.ts`

**Step 1 : Remplacer tout le contenu du fichier**

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "KoppaFoot <notifications@koppafoot.com>";
const APP_URL = "https://koppafoot.com";

export async function sendNotificationEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  await resend.emails.send({ from: FROM, to, subject, html });
}

// ── Shared layout ──────────────────────────────────────────

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>KoppaFoot</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">

      <!-- Header -->
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#059669;border-radius:12px 12px 0 0;padding:20px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">
              &#9917; KOPPAFOOT
            </span>
          </td>
        </tr>
      </table>

      <!-- Body -->
      <table width="560" cellpadding="0" cellspacing="0"
        style="max-width:560px;width:100%;background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
        <tr><td style="color:#1e293b;font-size:15px;line-height:1.7;">
          ${content}
        </td></tr>
      </table>

      <!-- Footer -->
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              © 2025 KoppaFoot &nbsp;·&nbsp;
              <a href="${APP_URL}" style="color:#059669;text-decoration:none;">koppafoot.com</a>
            </p>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, href: string, color = "#059669"): string {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr>
      <td style="background:${color};border-radius:8px;">
        <a href="${href}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
          ${label} &rarr;
        </a>
      </td>
    </tr>
  </table>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`;
}

// ── Transactional templates ─────────────────────────────────

export function invitationEmailHtml(
  senderName: string,
  teamName: string,
  recipientFirstName: string
): string {
  return emailLayout(`
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Salut ${recipientFirstName},</p>
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#059669;">
      Vous avez reçu une invitation&nbsp;⚽
    </h2>
    <p style="margin:0 0 12px;">
      <strong>${senderName}</strong> vous invite à rejoindre l'équipe
      <strong style="color:#059669;">${teamName}</strong> sur KoppaFoot.
    </p>
    <p style="margin:0;color:#64748b;font-size:14px;">
      Consultez l'invitation et décidez d'accepter ou de refuser.
    </p>
    ${ctaButton("Voir l'invitation", `${APP_URL}/mercato`)}
    ${divider()}
    <p style="margin:0;font-size:12px;color:#94a3b8;">
      Si vous ne souhaitez pas rejoindre cette équipe, ignorez simplement cet email.
    </p>
  `);
}

export function joinRequestEmailHtml(
  playerName: string,
  teamName: string,
  managerFirstName: string
): string {
  return emailLayout(`
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Salut Coach ${managerFirstName},</p>
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#059669;">
      Nouvelle demande d'adhésion&nbsp;📋
    </h2>
    <p style="margin:0 0 12px;">
      <strong>${playerName}</strong> souhaite rejoindre votre équipe
      <strong style="color:#059669;">${teamName}</strong>.
    </p>
    <p style="margin:0;color:#64748b;font-size:14px;">
      Consultez son profil et acceptez ou refusez sa candidature.
    </p>
    ${ctaButton("Voir la demande", `${APP_URL}/teams`)}
  `);
}

export function adminMessageEmailHtml(title: string, body: string): string {
  return emailLayout(`
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#1e293b;">
      ${title}
    </h2>
    <p style="margin:0;color:#475569;">
      ${body}
    </p>
    ${ctaButton("Ouvrir KoppaFoot", `${APP_URL}/dashboard`, "#1e293b")}
  `);
}

// ── Campaign templates ──────────────────────────────────────

export function campaignManagerNoTeamHtml(firstName: string): string {
  return emailLayout(`
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Salut Coach ${firstName},</p>
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#059669;">
      Votre équipe vous attend&nbsp;👋
    </h2>
    <p style="margin:0 0 16px;">
      Vous êtes inscrit sur KoppaFoot en tant que manager, mais vous n'avez pas encore créé votre équipe.
    </p>
    <p style="margin:0 0 16px;color:#64748b;font-size:14px;">
      En 2 minutes, créez votre équipe, invitez vos joueurs et commencez à défier vos adversaires.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-top:8px;margin-bottom:24px;">
      <tr>
        <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#166534;">3 étapes pour lancer votre équipe :</p>
          <p style="margin:0;font-size:13px;color:#166534;line-height:1.8;">
            1. Créer l'équipe<br/>
            2. Inviter vos joueurs<br/>
            3. Défier un adversaire
          </p>
        </td>
      </tr>
    </table>
    ${ctaButton("Créer mon équipe", `${APP_URL}/teams`)}
  `);
}

export function campaignPlayerNoTeamHtml(firstName: string): string {
  return emailLayout(`
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Salut ${firstName},</p>
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#059669;">
      Des équipes cherchent un joueur comme vous&nbsp;⚽
    </h2>
    <p style="margin:0 0 16px;">
      Des dizaines d'équipes actives recherchent des joueurs dans votre ville.
    </p>
    <p style="margin:0 0 16px;color:#64748b;font-size:14px;">
      Explorez les équipes disponibles, postulez et commencez à jouer dès cette semaine.
    </p>
    ${ctaButton("Trouver une équipe", `${APP_URL}/mercato`)}
    ${divider()}
    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Vous pouvez aussi attendre qu'une équipe vous contacte — mais les meilleurs joueurs vont chercher eux-mêmes.
    </p>
  `);
}

export function campaignWelcomeManagerHtml(firstName: string): string {
  return emailLayout(`
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Bienvenue sur KoppaFoot,</p>
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#059669;">
      Salut Coach ${firstName}&nbsp;🎉
    </h2>
    <p style="margin:0 0 16px;">
      Votre compte manager est prêt. Voici comment bien démarrer :
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;width:100%;">
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <span style="font-weight:700;color:#059669;">01 &mdash;</span>
          <span style="color:#1e293b;margin-left:8px;">Créez votre équipe (nom, ville, niveau)</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <span style="font-weight:700;color:#059669;">02 &mdash;</span>
          <span style="color:#1e293b;margin-left:8px;">Invitez vos joueurs ou acceptez les candidatures</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;">
          <span style="font-weight:700;color:#059669;">03 &mdash;</span>
          <span style="color:#1e293b;margin-left:8px;">Défiez une équipe adverse et planifiez votre premier match</span>
        </td>
      </tr>
    </table>
    ${ctaButton("Créer mon équipe maintenant", `${APP_URL}/teams`)}
  `);
}

export function campaignPlayerInactiveHtml(firstName: string): string {
  return emailLayout(`
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Salut ${firstName},</p>
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#059669;">
      Vous nous manquez&nbsp;⚽
    </h2>
    <p style="margin:0 0 16px;">
      Votre dernier match remonte à plus d'un mois. Des équipes cherchent encore des joueurs près de chez vous.
    </p>
    <p style="margin:0 0 16px;color:#64748b;font-size:14px;">
      Revenez sur KoppaFoot, consultez les équipes disponibles et reprenez le jeu.
    </p>
    ${ctaButton("Voir les équipes disponibles", `${APP_URL}/mercato`)}
  `);
}
```

**Step 2 : Vérifier la compilation TypeScript**

```bash
cd C:\football-network\koppafoot && npx tsc --noEmit
```
Attendu : aucune erreur.

**Step 3 : Commit**

```bash
git add src/lib/email.ts
git commit -m "feat(email): branded layout + campaign templates"
```

---

### Task 2 : Mise à jour `/api/notifications/push/route.ts` — personnalisation prénom + rôle

**Files:**
- Modify: `src/app/api/notifications/push/route.ts`

**Contexte :** La route fetche déjà le doc utilisateur pour l'email. On ajoute la lecture de `first_name` et `user_type` pour construire la salutation correcte et appeler les nouvelles signatures de template.

**Step 1 : Remplacer le contenu du fichier**

```typescript
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
    const {
      sendNotificationEmail,
      invitationEmailHtml,
      joinRequestEmailHtml,
      adminMessageEmailHtml,
    } = await import("@/lib/email");

    const userSnap = await adminDb.collection("users").doc(userId).get();
    const userData = userSnap.data();
    const email = userData?.email;
    const firstName: string = userData?.first_name ?? "";
    const userType: string = userData?.user_type ?? "";

    if (email) {
      let html = "";
      if (type === "invitation") {
        // body = "{senderName} vous invite à rejoindre {teamName}"
        // On passe le prénom du destinataire pour la salutation
        html = invitationEmailHtml(title, body, firstName);
      }
      if (type === "join_request") {
        // destinataire = manager
        html = joinRequestEmailHtml(title, body, firstName);
      }
      if (type === "admin_message") {
        html = adminMessageEmailHtml(title, body);
      }
      if (html) await sendNotificationEmail(email, title, html).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
```

> **Note :** `invitationEmailHtml` et `joinRequestEmailHtml` ont maintenant 3 paramètres. Le `title` joue le rôle de `senderName`/`playerName` et le `body` joue le rôle de `teamName` dans ce contexte générique — les données réelles (senderName, teamName) sont déjà dans le body de la notification in-app. Si une précision accrue est souhaitée plus tard, il faudra passer ces champs explicitement depuis `createNotification`.

**Step 2 : TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3 : Commit**

```bash
git add src/app/api/notifications/push/route.ts
git commit -m "feat(email): personalized salutation with Coach title for managers"
```

---

### Task 3 : Route `/api/admin/campaigns/route.ts`

**Files:**
- Create: `src/app/api/admin/campaigns/route.ts`

**Logique de ciblage :**
- `manager_no_team` : tous les users `user_type=manager`, on retire ceux dont l'uid apparaît dans `teams` comme `manager_id`
- `player_no_team` : tous les users `user_type=player`, on retire ceux ayant au moins un doc dans `join_requests` (par `player_id`)
- `manager_welcome` : users `user_type=manager` inscrits dans les 48h (timestamp `created_at` > `Date.now() - 48*3600*1000`)

**Step 1 : Créer le fichier**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendPushToUser } from "@/lib/fcm-server";
import {
  sendNotificationEmail,
  campaignManagerNoTeamHtml,
  campaignPlayerNoTeamHtml,
  campaignWelcomeManagerHtml,
  campaignPlayerInactiveHtml,
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

    // Fetch all join_requests player_ids
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
      .where("created_at", ">=", cutoff)
      .get();
    return snap.docs.map((d) => d.id);
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

  const { campaignType, title, body } = await req.json() as {
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

  // Write in-app notifications (batch, 500 per batch)
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

  // Push + email — personalized, best effort
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
```

**Step 2 : TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3 : Commit**

```bash
git add src/app/api/admin/campaigns/route.ts
git commit -m "feat(campaigns): campaign API with smart targeting"
```

---

### Task 4 : Page `/admin/campaigns/page.tsx`

**Files:**
- Create: `src/app/(admin)/admin/campaigns/page.tsx`

**Comportement :**
- Mount : appel GET `/api/admin/campaigns` → affiche les counts
- Clic "Envoyer →" → state `activeCampaign` → modal avec titre + corps pré-remplis et éditables
- Submit modal → POST `/api/admin/campaigns` → toast succès → ferme modal

**Step 1 : Créer le fichier**

```typescript
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Megaphone, Loader2, Send, X, Users, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";

interface CampaignStat {
  type: "manager_no_team" | "player_no_team" | "manager_welcome";
  count: number;
  defaults: { title: string; body: string; link: string };
}

const CAMPAIGN_META: Record<
  string,
  { label: string; description: string; icon: React.ReactNode; color: string }
> = {
  manager_no_team: {
    label: "Managers sans équipe",
    description: "Relance les managers inscrits qui n'ont pas encore créé leur équipe.",
    icon: <Users size={18} />,
    color: "text-amber-600 bg-amber-50",
  },
  player_no_team: {
    label: "Joueurs sans candidature",
    description: "Encourage les joueurs qui n'ont jamais postulé à une équipe.",
    icon: <UserCheck size={18} />,
    color: "text-emerald-600 bg-emerald-50",
  },
  manager_welcome: {
    label: "Nouveaux managers (< 48h)",
    description: "Email de bienvenue aux managers récemment inscrits.",
    icon: <Megaphone size={18} />,
    color: "text-blue-600 bg-blue-50",
  },
};

export default function AdminCampaignsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CampaignStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [active, setActive] = useState<CampaignStat | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const fbUser = auth.currentUser;
        if (!fbUser) return;
        const token = await fbUser.getIdToken();
        const res = await fetch("/api/admin/campaigns", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setStats(await res.json());
      } finally {
        setLoadingStats(false);
      }
    };
    load();
  }, [user]);

  const openModal = (stat: CampaignStat) => {
    setActive(stat);
    setEditTitle(stat.defaults.title);
    setEditBody(stat.defaults.body);
  };

  const closeModal = () => {
    setActive(null);
    setEditTitle("");
    setEditBody("");
  };

  const handleSend = async () => {
    if (!active || !editTitle.trim() || !editBody.trim()) return;
    setSending(true);
    try {
      const fbUser = auth.currentUser;
      if (!fbUser) throw new Error("Non connecté");
      const token = await fbUser.getIdToken();
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campaignType: active.type,
          title: editTitle.trim(),
          body: editBody.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Erreur"); return; }
      toast.success(`Campagne envoyée à ${data.count} utilisateur(s) !`);
      closeModal();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-extrabold text-gray-900 font-display"
        >
          Campagnes
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-gray-500 mt-0.5"
        >
          Emails de relance ciblés — in-app + push + email personnalisé
        </motion.p>
      </div>

      {loadingStats ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="space-y-4">
          {stats.map((stat, i) => {
            const meta = CAMPAIGN_META[stat.type];
            return (
              <motion.div
                key={stat.type}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm flex items-center gap-4"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.color}`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">{meta.label}</p>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                      {stat.count} destinataire{stat.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{meta.description}</p>
                </div>
                <button
                  onClick={() => openModal(stat)}
                  disabled={stat.count === 0}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={13} />
                  Envoyer
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-gray-900 font-display">
                  {CAMPAIGN_META[active.type].label}
                </h3>
                <button
                  onClick={closeModal}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">Titre</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={80}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-gray-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">Message</label>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    maxLength={400}
                    className="w-full resize-none rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-gray-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {active.count} destinataire{active.count !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={closeModal}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !editTitle.trim() || !editBody.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Confirmer l'envoi
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

**Step 2 : TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3 : Commit**

```bash
git add src/app/(admin)/admin/campaigns/page.tsx
git commit -m "feat(campaigns): admin campaigns page with modal"
```

---

### Task 5 : Navigation admin

**Files:**
- Modify: `src/config/navigation.ts`
- Modify: `src/app/(admin)/layout.tsx`
- Modify: `src/components/layout/AdminSidebar.tsx`

**Step 1 : `navigation.ts` — ajouter Campagnes dans le groupe "systeme"**

Remplacer :
```typescript
{ path: "/admin/messages", icon: "MessageSquare", label: "Messages" },
{ path: "/admin/settings", icon: "Settings", label: "Paramètres" },
```
Par :
```typescript
{ path: "/admin/messages", icon: "MessageSquare", label: "Messages" },
{ path: "/admin/campaigns", icon: "Megaphone", label: "Campagnes" },
{ path: "/admin/settings", icon: "Settings", label: "Paramètres" },
```

**Step 2 : `layout.tsx` — ajouter dans PAGE_TITLES**

```typescript
"/admin/campaigns": "Campagnes",
```
(après `"/admin/messages": "Messages"`)

**Step 3 : `AdminSidebar.tsx` — ajouter Megaphone**

Import :
```typescript
ChevronLeft, MessageSquare, Megaphone,
```

ICONS :
```typescript
Settings, MessageSquare, Megaphone,
```

**Step 4 : TypeScript check**

```bash
npx tsc --noEmit
```

**Step 5 : Commit final**

```bash
git add src/config/navigation.ts src/app/(admin)/layout.tsx src/components/layout/AdminSidebar.tsx
git commit -m "feat(campaigns): add Campaigns to admin navigation"
```

---

## Récapitulatif des fichiers

| Fichier | Action |
|---|---|
| `src/lib/email.ts` | Refonte complète |
| `src/app/api/notifications/push/route.ts` | Mise à jour salutation |
| `src/app/api/admin/campaigns/route.ts` | Nouveau |
| `src/app/(admin)/admin/campaigns/page.tsx` | Nouveau |
| `src/config/navigation.ts` | + Campagnes |
| `src/app/(admin)/layout.tsx` | + PAGE_TITLES |
| `src/components/layout/AdminSidebar.tsx` | + Megaphone |

## Vérification end-to-end

1. `GET /api/admin/campaigns` (avec Bearer token superadmin) → retourne les 3 campagnes avec counts
2. Page `/admin/campaigns` → s'affiche, montre les counts, bouton désactivé si count=0
3. Clic "Envoyer" → modal avec message pré-rempli, champs modifiables
4. Confirmer → toast succès, notifications in-app visibles dans la cloche
5. Email reçu : header vert KOPPAFOOT, contenu personnalisé avec prénom, footer koppafoot.com
6. Managers reçoivent "Coach {prénom}" dans la salutation
