import { adminDb } from "@/lib/firebase-admin";
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

export async function publishOfficialPost(input: {
  type: PostType;
  content: string;
  /** Where the card points — a competition, a match. */
  link?: string | null;
  pinned?: boolean;
}): Promise<string> {
  const ref = await adminDb.collection("posts").add({
    author_id: SYSTEM_AUTHOR_ID,
    author_name: SYSTEM_AUTHOR_NAME,
    author_role: "official",
    author_avatar: "",
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
          ? `🏁 ${e.competitionName} — ${e.homeTeam} ${e.scoreHome}-${e.scoreAway} ${e.awayTeam} (forfait).`
          : `🏁 ${e.competitionName} — ${e.homeTeam} ${e.scoreHome}-${e.scoreAway} ${e.awayTeam}.`,
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
