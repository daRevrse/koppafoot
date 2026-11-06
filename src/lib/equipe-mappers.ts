// Les mappeurs d'équipe : un document Firestore en objet du domaine. Sortis de
// lib/firestore (qui les réexporte) parce qu'ils ne dépendent d'aucun SDK :
// l'application mobile les lit tels quels, comme le site.

import { lireCondition } from "@/lib/etat-de-forme";
import { lireCategorie } from "@/lib/genre";
import { normaliserPoste } from "@/lib/postes";
import { lireEmplacement } from "@/lib/terrain";
import type {
  CompositionType, FirestoreGhostPlayer, FirestoreInvitation, FirestoreJoinRequest, FirestoreTeam,
  GhostPlayer, Invitation, JoinRequest, Team,
} from "@/types";

/**
 * Une date de Firestore en ISO. Un horodatage serveur pas encore résolu (le
 * premier instantané, sans `toDate` ni `seconds`) vaut maintenant.
 */
export function formatDate(date: unknown): string {
  if (!date) return new Date().toISOString();
  if (typeof date === "string") return date;
  if (typeof date !== "object") return new Date().toISOString();
  const d = date as { seconds?: number; toDate?: () => Date };
  if (typeof d.toDate === "function") return d.toDate().toISOString();
  if (d.seconds) return new Date(d.seconds * 1000).toISOString();
  return new Date().toISOString();
}

export function toGhostPlayer(id: string, teamId: string, d: FirestoreGhostPlayer): GhostPlayer {
  return {
    id,
    teamId,
    firstName: d.first_name,
    lastName: d.last_name,
    position: d.position,
    squadNumber: d.squad_number ?? undefined,
    goals: d.goals ?? 0,
    assists: d.assists ?? 0,
    matchesPlayed: d.matches_played ?? 0,
    condition: lireCondition(d.condition),
    photoUrl: d.photo_url || null,
    photoConsentement: d.photo_consentement ?? null,
    createdAt: formatDate(d.created_at),
    updatedAt: formatDate(d.updated_at),
  };
}

export function toTeam(id: string, d: FirestoreTeam): Team {
  return {
    id, name: d.name, managerId: d.manager_id, city: d.city,
    description: d.description, level: d.level, lookingFor: d.looking_for ?? [],
    memberIds: d.member_ids ?? [], maxMembers: d.max_members, color: d.color,
    wins: d.wins ?? 0, losses: d.losses ?? 0, draws: d.draws ?? 0,
    matchesPlayed: d.matches_played ?? 0, isRecruiting: d.is_recruiting ?? false,
    logoUrl: d.logo_url, bannerUrl: d.banner_url, slogan: d.slogan,
    lineupIds: d.lineup_ids ?? [], galleryUrls: d.gallery_urls ?? [],
    compositionsTypes: toCompositionsTypes(d.compositions_types),
    achievements: d.achievements ?? [], followersCount: d.followers_count ?? 0,
    squadNumbers: d.squad_numbers ?? {},
    trainingSchedule: d.training_schedule ?? [],
    staff: d.staff ?? [],
    staffManagerIds: d.staff_manager_ids ?? [],
    isGhost: d.is_ghost ?? false,
    category: lireCategorie(d.category),
    createdAt: formatDate(d.created_at), updatedAt: formatDate(d.updated_at),
  };
}

export function toInvitation(id: string, d: FirestoreInvitation): Invitation {
  return {
    id, senderId: d.sender_id, senderName: d.sender_name,
    receiverId: d.receiver_id, receiverName: d.receiver_name,
    receiverPhoto: d.receiver_photo ?? null, teamLogo: d.team_logo ?? null,
    receiverCity: d.receiver_city, receiverPosition: d.receiver_position,
    receiverLevel: d.receiver_level, teamId: d.team_id, teamName: d.team_name,
    message: d.message, status: d.status,
    createdAt: formatDate(d.created_at), updatedAt: formatDate(d.updated_at),
  };
}

export function toJoinRequest(id: string, d: FirestoreJoinRequest): JoinRequest {
  return {
    id, playerId: d.player_id, playerName: d.player_name,
    playerPhoto: d.player_photo ?? null, teamLogo: d.team_logo ?? null,
    playerCity: d.player_city, playerPosition: d.player_position,
    playerLevel: d.player_level, teamId: d.team_id, teamName: d.team_name,
    managerId: d.manager_id, message: d.message, status: d.status,
    createdAt: d.created_at, updatedAt: d.updated_at,
  };
}

export function toCompositionsTypes(
  d: FirestoreTeam["compositions_types"],
): { [taille: string]: CompositionType } {
  if (!d) return {};
  const sortie: { [taille: string]: CompositionType } = {};
  for (const [taille, c] of Object.entries(d)) {
    if (!c) continue;
    sortie[taille] = {
      formation: c.formation,
      lineup: (c.lineup ?? []).map((e) => ({
        playerId: e.player_id,
        name: e.name,
        number: e.number,
        role: e.role,
        userId: e.user_id ?? null,
        // Le poste est une chaine libre en base (voir FirestoreLineupEntry) :
        // on le ramene au vocabulaire du produit, comme partout ailleurs.
        position: normaliserPoste(e.position),
        emplacement: lireEmplacement(e.emplacement),
      })),
      updatedAt: formatDate(c.updated_at),
    };
  }
  return sortie;
}
