import { adminDb } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/fcm-server";
import { FieldValue } from "firebase-admin/firestore";
import type { NotificationType } from "@/types";
import { categorieDuType } from "@/lib/push-categories";

// ============================================
// activity-notify-server, la vie d'une équipe, poussée à ceux qu'elle
// concerne.
//
// Jusqu'ici une notification n'existait que pour ce qui vous était adressé
// personnellement (invitation, convocation, défi). Un joueur ne savait donc
// jamais qu'un coéquipier était arrivé ou parti, ni que son équipe venait
// d'être inscrite quelque part, l'information vivait uniquement dans la page
// de l'équipe, qu'il faut penser à ouvrir.
//
// Deux audiences distinctes pour le même événement :
//  - l'effectif (`team_activity`) : ça les concerne directement ;
//  - ceux qui suivent l'équipe ou le joueur (`follow_activity`) : ils ont
//    demandé à être tenus au courant, pas à être convoqués.
//
// Côté serveur exprès : la liste des abonnés se lit dans `team_follows` et
// `follows`, et une diffusion écrite depuis le client se ferait à moitié si
// l'onglet se ferme au milieu.
// ============================================

/** Plafond par diffusion, une équipe très suivie ne doit pas faire exploser
 *  un accept de candidature. Au-delà, seuls les premiers sont notifiés. */
const MAX_FOLLOWERS = 300;

export type TeamActivityEvent =
  | "member_joined"
  | "member_left"
  | "competition_entered";

interface Recipient {
  userId: string;
  type: NotificationType;
}

interface Copy {
  title: string;
  body: string;
  followerBody: string;
}

function copyFor(
  event: TeamActivityEvent,
  teamName: string,
  playerName: string,
  competitionName: string,
): Copy {
  switch (event) {
    case "member_joined":
      return {
        title: "Nouveau coéquipier",
        body: `${playerName} rejoint ${teamName}.`,
        followerBody: `${playerName} rejoint ${teamName}.`,
      };
    case "member_left":
      return {
        title: "Départ d'un joueur",
        body: `${playerName} quitte ${teamName}.`,
        followerBody: `${playerName} quitte ${teamName}.`,
      };
    case "competition_entered":
      return {
        title: "Nouvelle compétition",
        body: `${teamName} est inscrite à ${competitionName}.`,
        followerBody: `${teamName} est inscrite à ${competitionName}.`,
      };
  }
}

async function followersOfTeam(teamId: string): Promise<string[]> {
  const snap = await adminDb
    .collection("team_follows")
    .where("team_id", "==", teamId)
    .limit(MAX_FOLLOWERS)
    .get();
  return snap.docs.map((d) => d.data().follower_id as string).filter(Boolean);
}

async function followersOfUser(userId: string): Promise<string[]> {
  const snap = await adminDb
    .collection("follows")
    .where("following_id", "==", userId)
    .limit(MAX_FOLLOWERS)
    .get();
  return snap.docs.map((d) => d.data().follower_id as string).filter(Boolean);
}

/**
 * Diffuse un événement d'équipe.
 *
 * @param actorId  Celui qui a provoqué l'événement, il ne se le fait pas
 *                 raconter à lui-même.
 * @returns le nombre de destinataires réellement écrits.
 */
export async function notifyTeamActivity(input: {
  teamId: string;
  event: TeamActivityEvent;
  actorId?: string | null;
  /** member_joined / member_left, le joueur concerné. */
  playerId?: string | null;
  playerName?: string;
  /** competition_entered. */
  competitionName?: string;
  link?: string;
}): Promise<number> {
  const teamSnap = await adminDb.collection("teams").doc(input.teamId).get();
  if (!teamSnap.exists) return 0;
  const team = teamSnap.data()!;

  // Une équipe hors plateforme n'a ni effectif ni abonnés à prévenir.
  if (team.is_ghost === true) return 0;

  const teamName: string = team.name ?? "L'équipe";
  const { title, body, followerBody } = copyFor(
    input.event,
    teamName,
    input.playerName ?? "Un joueur",
    input.competitionName ?? "une compétition",
  );

  // L'effectif d'abord. Le manager n'est pas dans member_ids (createTeam le
  // laisse vide), d'où l'ajout explicite.
  const insiders = new Set<string>([
    ...((team.member_ids ?? []) as string[]),
    team.manager_id as string,
  ]);
  insiders.delete("");
  if (input.actorId) insiders.delete(input.actorId);
  // Le joueur qui arrive ou qui part sait déjà ce qu'il vient de faire.
  if (input.playerId) insiders.delete(input.playerId);

  const recipients = new Map<string, Recipient>();
  for (const uid of insiders) recipients.set(uid, { userId: uid, type: "team_activity" });

  // Puis les abonnés, équipe, et joueur quand il en est le sujet. Un membre
  // qui suit aussi l'équipe garde sa notification d'effectif : le premier
  // enregistrement gagne.
  const [teamFollowers, playerFollowers] = await Promise.all([
    followersOfTeam(input.teamId).catch(() => [] as string[]),
    input.playerId && input.event !== "competition_entered"
      ? followersOfUser(input.playerId).catch(() => [] as string[])
      : Promise.resolve([] as string[]),
  ]);

  for (const uid of [...teamFollowers, ...playerFollowers]) {
    if (!uid || uid === input.actorId || uid === input.playerId) continue;
    if (!recipients.has(uid)) recipients.set(uid, { userId: uid, type: "follow_activity" });
  }

  if (recipients.size === 0) return 0;

  const link = input.link ?? `/teams/${input.teamId}`;
  // Un batch Firestore plafonne à 500 écritures ; effectif + deux listes
  // d'abonnés peuvent dépasser, d'où le découpage.
  const all = [...recipients.values()];
  for (let i = 0; i < all.length; i += 400) {
    const batch = adminDb.batch();
    for (const r of all.slice(i, i + 400)) {
      batch.set(adminDb.collection("notifications").doc(), {
        user_id: r.userId,
        type: r.type,
        title,
        body: r.type === "team_activity" ? body : followerBody,
        link,
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  // Push best-effort : un token mort ne doit pas faire échouer l'événement
  // qui vient d'être écrit.
  await Promise.allSettled(
    all.map((r) =>
      sendPushToUser(r.userId, {
        title,
        body: r.type === "team_activity" ? body : followerBody,
        link,
        // La catégorie suit l'AUDIENCE et non l'événement : le même départ de
        // joueur relève de « mon équipe » pour l'effectif et de « ce que je
        // suis » pour les abonnés, et les deux se coupent séparément.
        category: categorieDuType(r.type),
      }),
    ),
  );

  return recipients.size;
}
