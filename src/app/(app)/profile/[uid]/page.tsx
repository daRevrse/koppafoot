"use client";

import { isVenueOwner as ownsVenue } from "@/lib/hats";
import { aUnProfilPublic } from "@/lib/espaces-acces";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Loader2,
  Users,
  Trophy,
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
  MoreHorizontal,
  Link2 as LinkIcon,
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
import ProfileBanner from "@/components/profile/ProfileBanner";
import { useReplieAuDefilement } from "@/hooks/useReplieAuDefilement";
import toast from "react-hot-toast";

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

/** Le retour et les trois points, poses sur l'affiche. */
const PASTILLE_AFFICHE =
  "flex h-9 w-9 shrink-0 items-center justify-center border border-white/25 bg-black/25 text-white/80 backdrop-blur-sm transition-colors hover:border-white hover:text-white";

/** Les memes, dans la barre repliee : elle est deja verte, pas de voile. */
const PASTILLE_BARRE =
  "flex h-9 w-9 shrink-0 items-center justify-center border border-white/25 text-white/80 transition-colors hover:border-white hover:text-white";

/**
 * LES ECUSSONS, A GAUCHE DU BILAN. L'esquisse ouvre la rangee par eux : on
 * reconnait un joueur a ses couleurs avant de lire ses chiffres.
 *
 * Quatre au plus, et le reste en nombre : au-dela, la rangee ne tient plus
 * sur un telephone et la lecture n'y gagne rien.
 */
function CaseEquipes({ teams }: { teams: EquipePubliee[] }) {
  const montres = teams.slice(0, 4);
  const reste = teams.length - montres.length;

  return (
    /* PLEINE LARGEUR SUR TELEPHONE. Cote a cote avec les chiffres, la case
       prenait la moitie de la rangee et « Passes déc. » passait sur deux
       lignes ; les ecussons prennent leur propre ligne en dessous de 640 px. */
    <div className="flex w-full min-w-0 items-center gap-3 border-b border-gray-200/70 px-5 py-4 sm:w-auto sm:shrink-0 sm:border-b-0 sm:py-5">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
        Équipes
      </span>
      {/* CHAQUE ECUSSON EST UN LIEN. Ils ont remplace les cartes d'equipe de
          l'onglet « Apercu » — s'ils ne menaient nulle part, la fiche
          n'offrirait plus aucun chemin vers le club. `hover:z-10` pour que
          celui qu'on survole passe devant ses voisins, qui le chevauchent. */}
      <div className="flex items-center -space-x-2">
        {montres.map((t) => (
          <Link
            key={t.id}
            href={`/teams/${t.id}`}
            title={t.name}
            aria-label={t.name}
            className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gray-100 text-[10px] font-black text-gray-500 transition-transform hover:z-10 hover:scale-110"
          >
            {t.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              t.name.slice(0, 2).toUpperCase()
            )}
          </Link>
        ))}
        {reste > 0 && (
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gray-900 text-[10px] font-black text-white">
            +{reste}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * LES TROIS POINTS. « Suivre » se decide en regardant quelqu'un, il reste au
 * niveau du nom ; le partage et le mercato sont des actions de second rang,
 * elles passent ici plutot que d'ajouter deux boutons a l'affiche.
 */
function MenuFiche({
  url,
  surMercato,
  dansLaSelection,
  mercatoEnCours,
  surAffiche,
}: {
  url: string;
  surMercato: (() => void) | null;
  dansLaSelection: boolean;
  mercatoEnCours: boolean;
  surAffiche?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", clic);
    return () => document.removeEventListener("mousedown", clic);
  }, [ouvert]);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien de la fiche copié");
    } catch {
      // Presse-papiers refuse hors contexte securise : on ne fait pas
      // semblant d'avoir copie.
      toast.error("Impossible de copier le lien");
    }
    setOuvert(false);
  };

  return (
    <div ref={boite} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-haspopup="true"
        aria-label="Plus d'actions"
        className={surAffiche ? PASTILLE_AFFICHE : PASTILLE_BARRE}
      >
        <MoreHorizontal size={16} />
      </button>

      {ouvert && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 border border-gray-200/70 bg-white shadow-xl">
          <button
            type="button"
            onClick={copier}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <LinkIcon size={15} className="text-gray-400" />
            Copier le lien
          </button>
          {surMercato && (
            <button
              type="button"
              onClick={() => { surMercato(); setOuvert(false); }}
              disabled={mercatoEnCours}
              className="flex w-full items-center gap-2.5 border-t border-gray-200/70 px-4 py-3 text-left text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {mercatoEnCours ? (
                <Loader2 size={15} className="animate-spin text-gray-400" />
              ) : dansLaSelection ? (
                <CheckCircle size={15} className="text-emerald-600" />
              ) : (
                <Plus size={15} className="text-gray-400" />
              )}
              {dansLaSelection ? "Retirer de ma sélection" : "Ajouter au mercato"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Une case de la rangee de bilan, sous la banniere. */
function BilanCase({ label, value, suffixe }: { label: string; value: number; suffixe?: string }) {
  return (
    <div className="px-3 py-5 text-center">
      <span className="block font-display text-3xl font-black tabular-nums leading-none text-gray-900 sm:text-4xl">
        {value}{suffixe}
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

function PlayerSection({ profile }: { profile: UserProfile }) {
  const level = profile.skillLevel ? SKILL_LEVEL_LABELS[profile.skillLevel] ?? profile.skillLevel : null;
  const age = profile.dateOfBirth ? calculateAge(profile.dateOfBirth) : null;
  const physique = Boolean(profile.strongFoot || profile.height || profile.weight || age !== null);

  /* L'ONGLET NE RESTE PAS VIDE. Il portait les equipes, et elles sont
     remontees dans le bandeau : sur un joueur qui n'a renseigne ni niveau ni
     mensurations, il ne restait qu'un rectangle blanc. Une phrase vaut mieux
     — elle dit que la fiche est jeune, pas qu'elle est cassee. */
  if (!level && !physique) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        Ce joueur n&apos;a pas encore renseigné son profil sportif.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Le poste ne revient pas ici : la banniere le porte deja, sous le
          nom. Deux fois le meme mot sur un ecran de telephone, c'est une fois
          de trop. */}
      {level && (
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
            <Star size={14} /> {level}
          </span>
        </div>
      )}

      <PhysicalInfoCard profile={profile} />
    </div>
  );
}

function ManagerSection({ profile, teams }: { profile: UserProfile; teams: EquipePubliee[] }) {
  const totalMatches = teams.reduce((sum, t) => sum + t.matchesPlayed, 0);
  const totalWins = teams.reduce((sum, t) => sum + t.wins, 0);
  const globalWinRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

  // Meme raison que cote joueur : les cartes d'equipe sont parties dans le
  // bandeau, l'onglet ne doit pas se reduire a un rectangle blanc.
  if (!profile.teamName && totalMatches === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        Ce manager n&apos;a pas encore de match dirigé.
      </p>
    );
  }

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
            {/* Le bandeau donne le pourcentage, cette carte donne ce qui le
                fonde : « 20 victoires sur 39 matchs » n'est pas une redite. */}
            <p className="text-sm font-semibold text-gray-900">Taux de victoire global</p>
            <p className="text-2xl font-bold text-emerald-600">{globalWinRate}%</p>
            <p className="text-xs text-gray-500">{totalWins} victoires sur {totalMatches} matchs</p>
          </div>
        </div>
      )}
    </div>
  );
}

function RefereeSection({ profile, bilan }: { profile: UserProfile; bilan: BilanArbitre | null }) {
  const licenseLevel = profile.licenseLevel
    ? LICENSE_LEVEL_LABELS[profile.licenseLevel] ?? profile.licenseLevel
    : null;
  const maskedLicense = profile.licenseNumber
    ? profile.licenseNumber.slice(0, 3) + "***"
    : null;

  return (
    <div className="space-y-4">
      {/* Ce qu'un manager regarde avant d'inviter : combien de matchs, et ce
          qu'en ont pensé ceux qui l'ont eu au sifflet. */}
      {bilan && (
        <div className="grid grid-cols-2 border border-gray-200/70 bg-white">
          <div className="border-r border-gray-200/70 p-4">
            <p className="text-xs text-gray-500">Matchs arbitrés</p>
            <p className="mt-1 font-display text-2xl font-black text-gray-900">{bilan.matchs}</p>
          </div>
          <div className="p-4">
            <p className="text-xs text-gray-500">Note des managers</p>
            {bilan.note !== null ? (
              <p className="mt-1 flex items-baseline gap-1">
                <span className="font-display text-2xl font-black text-gray-900">
                  {bilan.note.toFixed(1).replace(".", ",")}
                </span>
                <span className="text-xs font-bold text-gray-400">/ 5 · {bilan.avis} avis</span>
              </p>
            ) : (
              <p className="mt-1.5 text-sm font-semibold text-gray-400">Pas encore noté</p>
            )}
          </div>
        </div>
      )}
      {bilan?.corps && (
        <div className="flex items-center gap-3 border border-gray-200/70 bg-white p-4">
          <Users size={20} className="shrink-0 text-violet-600" />
          <div className="min-w-0">
            <p className="text-xs text-gray-500">
              {bilan.corps.chef ? "Dirige le corps arbitral" : "Membre du corps arbitral"}
            </p>
            <p className="truncate font-semibold text-gray-900">
              « {bilan.corps.nom} »
              <span className="ml-2 text-xs font-normal text-gray-500">
                {bilan.corps.membres} officiel{bilan.corps.membres > 1 ? "s" : ""}
              </span>
            </p>
          </div>
        </div>
      )}
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
/** Le compte existe, mais n'a pas de page : voir aUnProfilPublic. */
interface ApercuSansPage {
  uid: string;
  nom: string;
  photo: string | null;
}

/** Le bilan d'un arbitre, calculé par /api/public/profile/[uid]. */
interface BilanArbitre {
  matchs: number;
  note: number | null;
  avis: number;
  /** Son corps arbitral, s'il en a un : nom, et s'il le dirige. */
  corps?: { nom: string; chef: boolean; membres: number } | null;
}

async function fetchPublicProfile(
  uid: string,
): Promise<
  | { profile: UserProfile; teams: EquipePubliee[]; apercu: null; arbitrage: BilanArbitre | null }
  | { profile: null; teams: EquipePubliee[]; apercu: ApercuSansPage; arbitrage: null }
  | null
> {
  try {
    const res = await fetch(`/api/public/profile/${encodeURIComponent(uid)}`);
    if (!res.ok) return null;
    const { profile, teams, sansProfilPublic, arbitrage } = await res.json();
    if (sansProfilPublic) {
      return {
        profile: null,
        teams: [],
        arbitrage: null,
        apercu: {
          uid: sansProfilPublic.uid,
          nom: `${sansProfilPublic.first_name ?? ""} ${sansProfilPublic.last_name ?? ""}`.trim(),
          photo: sansProfilPublic.profile_picture_url ?? null,
        },
      };
    }
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
      matchesPlayed: profile.matches_played ?? 0,
      goals: profile.goals ?? 0,
      assists: profile.assists ?? 0,
      followersCount: profile.followers_count ?? 0,
      licenseLevel: profile.license_level ?? undefined,
      licenseNumber: profile.license_number ?? undefined,
      experienceYears: profile.experience_years ?? undefined,
      // Le cast passe par `unknown` a dessein : UserProfile exige email,
      // phone et quelques champs de compte que cette projection ne porte pas
      //, c'est tout l'interet de la projection. La page ne lit aucun d'eux.
    } as unknown as UserProfile;

    // Les equipes arrivent deja au format de la page : l'endpoint les projette
    // en camelCase, il n'y a rien a retraduire ici.
    return {
      profile: mapped,
      teams: (teams ?? []) as EquipePubliee[],
      apercu: null,
      arbitrage: (arbitrage ?? null) as BilanArbitre | null,
    };
  } catch {
    return null;
  }
}

export default function PublicProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();

  /** Meme repli que le tableau d'affichage, voir MatchHero. */
  const revenir = () => {
    // `history.length > 1` distingue une navigation interne d'une arrivee
    // directe (lien partage, onglet neuf), ou `back()` sortirait du site.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  };

  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Le repli de l'affiche, meme mecanisme que le tableau d'affichage d'un
  // match : on surveille l'affiche, pas le defilement. `Boolean(profile)`
  // rebranche l'observateur quand la fiche arrive — avant, il n'y a rien a
  // observer.
  const barreRef = useRef<HTMLDivElement>(null);
  const afficheRef = useRef<HTMLDivElement>(null);
  const replie = useReplieAuDefilement(barreRef, afficheRef, Boolean(profile));

  /** L'adresse de la fiche, pour le partage. Vide avant le montage. */
  const lienFiche = typeof window === "undefined" ? "" : window.location.href;
  const [apercu, setApercu] = useState<ApercuSansPage | null>(null);
  const [teams, setTeams] = useState<EquipePubliee[]>([]);
  const [arbitrage, setArbitrage] = useState<BilanArbitre | null>(null);
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

        // Pas de page publique : on s'arrete la, sans meme lire la fiche.
        if (pub?.apercu) {
          setApercu(pub.apercu);
          setProfile(null);
          setLoading(false);
          return;
        }

        // Connecte, la lecture directe reste la source de la FICHE : elle
        // porte les champs de compte que la projection ne publie pas.
        const p = currentUser ? await getUserById(uid) : pub?.profile ?? null;
        if (!p) {
          setProfile(null);
          setLoading(false);
          return;
        }

        // LA MEME REGLE SUR LE CHEMIN CONNECTE. Un lecteur connecte contourne
        // la projection publique — sans ce controle, lui seul aurait vu la
        // fiche vide que la regle retire aux autres.
        //
        // Uniquement quand `pub` a repondu : s'il a echoue, on ne sait rien
        // des equipes, et masquer une fiche legitime serait pire que la
        // montrer. Ce n'est pas une barriere de confidentialite.
        if (pub && !aUnProfilPublic(p, { appartientAUneEquipe: pub.teams.length > 0 })) {
          setApercu({
            uid: p.uid,
            nom: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
            photo: p.profilePictureUrl ?? null,
          });
          setProfile(null);
          setLoading(false);
          return;
        }

        // LE BILAN VIENT TOUJOURS DE LA PROJECTION. Connecté, on lit le
        // document brut, dont les trois compteurs ne couvrent que les
        // amicaux : un joueur de tournoi y avait 0 but. La projection, elle,
        // additionne les compétitions (voir lib/bilan-public). Même fiche,
        // même bilan, qu'on soit connecté ou non.
        if (currentUser && pub?.profile) {
          p.matchesPlayed = pub.profile.matchesPlayed;
          p.goals = pub.profile.goals;
          p.assists = pub.profile.assists;
        }

        setProfile(p);
        setFollowerCount(p.followersCount ?? 0);
        setTeams(pub?.teams ?? []);
        setArbitrage(pub?.arbitrage ?? null);
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

  // Le compte existe, mais n'a rien a montrer. On le dit, plutot que de
  // mentir dans un sens (« introuvable ») ou dans l'autre (une fiche vide).
  if (apercu) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="border border-gray-200/70 bg-white p-8 text-center sm:p-12">
          {apercu.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={apercu.photo} alt="" className="mx-auto h-20 w-20 object-cover" />
          ) : (
            <div className="mx-auto flex h-20 w-20 items-center justify-center border border-gray-200/70 bg-gray-50">
              <Users size={26} className="text-gray-300" strokeWidth={1.5} />
            </div>
          )}

          <h1 className="mt-5 font-display text-xl font-black uppercase tracking-tight text-gray-900">
            {apercu.nom || "Ce membre"}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-gray-500">
            Ce compte n&apos;a pas encore de fiche publique : aucun rôle activé,
            aucune équipe. Il en aura une dès qu&apos;il rejoindra un effectif ou
            choisira son rôle.
          </p>

          {isOwnProfile ? (
            <Link
              href="/roles#choisir"
              className="mt-7 inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
            >
              Choisir mon rôle
            </Link>
          ) : (
            <button
              onClick={() => router.back()}
              className="mt-7 inline-flex items-center gap-2 border border-gray-200/70 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900"
            >
              <ArrowLeft size={14} /> Retour
            </button>
          )}
        </div>
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

  // MÊME RÈGLE QUE SUR SON PROPRE PROFIL : pas de palmarès sans rôle. Une
  // fiche publique existe dès qu'il y a quelque chose à montrer, et un compte
  // sans rôle en a une s'il appartient à une équipe — mais il n'a, lui, aucun
  // titre à exposer.
  // Lu sur `profile` et non sur les trois indicateurs plus bas : ils sont
  // déclarés après cette liste, et les remonter déplacerait le commentaire qui
  // les explique loin d'eux.
  const roleDuProfil = profile.evolutionRole ?? profile.userType;
  const sansRole = roleDuProfil !== "player" && roleDuProfil !== "manager" && roleDuProfil !== "referee";

  const publicTabs: { key: PublicTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { key: "overview", label: "Aperçu", icon: Users },
    ...(sansRole ? [] : [{ key: "palmares" as PublicTab, label: "Palmarès", icon: Trophy }]),
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

  // Sous le nom : LE POSTE, ET RIEN D'AUTRE. Le club y figurait aussi, et
  // c'etait une redite — les ecussons du bandeau le disent juste en dessous,
  // avec les autres, et l'onglet « Apercu » les nomme. Un joueur a un poste,
  // il peut avoir plusieurs maillots.
  const posteLisible = profile.position
    ? POSITION_LABELS[profile.position] ?? profile.position
    : null;
  const surtitre = posteLisible ?? ROLE_LABELS[roleDuProfil] ?? profile.locationCity;

  // Le bilan d'un manager se lit sur ses equipes, pas sur `users` : ce sont
  // elles qui portent le bilan, et la projection publique les sert deja.
  const matchsDirigees = teams.reduce((n, t) => n + t.matchesPlayed, 0);
  const victoires = teams.reduce((n, t) => n + t.wins, 0);
  const pourcentVictoires = matchsDirigees > 0 ? Math.round((victoires / matchsDirigees) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl pb-24">
      {/* UNE SEULE BARRE, TOUJOURS LA.
          Elle flotte SUR l'affiche — transparente, ses pastilles posees sur
          un voile — et se remplit de vert en prenant le nom quand l'affiche
          est passee dessous. Meme observateur que le tableau d'affichage d'un
          match, voir useReplieAuDefilement.

          POURQUOI PAS DEUX ETATS MONTES/DEMONTES. Une barre qu'on replie par
          `max-h-0` demande `overflow-hidden`, et le menu des trois points s'y
          serait fait couper net. Une barre qu'on demonte prive l'observateur
          de l'element dont il mesure le bas. Elle reste donc en place, et
          `-mb-14` l'empeche de pousser l'affiche vers le bas : elle la
          recouvre au lieu de s'ajouter a elle.

          Elle est verte, et c'est le sujet : l'en-tete de l'application est
          blanc desormais, une fiche de joueur garde la couleur du produit. */}
      <div
        ref={barreRef}
        style={{ top: "var(--header-h, 0px)" }}
        className={`sticky z-30 -mx-3 -mb-14 -mt-3 h-14 text-white transition-colors duration-200 lg:-mx-5 lg:-mt-5 ${
          replie ? "bg-emerald-900" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-8">
          <button
            type="button"
            onClick={revenir}
            aria-label="Revenir à l'écran précédent"
            className={replie ? PASTILLE_BARRE : PASTILLE_AFFICHE}
          >
            <ArrowLeft size={16} />
          </button>

          {/* Le nom n'entre que replie : tant que l'affiche est la, il y est
              deja, en grand. `aria-hidden` et pas seulement invisible — un
              lecteur d'ecran annoncerait deux fois le meme nom. */}
          <p
            aria-hidden={!replie}
            className={`min-w-0 flex-1 truncate text-center text-sm font-black uppercase tracking-[0.12em] transition-opacity duration-200 ${
              replie ? "opacity-100" : "opacity-0"
            }`}
          >
            {profile.firstName} {profile.lastName}
          </p>

          {currentUser && !isOwnProfile && (
            <button
              type="button"
              onClick={handleFollow}
              disabled={followLoading}
              aria-label={following ? "Se désabonner" : "Suivre"}
              className={`${replie ? PASTILLE_BARRE : PASTILLE_AFFICHE} ${following ? "border-emerald-300 text-emerald-300" : ""}`}
            >
              {followLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : following ? (
                <UserMinus size={16} />
              ) : (
                <UserPlus size={16} />
              )}
            </button>
          )}

          <MenuFiche
            url={lienFiche}
            surMercato={isManagerViewingPlayer ? handleShortlist : null}
            dansLaSelection={Boolean(shortlistEntryId)}
            mercatoEnCours={shortlistLoading}
            surAffiche={!replie}
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <ProfileBanner
          afficheRef={afficheRef}
          coverUrl={profile.coverPhotoUrl}
          avatarUrl={profile.profilePictureUrl}
          initials={initials}
          name={`${profile.firstName} ${profile.lastName}`}
          eyebrow={surtitre}
          slogan={profile.bio}
          meta={
            /* Le nombre d'equipes ne revient pas ici : les ecussons le disent
               juste en dessous, et l'onglet « Apercu » les nomme. Trois fois
               la meme information sur un ecran de telephone. */
            <span className="text-emerald-300">
              {followerCount} abonné{followerCount > 1 ? "s" : ""}
            </span>
          }
          actions={
            /* SUIVRE RESTE AU NIVEAU DU NOM : c'est la decision qu'on prend
               en regardant quelqu'un. Le reste — le mercato, le partage —
               passe derriere les trois points, en haut.

               SUR SA PROPRE FICHE, RIEN. Pas meme un « Modifier » : une page
               publique montre ce qu'un visiteur verrait, et une commande
               d'edition posee dessus n'en fait plus une page publique. On
               edite depuis « Mon compte ». */
            currentUser && !isOwnProfile ? (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`flex items-center gap-2 border px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-60 ${
                  following
                    ? "border-white/40 text-white hover:border-white"
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
            ) : null
          }
        />

        {/* LE BANDEAU DE BILAN. Il vivait au fond de l'onglet « Apercu »,
            sous les badges et les mensurations : des nombres qu'on ouvre la
            fiche pour lire, et qu'il fallait chercher. L'esquisse les pose en
            rangee juste sous l'affiche, avec les ecussons a gauche, et elle a
            raison — c'est la premiere chose qui doit remonter au defilement.

            UN ARBITRE N'EN A PAS. Rien de ce qu'il fait n'est publie
            aujourd'hui : une rangee de zeros vaudrait moins que pas de
            rangee du tout. */}
        {(isPlayer || isManager) && (
          <div className="mt-6 flex flex-wrap items-stretch border border-gray-200/70 bg-white sm:divide-x sm:divide-gray-200/70">
            {teams.length > 0 && <CaseEquipes teams={teams} />}
            {/* `w-full` sur telephone : quand la case des ecussons prend sa
                propre ligne, `flex-1` seul ne donne a celle-ci aucune base et
                les chiffres debordaient a droite de la carte. */}
            <div className="grid w-full grid-cols-3 divide-x divide-gray-200/70 sm:w-auto sm:flex-1">
              {isPlayer ? (
                <>
                  <BilanCase label="Matchs" value={profile.matchesPlayed ?? 0} />
                  <BilanCase label="Buts" value={profile.goals ?? 0} />
                  <BilanCase label="Passes déc." value={profile.assists ?? 0} />
                </>
              ) : (
                <>
                  <BilanCase label="Équipes" value={teams.length} />
                  <BilanCase label="Matchs" value={matchsDirigees} />
                  <BilanCase label="% vict." value={pourcentVictoires} suffixe="%" />
                </>
              )}
            </div>
          </div>
        )}

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
              {isPlayer && <PlayerSection profile={profile} />}
              {isManager && <ManagerSection profile={profile} teams={teams} />}
              {isReferee && <RefereeSection profile={profile} bilan={arbitrage} />}
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
