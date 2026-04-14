"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  MapPin,
  Loader2,
  Users,
  Trophy,
  Target,
  Star,
  Building2,
  ExternalLink,
  Award,
  CheckCircle,
  Plus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserById,
  getTeamsByPlayer,
  getTeamsByManager,
  isInShortlist,
  addToShortlist,
  removeFromShortlist,
} from "@/lib/firestore";
import { ROLE_BADGE_COLORS } from "@/config/navigation";
import { ROLE_LABELS } from "@/types";
import type { UserProfile, Team } from "@/types";

// ============================================
// Constants
// ============================================

const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Gardien",
  defender: "Défenseur",
  midfielder: "Milieu",
  forward: "Attaquant",
  any: "Polyvalent",
};

const SKILL_LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant",
  amateur: "Amateur",
  intermediate: "Intermédiaire",
  advanced: "Confirmé",
};

const LICENSE_LEVEL_LABELS: Record<string, string> = {
  trainee: "Stagiaire",
  regional: "Régional",
  national: "National",
  international: "International",
};

// ============================================
// Sub-components
// ============================================

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <span className="text-2xl font-bold text-emerald-600">{value}</span>
      <span className="mt-1 text-xs text-gray-500">{label}</span>
    </div>
  );
}

function TeamCard({ team, showRecord }: { team: Team; showRecord?: boolean }) {
  const total = team.wins + team.losses + team.draws;
  const winRate = total > 0 ? Math.round((team.wins / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold"
        style={{ backgroundColor: team.color || "#10b981" }}
      >
        {team.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-gray-900">{team.name}</p>
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <MapPin size={11} /> {team.city}
        </p>
        {showRecord && (
          <p className="mt-0.5 text-xs text-gray-400">
            {team.wins}V – {team.draws}N – {team.losses}D
            <span className="ml-1 text-emerald-600 font-medium">({winRate}% victoires)</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================
// Role-specific sections
// ============================================

function PlayerSection({
  profile,
  teams,
}: {
  profile: UserProfile;
  teams: Team[];
}) {
  const position = profile.position ? POSITION_LABELS[profile.position] ?? profile.position : null;
  const level = profile.skillLevel ? SKILL_LEVEL_LABELS[profile.skillLevel] ?? profile.skillLevel : null;

  const matchesPlayed = profile.matchesPlayed ?? 0;
  const goals = profile.goals ?? 0;
  const assists = profile.assists ?? 0;

  return (
    <div className="space-y-6">
      {/* Badges */}
      {(position || level) && (
        <div className="flex flex-wrap gap-2">
          {position && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              <Target size={14} /> {position}
            </span>
          )}
          {level && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
              <Star size={14} /> {level}
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-gray-400">
          Statistiques
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Matchs joués" value={matchesPlayed} />
          <StatCard label="Buts" value={goals} />
          <StatCard label="Passes déc." value={assists} />
        </div>
      </div>

      {/* Teams */}
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-gray-400">
          Équipes ({teams.length})
        </h3>
        {teams.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune équipe pour le moment.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ManagerSection({ profile, teams }: { profile: UserProfile; teams: Team[] }) {
  const totalMatches = teams.reduce((sum, t) => sum + t.matchesPlayed, 0);
  const totalWins = teams.reduce((sum, t) => sum + t.wins, 0);
  const globalWinRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

  return (
    <div className="space-y-6">
      {profile.teamName && (
        <p className="text-sm text-gray-600">
          Équipe principale :{" "}
          <span className="font-semibold text-gray-900">{profile.teamName}</span>
        </p>
      )}

      {/* Win rate global */}
      {totalMatches > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <Trophy size={24} className="text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Taux de victoire global
            </p>
            <p className="text-2xl font-bold text-emerald-600">{globalWinRate}%</p>
            <p className="text-xs text-gray-500">
              {totalWins} victoires sur {totalMatches} matchs
            </p>
          </div>
        </div>
      )}

      {/* Teams managed */}
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-gray-400">
          Équipes gérées ({teams.length})
        </h3>
        {teams.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune équipe gérée.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} showRecord />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RefereeSection({ profile }: { profile: UserProfile }) {
  const licenseLevel = profile.licenseLevel
    ? LICENSE_LEVEL_LABELS[profile.licenseLevel] ?? profile.licenseLevel
    : null;

  const maskedLicense = profile.licenseNumber
    ? profile.licenseNumber.slice(0, 3) + "***"
    : null;

  return (
    <div className="space-y-4">
      {licenseLevel && (
        <div className="flex items-center gap-2">
          <Award size={16} className="text-purple-600" />
          <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700">
            Licence {licenseLevel}
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {maskedLicense && (
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">N° de licence</p>
            <p className="mt-1 font-semibold text-gray-900 font-mono">{maskedLicense}</p>
          </div>
        )}
        {typeof profile.experienceYears === "number" && (
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">Années d&apos;expérience</p>
            <p className="mt-1 font-semibold text-gray-900">
              {profile.experienceYears} an{profile.experienceYears > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function VenueOwnerSection({ profile }: { profile: UserProfile }) {
  return (
    <div className="space-y-4">
      {profile.companyName && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <Building2 size={20} className="text-orange-500" />
          <div>
            <p className="text-xs text-gray-500">Société</p>
            <p className="font-semibold text-gray-900">{profile.companyName}</p>
          </div>
        </div>
      )}
      <a
        href="/venues"
        className="inline-flex items-center gap-2 rounded-lg bg-orange-100 px-4 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-200 transition-colors"
      >
        <ExternalLink size={14} />
        Voir les terrains disponibles
      </a>
    </div>
  );
}

// ============================================
// Main Page
// ============================================

export default function PublicProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shortlistEntryId, setShortlistEntryId] = useState<string | null>(null);
  const [shortlistLoading, setShortlistLoading] = useState(false);

  const isManagerViewingPlayer =
    currentUser?.userType === "manager" &&
    profile?.userType === "player" &&
    profile?.uid !== currentUser?.uid;

  // Load profile
  useEffect(() => {
    if (!uid) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const p = await getUserById(uid);
        if (!p) {
          setProfile(null);
          setLoading(false);
          return;
        }
        setProfile(p);

        // Load role-specific data
        if (p.userType === "player") {
          const playerTeams = await getTeamsByPlayer(uid);
          setTeams(playerTeams);
        } else if (p.userType === "manager") {
          const managerTeams = await getTeamsByManager(uid);
          setTeams(managerTeams);
        }
      } catch {
        setError("Une erreur est survenue lors du chargement du profil.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [uid]);

  // Check shortlist
  useEffect(() => {
    if (!currentUser || !profile) return;
    if (currentUser.userType !== "manager" || profile.userType !== "player") return;
    if (profile.uid === currentUser.uid) return;

    isInShortlist(currentUser.uid, profile.uid).then((id) => {
      setShortlistEntryId(id);
    });
  }, [currentUser, profile]);

  const handleShortlist = async () => {
    if (!currentUser || !profile) return;
    setShortlistLoading(true);
    try {
      if (shortlistEntryId) {
        await removeFromShortlist(shortlistEntryId);
        setShortlistEntryId(null);
      } else {
        const newId = await addToShortlist({
          managerId: currentUser.uid,
          playerId: profile.uid,
          playerName: `${profile.firstName} ${profile.lastName}`,
          playerCity: profile.locationCity,
          playerPosition: profile.position ?? "",
          playerLevel: profile.skillLevel ?? "",
          playerBio: profile.bio ?? "",
        });
        setShortlistEntryId(newId);
      }
    } catch {
      // Silent fail — the user sees no change
    } finally {
      setShortlistLoading(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────
  if (!profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold text-gray-700">Profil introuvable</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={14} /> Retour
        </button>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={14} /> Retour
        </button>
      </div>
    );
  }

  const initials = `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();
  const badgeColor = ROLE_BADGE_COLORS[profile.userType];

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Cover photo */}
        <div className="relative h-44 overflow-hidden rounded-t-2xl md:h-52">
          {profile.coverPhotoUrl ? (
            <img
              src={profile.coverPhotoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400" />
          )}
        </div>

        {/* Profile card */}
        <div className="relative rounded-b-2xl border border-t-0 border-gray-200 bg-white px-6 pb-6">
          {/* Avatar */}
          <div className="flex items-end gap-4">
            <div className="-mt-12 shrink-0">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-emerald-100 text-2xl font-bold text-emerald-700 shadow-md overflow-hidden">
                {profile.profilePictureUrl ? (
                  <img
                    src={profile.profilePictureUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
            </div>

            {/* Name + Mercato CTA */}
            <div className="flex flex-1 items-start justify-between pt-3 flex-wrap gap-3">
              <div>
                <h1 className="font-display text-xl font-bold text-gray-900">
                  {profile.firstName} {profile.lastName}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}>
                    {ROLE_LABELS[profile.userType]}
                  </span>
                  {profile.locationCity && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin size={11} /> {profile.locationCity}
                    </span>
                  )}
                </div>
              </div>

              {/* Mercato CTA — manager viewing player */}
              {isManagerViewingPlayer && (
                <button
                  onClick={handleShortlist}
                  disabled={shortlistLoading}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                    shortlistEntryId
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                  }`}
                >
                  {shortlistLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : shortlistEntryId ? (
                    <CheckCircle size={14} />
                  ) : (
                    <Plus size={14} />
                  )}
                  {shortlistEntryId ? "Dans la sélection" : "Ajouter au Mercato"}
                </button>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
          )}
        </div>

        {/* Role-specific content */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6">
          {profile.userType === "player" && (
            <PlayerSection
              profile={profile}
              teams={teams}
            />
          )}
          {profile.userType === "manager" && (
            <ManagerSection profile={profile} teams={teams} />
          )}
          {profile.userType === "referee" && (
            <RefereeSection profile={profile} />
          )}
          {profile.userType === "venue_owner" && (
            <VenueOwnerSection profile={profile} />
          )}
        </div>
      </motion.div>
    </div>
  );
}
