import { randomUUID } from "node:crypto";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { SYSTEM_AUTHOR_ID, SYSTEM_AUTHOR_NAME } from "@/types";
import type { PostType } from "@/types";

// ============================================
// Publishing as the official KoppaFoot account.
//
// Admin SDK only, and deliberately so: firestore.rules now requires a post's
// author_id to equal the caller's uid, which means no browser can publish as
// "system". Every official post goes through this module, called from a
// route that has already checked who is asking.
// ============================================

/**
 * Display identity of the official account, editable from /admin/tribune.
 *
 * Kept in one document rather than only copied onto each post: the Tribune
 * resolves it at render time, so renaming the account or changing its picture
 * updates every post it ever wrote instead of only the next one.
 */
export const TRIBUNE_SETTINGS_PATH = "settings/tribune";

export interface TribuneIdentity {
  name: string;
  avatarUrl: string | null;
}

export async function getTribuneIdentity(): Promise<TribuneIdentity> {
  const snap = await adminDb.doc(TRIBUNE_SETTINGS_PATH).get();
  const d = snap.data();
  return {
    name: d?.system_name || SYSTEM_AUTHOR_NAME,
    avatarUrl: d?.system_avatar_url || null,
  };
}

/**
 * Store the official account's picture and return its download URL.
 *
 * Server-side on purpose. The browser cannot write this path (storage.rules
 * denies it outright) because the only thing that may authorize the write is
 * the superadmin check the calling route has already done.
 *
 * The URL is built the way the Firebase SDK builds one, a download token in
 * the object's metadata, rather than via makePublic(), which fails on
 * buckets with uniform access. A fresh token per upload also busts the cache
 * even though the path never changes.
 */
export async function storeTribuneAvatar(
  data: Buffer,
  contentType: string,
): Promise<string> {
  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const path = `branding/tribune/avatar.${ext}`;
  const token = randomUUID();

  const bucket = adminStorage.bucket();
  await bucket.file(path).save(data, {
    contentType,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });

  return (
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
    `/o/${encodeURIComponent(path)}?alt=media&token=${token}`
  );
}

export async function setTribuneIdentity(input: TribuneIdentity): Promise<void> {
  await adminDb.doc(TRIBUNE_SETTINGS_PATH).set(
    {
      system_name: input.name.trim() || SYSTEM_AUTHOR_NAME,
      system_avatar_url: input.avatarUrl?.trim() || null,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function publishOfficialPost(input: {
  type: PostType;
  content: string;
  /** Where the card points, a competition, a match. */
  link?: string | null;
  pinned?: boolean;
}): Promise<string> {
  // Snapshotted like every other post, so one still reads correctly if the
  // settings document is ever lost, but the feed prefers the live value.
  const identity = await getTribuneIdentity();
  const ref = await adminDb.collection("posts").add({
    author_id: SYSTEM_AUTHOR_ID,
    author_name: identity.name,
    author_role: "official",
    author_avatar: identity.avatarUrl ?? "",
    type: input.type,
    content: input.content,
    metadata: null,
    likes: [],
    comment_count: 0,
    pinned: input.pinned ?? false,
    link: input.link ?? null,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

// ============================================
// Competition milestones
// ============================================

export type CompetitionEvent =
  | { kind: "registrations_open"; competitionName: string; slug: string }
  | { kind: "team_entered"; competitionName: string; slug: string; teamName: string }
  | {
      kind: "match_result";
      competitionName: string;
      slug: string;
      homeTeam: string; awayTeam: string;
      scoreHome: number; scoreAway: number;
      forfeit?: boolean;
    }
  | { kind: "team_disqualified"; competitionName: string; slug: string; teamName: string }
  | { kind: "competition_completed"; competitionName: string; slug: string; winner?: string | null };

/** The wording of each milestone, in one place so the feed reads consistently. */
export function announcementFor(e: CompetitionEvent): { type: PostType; content: string; link: string } {
  const link = `/c/${e.slug}`;
  switch (e.kind) {
    case "registrations_open":
      return {
        type: "competition_announcement",
        content: `📋 Les inscriptions sont ouvertes pour ${e.competitionName}. Managers, inscrivez votre équipe !`,
        link,
      };
    case "team_entered":
      return {
        type: "competition_announcement",
        content: `✅ ${e.teamName} rejoint ${e.competitionName}.`,
        link,
      };
    case "match_result":
      return {
        type: "match_result",
        content: e.forfeit
          ? `🏁 ${e.competitionName}, ${e.homeTeam} ${e.scoreHome}-${e.scoreAway} ${e.awayTeam} (forfait).`
          : `🏁 ${e.competitionName}, ${e.homeTeam} ${e.scoreHome}-${e.scoreAway} ${e.awayTeam}.`,
        link,
      };
    case "team_disqualified":
      return {
        type: "competition_announcement",
        content: `⛔ ${e.teamName} est disqualifiée de ${e.competitionName}. Ses matchs restants sont perdus par forfait.`,
        link,
      };
    case "competition_completed":
      return {
        type: "competition_announcement",
        content: e.winner
          ? `🏆 ${e.competitionName} est terminée. Vainqueur : ${e.winner} !`
          : `🏆 ${e.competitionName} est terminée.`,
        link,
      };
  }
}

/** Publish a competition milestone as the official account. */
export async function announceCompetitionEvent(e: CompetitionEvent): Promise<string> {
  const { type, content, link } = announcementFor(e);
  return publishOfficialPost({ type, content, link });
}
