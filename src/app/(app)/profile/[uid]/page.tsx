"use client";

import { isVenueOwner as ownsVenue } from "@/lib/hats";
import Link from "next/link";
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
  Award,
  CheckCircle,
  Plus,
  UserPlus,
  UserMinus,
  Ruler,
  Weight,
  Footprints,
  Cake,
  Heart,
  MessageCircle,
  ImageIcon,
  FileText,
  Shield,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserById,
  isInShortlist,
  addToShortlist,
  removeFromShortlist,
  followUser,
  unfollowUser,
  isFollowing,
  getPostsByUser,
  toggleLike,
} from "@/lib/firestore";
import { ROLE_BADGE_COLORS } from "@/config/navigation";
import { ROLE_LABELS } from "@/types";
import type { UserProfile, Post } from "@/types";
import { PostCard, timeAgo } from "@/components/feed/PostCard";

/**
 * Une équipe telle que /api/public/profile/[uid] la projette : ce qui
 * s'affiche, et rien de plus.
 *
 * La page castait cette projection en `Team`, qui exige une quinzaine de
 * champs que l'endpoint ne publie pas — d'où deux données déjà servies mais
 * jamais lues ici, l'écusson et `isManager`. Le type dit maintenant la
 * vérité, et la carte peut s'en servir.
 */
interface EquipePubliee {
  id: string;
  name: string;
  city: string | null;
  /** Une CLÉ de palette (« emerald », « blue »…), jamais une couleur CSS. */
  color: string | null;
  logoUrl: string | null;
  wins: number;
  draws: number;
  losses: number;
  matchesPlayed: number;
  /** Ce joueur dirige-t-il cette équipe ? Calculé par l'endpoint. */
  isManager?: boolean;
}

/**
 * La couleur du club, la même table que l'annuaire des équipes et leur fiche.
 *
 * `team.color` est une clé de palette : la carte la passait à
 * `style={{ backgroundColor: team.color }}`, où « emerald » n'est pas une
 * couleur CSS valide. L'écusson n'avait donc aucun fond, et son initiale
 * blanche restait invisible sur du blanc — un trou à gauche du nom.
 */
const COLOR_MAP: Record<string, { bg: string; icon: string; stripe: string }> = {
  amber:   { bg: "bg-amber-100",   icon: "text-amber-600",   stripe: "bg-amber-500" },
  blue:    { bg: "bg-blue-100",    icon: "text-blue-600",    stripe: "bg-blue-500" },
  red:     { bg: "bg-red-100",     icon: "text-red-600",     stripe: "bg-red-500" },
  emerald: { bg: "bg-emerald-100", icon: "text-emerald-600", stripe: "bg-emerald-500" },
  purple:  { bg: "bg-purple-100",  icon: "text-purple-600",  stripe: "bg-purple-500" },
  orange:  { bg: "bg-orange-100",  icon: "text-orange-600",  stripe: "bg-orange-500" },
};

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

const FOOT_LABELS: Record<string, string> = {
  left: "Gauche",
  right: "Droit",
  both: "Les deux",
};

function calculateAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}


type PublicTab = "overview" | "posts" | "galerie" | "palmares";

// ============================================
// Sub-components
// ============================================

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-gray-200/70 bg-white px-4 py-5 text-center">
      <span className="block font-display text-3xl font-black tabular-nums leading-none text-gray-900">
        {value}
      </span>
      <span className="mt-2 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
        {label}
      </span>
    </div>
  );
}

/**
 * Une équipe du joueur, sur sa fiche publique.
 *
 * ELLE MÈNE À L'ÉQUIPE. C'était un rectangle inerte portant un nom et une
 * ville : sur la fiche d'un joueur, son club est pourtant le lien qu'on
 * cherche. Elle reprend donc l'écusson, le filet de couleur et la pastille
 * « Manager » de l'annuaire des équipes — une équipe se reconnaît au même
 * dessin partout — et elle dit ce qu'il y a à dire, le bilan, plutôt que de
 * laisser un cadre aux trois quarts vide.
 */
function TeamCard({ team }: { team: EquipePubliee }) {
  const colors = COLOR_MAP[team.color ?? ""] ?? COLOR_MAP.emerald;
  const total = team.wins + team.losses + team.draws;
  const winRate = total > 0 ? Math.round((team.wins / total) * 100) : 0;

  return (
    <Link
      href={`/teams/${team.id}`}
      className="group block overflow-hidden border border-gray-200/70 bg-white transition-shadow hover:shadow-md"
    >
      <div className={`h-1 ${colors.stripe}`} />
      <div className="flex items-center gap-3 p-4">
        {/* L'écusson, ou le blason par défaut sur la couleur du club. */}
        {/* Pas de fond derrière un vrai écusson : beaucoup de logos sont des PNG transparents, et la plaque se voyait au travers. */}
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden ${team.logoUrl ? "" : colors.bg}`}>
          {team.logoUrl
            ? <img src={team.logoUrl} alt="" className="h-full w-full object-contain" />
            : <Shield size={24} className={colors.icon} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-display font-bold text-gray-900">{team.name}</p>
            {team.isManager && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-blue-700">
                <Shield size={10} /> Manager
              </span>
            )}
          </div>
          {team.city && (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
              <MapPin size={11} /> {team.city}
            </p>
          )}
        </div>
        <ChevronRight
          size={16}
          className="shrink-0 text-gray-300 transition-colors group-hover:text-emerald-600"
        />
      </div>

      {/* Le bilan, en pied. Il n'apparaissait que sur la fiche d'un manager,
          alors que c'est la même équipe et le même bilan quel que soit le
          joueur qu'on regarde. Sans match joué, on le dit — un cadre vide
          laisse croire à une donnée qui manque. */}
      {total > 0 ? (
        <div className="grid grid-cols-4 border-t border-gray-200/70 text-center">
          {[
            { label: "V", value: team.wins, ton: "text-emerald-700" },
            { label: "N", value: team.draws, ton: "text-gray-600" },
            { label: "D", value: team.losses, ton: "text-red-600" },
            { label: "% vict.", value: `${winRate}%`, ton: "text-gray-900" },
          ].map((c) => (
            <div key={c.label} className="px-2 py-2.5 [&+&]:border-l [&+&]:border-gray-200/70">
              <p className={`font-display text-base font-black leading-none tabular-nums ${c.ton}`}>
                {c.value}
              </p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-gray-400">
                {c.label}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="border-t border-gray-200/70 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-300">
          Aucun match joué
        </p>
      )}
    </Link>
  );
}

// ============================================
// Physical Info Card
// ============================================

function PhysicalInfoCard({ profile }: { profile: UserProfile }) {
  const age = profile.dateOfBirth ? calculateAge(profile.dateOfBirth) : null;
  const hasAnyInfo = profile.strongFoot || profile.height || profile.weight || age !== null;
  if (!hasAnyInfo) return null;

  return (
    <div>
      <h3 className="border-b border-gray-200/70 pb-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
        Informations physiques
      </h3>
      {/* Un seul bloc decoupe par des filets, plutot que quatre tuiles qui
          flottent : quatre valeurs d'une meme fiche forment un tableau, pas
          quatre objets independants. */}
      <div className="grid grid-cols-2 border-x border-b border-gray-200/70 sm:grid-cols-4">
        {([
          profile.strongFoot ? { Icon: Footprints, label: "Pied fort", value: FOOT_LABELS[profile.strongFoot] } : null,
          profile.height ? { Icon: Ruler, label: "Taille", value: `${profile.height} cm` } : null,
          profile.weight ? { Icon: Weight, label: "Poids", value: `${profile.weight} kg` } : null,
          age !== null ? { Icon: Cake, label: "Âge", value: `${age} ans` } : null,
        ].filter(Boolean) as { Icon: typeof Ruler; label: string; value: string }[]).map(({ Icon, label, value }) => (
          <div key={label} className="border-t border-gray-200/70 bg-white px-4 py-5 text-center [&+&]:border-l">
            <Icon size={17} strokeWidth={1.5} className="mx-auto text-gray-300" />
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">{label}</p>
            <p className="mt-1 font-display text-lg font-black leading-none text-gray-900">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Role-specific sections
// ============================================

function PlayerSection({ profile, teams }: { profile: UserProfile; teams: EquipePubliee[] }) {
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
            <span className="flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
              <Target size={14} /> {position}
            </span>
          )}
          {level && (
            <span className="flex items-center gap-1.5 border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
              <Star size={14} /> {level}
            </span>
          )}
        </div>
      )}

      <PhysicalInfoCard profile={profile} />

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

function ManagerSection({ profile, teams }: { profile: UserProfile; teams: EquipePubliee[] }) {
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

      {totalMatches > 0 && (
        <div className="flex items-center gap-4 border border-emerald-100 bg-emerald-50 p-4">
          <Trophy size={24} className="text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Taux de victoire global</p>
            <p className="text-2xl font-bold text-emerald-600">{globalWinRate}%</p>
            <p className="text-xs text-gray-500">{totalWins} victoires sur {totalMatches} matchs</p>
          </div>
        </div>
      )}

      <div>
        {/* « Équipes gérées » sur-promettait : la projection publique renvoie
            les DEUX appartenances, l'effectif et la direction, et un manager
            qui joue ailleurs voyait ce club-là compté parmi ceux qu'il dirige.
            La pastille « Manager » de la carte dit maintenant lesquels. */}
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
          <span className="border border-purple-200 bg-purple-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-purple-700">
            Licence {licenseLevel}
          </span>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {maskedLicense && (
          <div className=" border border-gray-200/70 bg-white p-4">
            <p className="text-xs text-gray-500">N° de licence</p>
            <p className="mt-1 font-semibold text-gray-900 font-mono">{maskedLicense}</p>
          </div>
        )}
        {typeof profile.experienceYears === "number" && (
          <div className=" border border-gray-200/70 bg-white p-4">
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
        <div className="flex items-center gap-3 border border-gray-200/70 bg-white p-4">
          <Building2 size={20} className="text-orange-500" />
          <div>
            <p className="text-xs text-gray-500">Société</p>
            <p className="font-semibold text-gray-900">{profile.companyName}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Page
// ============================================

/**
 * La fiche publique, telle que la sert /api/public/profile/[uid] : une
 * projection en liste blanche, sans email ni telephone. Les champs absents
 * restent indefinis, la page les traite deja comme optionnels.
 */
async function fetchPublicProfile(
  uid: string,
): Promise<{ profile: UserProfile; teams: EquipePubliee[] } | null> {
  try {
    const res = await fetch(`/api/public/profile/${encodeURIComponent(uid)}`);
    if (!res.ok) return null;
    const { profile, teams } = await res.json();
    if (!profile) return null;
    const mapped = {
      uid: profile.uid,
      firstName: profile.first_name ?? "",
      lastName: profile.last_name ?? "",
      profilePictureUrl: profile.profile_picture_url ?? null,
      coverPhotoUrl: profile.cover_photo_url ?? null,
      bio: profile.bio ?? null,
      locationCity: profile.location_city ?? null,
      position: profile.position ?? null,
      skillLevel: profile.skill_level ?? null,
      strongFoot: profile.strong_foot ?? null,
      height: profile.height ?? null,
      weight: profile.weight ?? null,
      dateOfBirth: profile.date_of_birth ?? null,
      userType: profile.user_type ?? "member",
      evolutionRole: profile.evolution_role ?? null,
      jerseyNumber: profile.jersey_number ?? null,
      galleryUrls: profile.gallery_urls ?? [],
      // Le cast passe par `unknown` a dessein : UserProfile exige email,
      // phone et quelques champs de compte que cette projection ne porte pas
      //, c'est tout l'interet de la projection. La page ne lit aucun d'eux.
    } as unknown as UserProfile;

    // Les equipes arrivent deja au format de la page : l'endpoint les projette
    // en camelCase, il n'y a rien a retraduire ici.
    return { profile: mapped, teams: (teams ?? []) as EquipePubliee[] };
  } catch {
    return null;
  }
}

export default function PublicProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [teams, setTeams] = useState<EquipePubliee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shortlistEntryId, setShortlistEntryId] = useState<string | null>(null);
  const [shortlistLoading, setShortlistLoading] = useState(false);

  // Following state
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  // Tab state
  const [activeTab, setActiveTab] = useState<PublicTab>("overview");

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const isManagerViewingPlayer =
    currentUser?.userType === "manager" &&
    profile?.userType === "player" &&
    profile?.uid !== currentUser?.uid;

  const isOwnProfile = currentUser?.uid === uid;

  // Chargement de la fiche.
  //
  // On attend que l'authentification soit TRANCHEE avant de lire. Sans cette
  // attente, `currentUser` vaut null au premier rendu : la fiche se chargeait
  // par la projection publique, s'affichait, puis l'auth arrivait, l'effet
  // rejouait par getUserById et remplacait tout, les informations physiques
  // apparaissaient et disparaissaient dans le meme souffle.
  //
  // Attendre coute quelques dizaines de millisecondes et economise une
  // requete ; afficher deux fois coutait un clignotement a chaque ouverture.
  useEffect(() => {
    if (!uid || authLoading) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Connecte : lecture directe. Visiteur : `users` lui est ferme par les
        // regles (le document porte email et telephone), donc on passe par la
        // projection publique, voir /api/public/profile/[uid].
        // La projection publique sert TOUT LE MONDE pour les equipes, y
        // compris un lecteur connecte. Deux raisons :
        //
        // - `teams` est ferme aux visiteurs par les regles, donc la lecture
        //   client ne rendait jamais rien sans compte : « Equipes (0) » etait
        //   affiche a chaque visiteur, sur chaque fiche.
        // - la lecture client etait branchee sur `user_type`, qui dit le type
        //   de COMPTE. Un organisateur ou un manager qui joue n'entrait dans
        //   aucune des deux branches, et voyait « Equipes (0) » alors meme
        //   qu'il etait dans un effectif.
        //
        // L'endpoint interroge les deux appartenances, effectif et manager,
        // sans rien supposer du role.
        const pub = await fetchPublicProfile(uid);

        // Connecte, la lecture directe reste la source de la FICHE : elle
        // porte les champs de compte que la projection ne publie pas.
        const p = currentUser ? await getUserById(uid) : pub?.profile ?? null;
        if (!p) {
          setProfile(null);
          setLoading(false);
          return;
        }
        setProfile(p);
        setFollowerCount(p.followersCount ?? 0);
        setTeams(pub?.teams ?? []);
      } catch {
        setError("Une erreur est survenue lors du chargement du profil.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [uid, currentUser, authLoading]);

  // Check follow status
  useEffect(() => {
    if (!currentUser || !profile || isOwnProfile) return;
    isFollowing(currentUser.uid, profile.uid)
      .then(setFollowing)
      .catch((err) => {
        console.error("Error checking follow status:", err);
        setFollowing(false);
      });
  }, [currentUser, profile, isOwnProfile]);

  // Check shortlist
  useEffect(() => {
    if (!currentUser || !profile) return;
    if (currentUser.userType !== "manager" || profile.userType !== "player") return;
    if (profile.uid === currentUser.uid) return;
    isInShortlist(currentUser.uid, profile.uid).then(setShortlistEntryId);
  }, [currentUser, profile]);

  // Load posts when tab changes
  useEffect(() => {
    if (activeTab === "posts" && profile) {
      setLoadingPosts(true);
      getPostsByUser(profile.uid, currentUser?.uid).then((data) => {
        setPosts(data);
        setLoadingPosts(false);
      });
    }
  }, [activeTab, profile, currentUser]);

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!currentUser) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              isLiked: !isLiked,
              likes: isLiked
                ? p.likes.filter((uid) => uid !== currentUser.uid)
                : [...p.likes, currentUser.uid],
            }
          : p
      )
    );
    try {
      await toggleLike(postId, currentUser.uid, isLiked);
    } catch {
      // revert optimistic update
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                isLiked,
                likes: isLiked
                  ? [...p.likes, currentUser.uid]
                  : p.likes.filter((uid) => uid !== currentUser.uid),
              }
            : p
        )
      );
    }
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleFollow = async () => {
    if (!currentUser || !profile) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowUser(currentUser.uid, profile.uid);
        setFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
      } else {
        await followUser(currentUser.uid, profile.uid);
        setFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } catch {
      // Silent
    } finally {
      setFollowLoading(false);
    }
  };

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
      // Silent
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

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold text-gray-700">Profil introuvable</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={14} /> Retour
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={14} /> Retour
        </button>
      </div>
    );
  }

  const initials = `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();

  const publicTabs: { key: PublicTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { key: "overview", label: "Aperçu", icon: Users },
    { key: "palmares", label: "Palmarès", icon: Trophy },
    { key: "posts", label: "Posts", icon: FileText },
    { key: "galerie", label: "Galerie", icon: ImageIcon },
  ];

  // Ce qu'on EST sur le terrain n'est pas ce qu'est son COMPTE. `user_type`
  // dit organizer, manager ou superadmin, c'est un type de compte. Le role
  // Evolution dit joueur. Un organisateur qui joue avait donc une fiche vide :
  // ses informations physiques etaient bien en base, mais la section qui les
  // porte ne s'affichait que pour user_type === "player".
  //
  // Les deux signaux comptent : le role Evolution quand il existe, le type de
  // compte pour les comptes anciens qui n'en ont jamais choisi.
  const isPlayer = profile.evolutionRole === "player" || profile.userType === "player";
  const isManager = profile.evolutionRole === "manager" || profile.userType === "manager";
  const isReferee = profile.evolutionRole === "referee" || profile.userType === "referee";

  return (
    <div className="mx-auto max-w-6xl pb-24">
      {/* Fil d'ariane plutot qu'un bouton Retour : il dit d'ou l'on vient ET
          ou l'on est, la ou « Retour » ne disait ni l'un ni l'autre. */}
      <nav
        aria-label="Fil d'ariane"
        className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
      >
        <Link href="/" className="transition-colors hover:text-emerald-700">Direct</Link>
        <span aria-hidden className="text-gray-300">›</span>
        <span className="truncate text-gray-600">
          {profile.firstName} {profile.lastName}
        </span>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Hero collant sous le header, comme sur une competition. La photo
            de couverture devient le fond : elle etait un bandeau decoratif de
            180px qui poussait le contenu sous la ligne de flottaison. */}
        <section className="sticky top-[var(--header-h,72px)] z-30 -mx-3 overflow-hidden bg-gray-900 text-white lg:-mx-5">
          {profile.coverPhotoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.coverPhotoUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/85 to-gray-900/60" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
          )}

          <div className="relative mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-lg font-black text-white/80">
                {profile.profilePictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profilePictureUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                  {profile.locationCity ?? ""}
                </p>
                <h1 className="mt-1 truncate font-display text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
                  {profile.firstName} {profile.lastName}
                </h1>
              </div>

              {/* Les deux actions restent au niveau du nom : suivre quelqu'un
                  et le mettre en selection se decident en le regardant. */}
              <div className="hidden shrink-0 items-center gap-2 sm:flex">
                {currentUser && !isOwnProfile && (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`flex items-center gap-2 border px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-60 ${
                      following
                        ? "border-white/30 text-white/80 hover:border-white"
                        : "border-white bg-white text-gray-900 hover:border-emerald-300 hover:bg-emerald-300"
                    }`}
                  >
                    {followLoading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : following ? (
                      <UserMinus size={13} />
                    ) : (
                      <UserPlus size={13} />
                    )}
                    {following ? "Abonné" : "Suivre"}
                  </button>
                )}

                {isManagerViewingPlayer && (
                  <button
                    onClick={handleShortlist}
                    disabled={shortlistLoading}
                    className={`flex items-center gap-2 border px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-60 ${
                      shortlistEntryId
                        ? "border-emerald-300 text-emerald-300"
                        : "border-white/30 text-white/80 hover:border-white"
                    }`}
                  >
                    {shortlistLoading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : shortlistEntryId ? (
                      <CheckCircle size={13} />
                    ) : (
                      <Plus size={13} />
                    )}
                    {shortlistEntryId ? "Dans la sélection" : "Mercato"}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-black uppercase tracking-[0.15em] text-white/55">
              <span className="text-emerald-300">
                {followerCount} abonné{followerCount > 1 ? "s" : ""}
              </span>
              {teams.length > 0 && (
                <span>{teams.length} équipe{teams.length > 1 ? "s" : ""}</span>
              )}
            </div>

            {profile.bio && (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">{profile.bio}</p>
            )}
          </div>
        </section>

        {/* Une seule carte, dont les onglets changent le contenu. */}
        <div className="mt-6 border border-gray-200/70 bg-white">
          <div className="flex gap-7 overflow-x-auto border-b border-gray-200/70 px-5">
            {publicTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`shrink-0 whitespace-nowrap border-b-2 py-4 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                  activeTab === t.key
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">
          {/* ═══ OVERVIEW ═══ */}
          {activeTab === "overview" && (
            <div>
              {isPlayer && <PlayerSection profile={profile} teams={teams} />}
              {isManager && <ManagerSection profile={profile} teams={teams} />}
              {isReferee && <RefereeSection profile={profile} />}
              {ownsVenue(profile) && <VenueOwnerSection profile={profile} />}
            </div>
          )}

          {/* ═══ PALMARÈS ═══ */}
          {activeTab === "palmares" && (
            <div className="space-y-4">
              {(profile.trophies ?? []).length === 0 ? (
                <div className="border border-gray-200/70 bg-white py-12 text-center">
                  <Trophy size={32} className="mx-auto text-gray-300" />
                  <p className="mt-3 text-sm font-medium text-gray-500">Aucun trophée</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(profile.trophies ?? []).map((trophy, i) => (
                    <div key={i} className="flex items-start gap-3 border border-gray-200/70 bg-white p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                        <Trophy size={20} className="text-amber-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{trophy.title}</p>
                        <p className="text-xs text-gray-500">{trophy.year}</p>
                        {trophy.description && (
                          <p className="mt-1 text-xs text-gray-400">{trophy.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ POSTS ═══ */}
          {activeTab === "posts" && (
            <div className="space-y-4">
              {loadingPosts ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={24} className="animate-spin text-emerald-500" />
                </div>
              ) : posts.length === 0 ? (
                <div className="border border-gray-200/70 bg-white py-12 text-center">
                  <FileText size={32} className="mx-auto text-gray-300" />
                  <p className="mt-3 text-sm font-medium text-gray-500">Aucun post publié</p>
                </div>
              ) : (
                posts.map((post) => (
                  // Plus de cast vers un UserProfile vide : PostCard accepte
                  // desormais un lecteur absent, et c'est ce mensonge au
                  // typage qui plantait sur charAt.
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    onLikeAction={handleLike}
                    onDeleteAction={handleDeletePost}
                  />
                ))
              )}
            </div>
          )}

          {/* ═══ GALERIE ═══ */}
          {activeTab === "galerie" && (
            <div>
              {(profile.galleryPhotos ?? []).length === 0 ? (
                <div className="border border-gray-200/70 bg-white py-12 text-center">
                  <ImageIcon size={32} className="mx-auto text-gray-300" />
                  <p className="mt-3 text-sm font-medium text-gray-500">Aucune photo dans la galerie</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {(profile.galleryPhotos ?? []).map((url, i) => (
                    <div key={i} className="aspect-square overflow-hidden border border-gray-200/70 bg-gray-100">
                      <img src={url} alt="" className="h-full w-full object-cover hover:scale-105 transition-transform duration-300" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
