"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  nomPersonne, telephoneOptionnel, villeOptionnelle,
} from "@/lib/champs-valides";
import toast from "react-hot-toast";
import {
  Camera, Edit3, Save, X, Loader2, MapPin, Calendar, Mail, Phone,
  Trophy, ImageIcon, FileText, CreditCard, Plus, Trash2,
  Ruler, Weight, Footprints, Cake, LogOut, AlertTriangle, KeyRound, Settings,
  ChevronRight,
} from "lucide-react";
import { deleteField } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { uploadProfilePhoto, uploadGalleryPhoto } from "@/lib/storage";
import { getPostsByUser } from "@/lib/firestore";
import KoppaFootCard from "@/components/ui/KoppaFootCard";
import LoginMethodsCard from "@/components/auth/LoginMethodsCard";
import { useT } from "@/i18n";
import type { Post } from "@/types";
import ProfileBanner from "@/components/profile/ProfileBanner";

// ============================================
// Schema
// ============================================

const schema = yup.object({
  firstName: nomPersonne("Prénom"),
  lastName: nomPersonne("Nom"),
  phone: telephoneOptionnel,
  locationCity: villeOptionnelle,
  bio: yup.string().max(500, "Max. 500 caractères").optional(),
  // Player
  position: yup.string().optional(),
  skillLevel: yup.string().optional(),
  // Physical
  strongFoot: yup.string().optional(),
  height: yup.number().min(100, "Entre 100 et 250 cm").max(250, "Entre 100 et 250 cm").optional().nullable().transform((v) => (isNaN(v) ? null : v)),
  weight: yup.number().min(30, "Entre 30 et 200 kg").max(200, "Entre 30 et 200 kg").optional().nullable().transform((v) => (isNaN(v) ? null : v)),
  dateOfBirth: yup.string().optional(),
  // Manager
  teamName: yup.string().optional(),
  // Referee
  licenseNumber: yup.string().optional(),
  licenseLevel: yup.string().optional(),
  experienceYears: yup.number().min(0, "Ne peut pas être négatif").optional().nullable().transform((v) => (isNaN(v) ? null : v)),
});

type FormData = yup.InferType<typeof schema>;
type TabType = "info" | "palmares" | "posts" | "galerie" | "carte" | "compte";

// ============================================
// Info Row Component
// ============================================

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string | null | undefined }) {
  return (
    // UNE DONNEE D'UNE LIGNE TENAIT SUR TROIS : l'icone, l'etiquette en
    // dessous, la valeur encore en dessous. Etiquette et valeur se rangent
    // maintenant cote a cote — le libelle a gauche, la valeur a droite, comme
    // se lit une fiche — et trois coordonnees occupent la hauteur qu'une
    // seule prenait.
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex shrink-0 items-center gap-2 text-xs text-gray-500">
        <Icon size={15} className="text-gray-400" />
        {label}
      </span>
      <span className="min-w-0 truncate text-sm font-medium text-gray-900">
        {value || "Non renseigné"}
      </span>
    </div>
  );
}

// ============================================
// Physical Info Labels
// ============================================

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

// ============================================
// Time ago helper
// ============================================

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  return `Il y a ${days}j`;
}

// ============================================
// Profile Page
// ============================================

export default function ProfilePage() {
  const { user, firebaseUser, updateProfile, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    // Home is public, no reason to send anyone to a login screen.
    router.push("/");
  };
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<TabType>("info");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // Gallery state
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Palmares state
  const [trophyTitle, setTrophyTitle] = useState("");
  const [trophyYear, setTrophyYear] = useState(new Date().getFullYear());
  const [trophyDesc, setTrophyDesc] = useState("");
  const [addingTrophy, setAddingTrophy] = useState(false);

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormData>({
    resolver: yupResolver(schema) as any,
    values: user
      ? {
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone ?? "",
          locationCity: user.locationCity ?? "",
          bio: user.bio ?? "",
          strongFoot: user.strongFoot ?? "",
          height: user.height ?? null,
          weight: user.weight ?? null,
          dateOfBirth: user.dateOfBirth ?? "",
          // Sans ces valeurs, ouvrir "Modifier" affichait des selects vides
          // et enregistrer effaçait le poste et le niveau déjà renseignés.
          position: user.position ?? "",
          skillLevel: user.skillLevel ?? "",
          licenseNumber: user.licenseNumber ?? "",
          licenseLevel: user.licenseLevel ?? "",
          experienceYears: user.experienceYears ?? null,
        }
      : undefined,
  });

  // Load posts when tab changes
  useEffect(() => {
    if (tab === "posts" && user) {
      setLoadingPosts(true);
      getPostsByUser(user.uid, user.uid).then((data) => {
        setPosts(data);
        setLoadingPosts(false);
      });
    }
  }, [tab, user]);

  if (!user) return null;

  // Le rôle effectif prime sur `user_type`. Depuis le pivot tout compte est
  // créé en "player" et le rôle réel vient de /evolution, mais l'inverse
  // existe aussi : un ancien compte "manager" qui a activé l'espace joueur.
  // Se fier au seul user_type cachait le bloc physique aux deux.
  const effectiveRole: string = user.evolutionRole ?? user.userType;
  const isPlayerRole = effectiveRole === "player";
  // AUX JOUEURS, ET À EUX SEULS.
  //
  // La liste d'exclusion ci-dessus ne défendait plus rien : « organizer »,
  // « venue_owner » et « superadmin » étaient des `user_type`, et ces valeurs
  // n'existent plus depuis que les casquettes sont passées en drapeaux. Le
  // rôle effectif ne peut plus valoir que user, player, manager ou referee :
  // la condition était donc vraie pour tout le monde, y compris pour un compte
  // sans rôle, qui ouvrait son profil sur quatre cases vides et une invitation
  // à renseigner sa taille.
  //
  // Un manager ou un arbitre qui joue vraiment a un rôle joueur à activer,
  // c'est le sens du modèle.
  const showPhysical = isPlayerRole;
  // Même règle que le reste de la page : le rôle effectif. Un arbitre
  // activé depuis /evolution garde `user_type` « player », et ne voyait
  // jamais ses champs de licence.
  const isRefereeRole = effectiveRole === "referee";
  const physicalComplete = Boolean(user.strongFoot && user.height && user.weight && user.dateOfBirth);

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : "";

  // Photo upload handlers
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadProfilePhoto(user.uid, file, "avatar");
      await updateProfile({ profile_picture_url: url });
      toast.success("Photo de profil mise à jour");
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadProfilePhoto(user.uid, file, "cover");
      await updateProfile({ cover_photo_url: url });
      toast.success("Photo de couverture mise à jour");
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploadingCover(false);
    }
  };

  // Gallery upload
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingGallery(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadGalleryPhoto(user.uid, file);
        newUrls.push(url);
      }
      const currentGallery = user.galleryPhotos ?? [];
      await updateProfile({ gallery_photos: [...currentGallery, ...newUrls] });
      toast.success(`${newUrls.length} photo(s) ajoutée(s)`);
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploadingGallery(false);
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const handleRemoveGalleryPhoto = async (urlToRemove: string) => {
    const updated = (user.galleryPhotos ?? []).filter((u) => u !== urlToRemove);
    await updateProfile({ gallery_photos: updated });
    toast.success("Photo supprimée");
  };

  // Trophy management
  const handleAddTrophy = async () => {
    if (!trophyTitle.trim()) return;
    setAddingTrophy(true);
    try {
      const currentTrophies = user.trophies ?? [];
      const newTrophy = {
        title: trophyTitle.trim(),
        year: trophyYear,
        ...(trophyDesc.trim() && { description: trophyDesc.trim() }),
      };
      await updateProfile({ trophies: [...currentTrophies, newTrophy] } as any);
      setTrophyTitle("");
      setTrophyDesc("");
      toast.success("Trophée ajouté");
    } catch {
      toast.error("Erreur");
    } finally {
      setAddingTrophy(false);
    }
  };

  const handleRemoveTrophy = async (index: number) => {
    const current = [...(user.trophies ?? [])];
    current.splice(index, 1);
    await updateProfile({ trophies: current } as any);
    toast.success("Trophée supprimé");
  };

  /**
   * UN CHAMP VIDÉ S'EFFACE. On envoyait `undefined` pour un champ vide, et
   * updateProfile retire les `undefined` avant d'écrire : vider sa bio ou
   * son poids puis enregistrer ne changeait rien, l'ancienne valeur
   * revenait. Un champ vide devient donc une suppression du champ.
   */
  const ouEfface = <T,>(v: T | "" | null | undefined): T =>
    v === "" || v === null || v === undefined ? (deleteField() as unknown as T) : v;

  // Save profile
  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      await updateProfile({
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone || null,
        location_city: data.locationCity || "",
        bio: ouEfface(data.bio),
        // Physical
        ...(showPhysical && {
          strong_foot: ouEfface(data.strongFoot as "left" | "right" | "both" | ""),
          height: ouEfface(data.height),
          weight: ouEfface(data.weight),
          date_of_birth: ouEfface(data.dateOfBirth),
        }),
        ...(isPlayerRole && {
          position: ouEfface(data.position),
          skill_level: ouEfface(data.skillLevel),
        }),
        ...(isRefereeRole && {
          license_number: ouEfface(data.licenseNumber),
          license_level: ouEfface(data.licenseLevel),
          experience_years: ouEfface(data.experienceYears),
        }),
      });
      toast.success("Profil mis à jour");
      setEditing(false);
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  /**
   * LE FORMULAIRE REFUSAIT EN SILENCE. Le téléphone, la ville, la taille, le
   * poids et l'expérience sont validés, mais leurs erreurs ne s'affichaient
   * nulle part : un numéro ancien au mauvais format, et « Enregistrer » ne
   * faisait rien, sans un mot. Les erreurs s'affichent désormais sous chaque
   * champ, et on le dit une fois.
   */
  const onInvalid = () => {
    toast.error("Certains champs sont à corriger");
  };

  const handleCancel = () => {
    reset();
    setEditing(false);
  };

  const age = user.dateOfBirth ? calculateAge(user.dateOfBirth) : null;

  // Tab definitions
  // PAS DE PALMARÈS SANS RÔLE. Un compte qui n'a rien activé ne joue pas, ne
  // dirige pas et ne siffle pas : son palmarès est vide par construction, et
  // un onglet qui ne peut rien contenir n'est qu'une case à ouvrir pour rien.
  // Il revient le jour où un rôle est choisi.
  const sansRole = effectiveRole === "user";

  const tabs: { key: TabType; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { key: "info", label: "Informations", icon: FileText },
    ...(sansRole ? [] : [{ key: "palmares" as TabType, label: "Palmarès", icon: Trophy }]),
    { key: "posts", label: "Posts", icon: FileText },
    { key: "galerie", label: "Galerie", icon: ImageIcon },
    ...(isPlayerRole
      ? [{ key: "carte" as TabType, label: "Carte FUT", icon: CreditCard }]
      : []),
    { key: "compte", label: "Compte", icon: KeyRound },
  ];

  /** « Modifier » ouvre l'édition là où elle se trouve : l'onglet Informations. */
  const startEditing = () => {
    setTab("info");
    setEditing(true);
  };

  return (
    <div className="mx-auto max-w-6xl pb-24">
      {/* La meme banniere que la fiche publique, et pour la meme raison : la
          photo de couverture se televerse ICI. Si elle s'y montrait a 35 %
          sous un degrade et en pleine page ailleurs, on choisirait son image
          sans jamais voir ce qu'elle donne. On garde ce que la fiche publique
          n'a pas : l'appareil photo sur l'avatar, et l'entree en edition. */}
      <ProfileBanner
        coverUrl={user.coverPhotoUrl ?? null}
        avatarUrl={user.profilePictureUrl ?? null}
        initials={initials}
        name={`${user.firstName} ${user.lastName}`}
        eyebrow="Mon compte"
        avatarBadge={
          <>
            <button
              onClick={() => avatarRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Changer ma photo"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white transition-transform hover:bg-emerald-400 active:scale-90"
            >
              {uploadingAvatar ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </>
        }
        meta={
          <>
            {user.locationCity && <span>{user.locationCity}</span>}
            {memberSince && <span>Depuis {memberSince}</span>}
            <span className="text-emerald-300">
              {user.followersCount ?? 0} abonné{(user.followersCount ?? 0) > 1 ? "s" : ""}
            </span>
          </>
        }
        actions={
          <div className="flex items-center gap-3">
            <Link
              href={`/profile/${user.uid}`}
              className="hidden text-[11px] font-black uppercase tracking-[0.15em] text-white/70 transition-colors hover:text-white sm:inline"
            >
              Ma fiche publique
            </Link>
            {/* La couverture n'avait plus de bouton depuis le passage a la
                banniere commune : le televersement existait, rien ne
                l'appelait. */}
            <button
              onClick={() => coverRef.current?.click()}
              disabled={uploadingCover}
              aria-label="Changer la photo de couverture"
              className="flex items-center gap-2 border border-white/40 px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-white disabled:opacity-60"
            >
              {uploadingCover ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              <span className="hidden sm:inline">Couverture</span>
            </button>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            {!editing && (
              <button
                onClick={startEditing}
                className="flex items-center gap-2 border border-white bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] text-gray-900 transition-colors hover:border-emerald-300 hover:bg-emerald-300"
              >
                <Edit3 size={13} />
                Modifier
              </button>
            )}
          </div>
        }
      />

      {/* Une seule carte, dont les onglets changent le contenu. */}
      <div className="mt-6 border border-gray-200/70 bg-white">
        <div className="flex gap-7 overflow-x-auto border-b border-gray-200/70 px-5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 whitespace-nowrap border-b-2 py-4 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                tab === t.key
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
        {/* ═══════════════ TAB: INFO (read) ═══════════════ */}
        {tab === "info" && !editing && (
          <div className="grid gap-4 md:grid-cols-3">
            {/* UNE SEULE CARTE POUR CE QUI EST A SOI. La bio tenait une carte
                entiere pour une phrase, avec son cadre, son titre et vingt
                pixels de marge de chaque cote ; les coordonnees en tenaient
                une autre juste dessous. C'est la meme chose — ce que
                l'utilisateur a renseigne sur lui — et ca se lit d'un bloc.
                La bio ouvre la carte quand elle existe, et ne laisse rien
                quand elle est vide. */}
            <div className="border border-gray-200/70 bg-white p-4 md:col-span-3">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Mes informations</h3>
              {user.bio && (
                <p className="mb-3 border-l-2 border-emerald-200 pl-3 text-sm italic text-gray-600">
                  {user.bio}
                </p>
              )}
              <div className="divide-y divide-gray-200/70">
                <InfoRow icon={Phone} label="Téléphone" value={user.phone} />
                <InfoRow icon={MapPin} label="Ville" value={user.locationCity} />
              </div>
            </div>
            {/* Physical Info Card */}
            {showPhysical && (
              <div className="border border-gray-200/70 bg-white p-4 md:col-span-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Ruler size={16} className="text-emerald-600" />
                    Informations physiques
                  </h3>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex shrink-0 items-center gap-1.5 border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    <Edit3 size={13} />
                    {physicalComplete ? "Modifier" : "Compléter"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="border border-gray-200/70 bg-gray-50 p-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Footprints size={14} className="text-emerald-500" />
                      Pied fort
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">
                      {user.strongFoot ? FOOT_LABELS[user.strongFoot] : ","}
                    </p>
                  </div>
                  <div className="border border-gray-200/70 bg-gray-50 p-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Ruler size={14} className="text-emerald-500" />
                      Taille
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">
                      {user.height ? `${user.height} cm` : ","}
                    </p>
                  </div>
                  <div className="border border-gray-200/70 bg-gray-50 p-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Weight size={14} className="text-emerald-500" />
                      Poids
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">
                      {user.weight ? `${user.weight} kg` : ","}
                    </p>
                  </div>
                  <div className="border border-gray-200/70 bg-gray-50 p-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Cake size={14} className="text-emerald-500" />
                      Âge
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">
                      {age !== null ? `${age} ans` : ","}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ TAB: INFO (edit) ═══════════════ */}
        {tab === "info" && editing && (
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className=" border border-gray-200/70 bg-white p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Prénom</label>
                <input {...register("firstName")} className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
                {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
                <input {...register("lastName")} className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
                {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Téléphone</label>
                <input {...register("phone")} type="tel" className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ville</label>
                <input {...register("locationCity")} className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
                {errors.locationCity && <p className="mt-1 text-xs text-red-600">{errors.locationCity.message}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Bio</label>
                <textarea {...register("bio")} rows={3} className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
                {errors.bio && <p className="mt-1 text-xs text-red-600">{errors.bio.message}</p>}
              </div>

              {/* Physical info */}
              {showPhysical && (
                <div className="md:col-span-2">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Ruler size={16} className="text-emerald-600" /> Informations physiques
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Pied fort</label>
                      <select {...register("strongFoot")} className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none">
                        <option value="">Non spécifié</option>
                        <option value="right">Droit</option>
                        <option value="left">Gauche</option>
                        <option value="both">Les deux</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Taille (cm)</label>
                      <input type="number" min="100" max="250" {...register("height")} className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
                      {errors.height && <p className="mt-1 text-xs text-red-600">{errors.height.message}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Poids (kg)</label>
                      <input type="number" min="30" max="200" {...register("weight")} className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
                      {errors.weight && <p className="mt-1 text-xs text-red-600">{errors.weight.message}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Date de naissance</label>
                      <input type="date" {...register("dateOfBirth")} className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* Player-specific */}
              {isPlayerRole && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Poste</label>
                    <select {...register("position")} className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none">
                      <option value="">Non spécifié</option>
                      <option value="goalkeeper">Gardien</option>
                      <option value="defender">Défenseur</option>
                      <option value="midfielder">Milieu</option>
                      <option value="forward">Attaquant</option>
                      <option value="any">Polyvalent</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Niveau</label>
                    <select {...register("skillLevel")} className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none">
                      <option value="">Non spécifié</option>
                      <option value="beginner">Débutant</option>
                      <option value="amateur">Amateur</option>
                      <option value="intermediate">Intermédiaire</option>
                      <option value="advanced">Avancé</option>
                    </select>
                  </div>
                </>
              )}

              {/* Referee-specific */}
              {isRefereeRole && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">N° licence</label>
                    <input {...register("licenseNumber")} className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Niveau licence</label>
                    <select {...register("licenseLevel")} className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none">
                      <option value="">Non spécifié</option>
                      <option value="trainee">Stagiaire</option>
                      <option value="regional">Régional</option>
                      <option value="national">National</option>
                      <option value="international">International</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Années d&apos;expérience</label>
                    <input type="number" min="0" {...register("experienceYears")} className="w-full border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
                    {errors.experienceYears && <p className="mt-1 text-xs text-red-600">{errors.experienceYears.message}</p>}
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={handleCancel} className="flex items-center gap-1.5 border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <X size={14} /> Annuler
              </button>
              <button type="submit" disabled={saving} className="flex items-center gap-1.5 bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          </form>
        )}

        {/* ═══════════════ TAB: PALMARÈS ═══════════════ */}
        {tab === "palmares" && (
          <div className="space-y-6">
            {/* Add trophy form */}
            <div className=" border border-gray-200/70 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Trophy size={16} className="text-amber-500" /> Ajouter un trophée
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  value={trophyTitle}
                  onChange={(e) => setTrophyTitle(e.target.value)}
                  placeholder="Titre (ex: Champion régional)"
                  className=" border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                />
                <input
                  type="number"
                  value={trophyYear}
                  onChange={(e) => setTrophyYear(parseInt(e.target.value))}
                  min={1990}
                  max={new Date().getFullYear()}
                  className=" border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none"
                />
                <input
                  value={trophyDesc}
                  onChange={(e) => setTrophyDesc(e.target.value)}
                  placeholder="Description (optionnel)"
                  className=" border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none"
                />
              </div>
              <button
                onClick={handleAddTrophy}
                disabled={!trophyTitle.trim() || addingTrophy}
                className="mt-3 flex items-center gap-1.5 bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {addingTrophy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Ajouter
              </button>
            </div>

            {/* Trophies list */}
            {(user.trophies ?? []).length === 0 ? (
              <div className=" border border-gray-200/70 bg-white py-12 text-center">
                <Trophy size={32} className="mx-auto text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-500">Aucun trophée pour le moment</p>
                <p className="mt-1 text-xs text-gray-400">Ajoutez vos accomplissements sportifs ci-dessus</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {(user.trophies ?? []).map((trophy, i) => (
                  <div key={i} className="flex items-start gap-3 border border-gray-200/70 bg-white p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                      <Trophy size={20} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{trophy.title}</p>
                      <p className="text-xs text-gray-500">{trophy.year}</p>
                      {trophy.description && (
                        <p className="mt-1 text-xs text-gray-400">{trophy.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveTrophy(i)}
                      className="shrink-0 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ TAB: POSTS ═══════════════ */}
        {tab === "posts" && (
          <div className="space-y-4">
            {loadingPosts ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-emerald-500" />
              </div>
            ) : posts.length === 0 ? (
              <div className=" border border-gray-200/70 bg-white py-12 text-center">
                <FileText size={32} className="mx-auto text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-500">Aucun post publié</p>
                <Link href="/feed" className="mt-2 inline-block text-sm text-emerald-600 hover:underline">
                  Aller sur La Tribune →
                </Link>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className=" border border-gray-200/70 bg-white p-4">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{post.content}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                    <span>{timeAgo(post.createdAt)}</span>
                    <span>❤️ {post.likes.length}</span>
                    <span>💬 {post.commentCount}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══════════════ TAB: GALERIE ═══════════════ */}
        {tab === "galerie" && (
          <div className="space-y-6">
            {/* Upload button */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => galleryRef.current?.click()}
                disabled={uploadingGallery}
                className="flex items-center gap-2 bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {uploadingGallery ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Ajouter des photos
              </button>
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleGalleryUpload}
              />
              <span className="text-xs text-gray-400">{(user.galleryPhotos ?? []).length} photo(s)</span>
            </div>

            {/* Gallery grid */}
            {(user.galleryPhotos ?? []).length === 0 ? (
              <div className=" border border-gray-200/70 bg-white py-12 text-center">
                <ImageIcon size={32} className="mx-auto text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-500">Aucune photo dans la galerie</p>
                <p className="mt-1 text-xs text-gray-400">Ajoutez des photos pour enrichir votre profil public</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {(user.galleryPhotos ?? []).map((url, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden border border-gray-200/70 bg-gray-100">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => handleRemoveGalleryPhoto(url)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ TAB: CARTE FUT ═══════════════ */}
        {tab === "carte" && isPlayerRole && (
          <div className="flex flex-col items-center border border-gray-200/70 bg-gradient-to-br from-gray-50 to-emerald-50 p-8">
            <h3 className="mb-2 text-lg font-bold text-gray-900 font-display">Ma Carte KoppaFoot</h3>
            <p className="mb-6 text-sm text-gray-500">Télécharge ta carte style FUT avec tes infos</p>
            <KoppaFootCard profile={user} width={320} />
          </div>
        )}

        {/* ═══════════════ TAB: COMPTE ═══════════════
            TOUT CE QUI TOUCHE AU COMPTE, et non à la personne. L'e-mail de
            connexion, les méthodes de connexion, la déconnexion et la
            suppression se trouvaient dispersés sous les informations et en
            pied de page, où l'on tombait dessus en cherchant sa bio. */}
        {tab === "compte" && (
          <div className="space-y-4">
            <div className="border border-gray-200/70 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Identifiant</h3>
              <div className="divide-y divide-gray-200/70">
                <InfoRow icon={Mail} label="Email" value={user.email} />
                {memberSince && <InfoRow icon={Calendar} label="Membre depuis" value={memberSince} />}
              </div>
            </div>

            <LoginMethodsCard />

            <Link
              href="/parametres"
              className="flex items-center justify-between gap-3 border border-gray-200/70 bg-white p-4 transition-colors hover:border-gray-900"
            >
              <span className="flex items-center gap-3">
                <Settings size={16} className="text-gray-400" />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">Paramètres</span>
                  <span className="block text-xs text-gray-500">Thème, langue, notifications</span>
                </span>
              </span>
              <ChevronRight size={16} className="text-gray-300" />
            </Link>

            {/* Logout, the only sign-out entry point in the shell */}
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 border border-gray-200/70 bg-white px-5 py-3 text-sm font-bold text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={15} />
              Déconnexion
            </button>

            <SuppressionDeCompte />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Supprimer son compte.
//
// INTERFACE SEULE pour l'instant : le bouton final est inerte. Supprimer un
// compte n'est pas un `delete` sur un document, il faut décider du sort des
// publications, des inscriptions en cours, des réservations à venir et des
// buts déjà inscrits sur des feuilles de match. Tant que ces règles ne sont
// pas écrites, un bouton qui marche à moitié ferait plus de dégâts qu'un
// bouton qui n'existe pas.
//
// La confirmation par saisie du mot n'est pas une formalité : c'est le seul
// garde-fou contre le clic machinal, et il coûte une seconde à qui veut
// vraiment partir.
// ============================================

const MOT_DE_CONFIRMATION = "SUPPRIMER";

function SuppressionDeCompte() {
  const t = useT();
  const { firebaseUser, logout } = useAuth();
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [obstacles, setObstacles] = useState<string[] | null>(null);
  const [reconnexion, setReconnexion] = useState(false);

  const arme = saisie.trim().toUpperCase() === MOT_DE_CONFIRMATION;

  const supprimer = async () => {
    if (!arme || !firebaseUser) return;
    setEnvoi(true);
    setObstacles(null);
    setReconnexion(false);
    try {
      const token = await firebaseUser.getIdToken();
      const rep = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmation: saisie.trim().toUpperCase() }),
      });
      const data = await rep.json().catch(() => ({}));

      if (rep.status === 409 && Array.isArray(data.obstacles)) {
        setObstacles(data.obstacles);
        return;
      }
      if (rep.status === 401 && data.error === "reauth") {
        setReconnexion(true);
        return;
      }
      if (!rep.ok) {
        toast.error(data.error ?? t("suppr.echouee"));
        return;
      }

      // Le compte n'existe plus : la session locale non plus. On sort par
      // l'accueil, qui est public.
      toast.success(t("suppr.faite"));
      await logout();
      router.push("/");
    } catch (err) {
      console.error("Suppression du compte:", err);
      toast.error(t("suppr.echouee"));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="mt-12 border-t border-gray-200/70 pt-8">
      <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
        <AlertTriangle size={14} className="text-red-400" />
        {t("suppr.zone")}
      </h2>

      <div className="mt-3 border border-red-200 bg-red-50/50 p-5 sm:p-6">
        <p className="font-display text-base font-black uppercase tracking-tight text-gray-900">
          {t("suppr.titre")}
        </p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
          {t("suppr.texte")}
        </p>

        {!ouvert ? (
          <button
            type="button"
            onClick={() => setOuvert(true)}
            className="mt-5 flex items-center gap-2 border border-red-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] text-red-600 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white"
          >
            <Trash2 size={14} />
            {t("suppr.titre")}
          </button>
        ) : (
          <div className="mt-5 border border-red-200 bg-white p-4 sm:p-5">
            <label htmlFor="confirmation-suppression" className="block text-[11px] font-black uppercase tracking-[0.12em] text-gray-500">
              {t("suppr.tapez", { mot: MOT_DE_CONFIRMATION })}
            </label>
            <input
              id="confirmation-suppression"
              type="text"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              autoComplete="off"
              placeholder={MOT_DE_CONFIRMATION}
              className="mt-2 w-full max-w-xs border border-gray-200/70 bg-gray-50 px-4 py-3 text-sm font-bold uppercase tracking-[0.1em] text-gray-900 outline-none transition-colors placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-300 focus:border-red-500 focus:bg-white"
            />

            {obstacles && (
              /* Le compte tient quelque chose qui appartient a d'autres. On
                 dit quoi, et a qui le passer, plutot qu'un refus sec. */
              <div className="mt-4 border border-amber-200 bg-amber-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-amber-700">
                  {t("suppr.aFaire")}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {obstacles.map((o) => (
                    <li key={o} className="text-sm leading-relaxed text-amber-900">{o}</li>
                  ))}
                </ul>
              </div>
            )}

            {reconnexion && (
              <div className="mt-4 border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm leading-relaxed text-amber-900">
                  {t("suppr.reconnexion")}
                </p>
                <button
                  type="button"
                  onClick={async () => { await logout(); router.push("/"); }}
                  className="mt-3 border border-amber-300 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800 transition-colors hover:bg-amber-100"
                >
                  {t("compte.seDeconnecter")}
                </button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={supprimer}
                disabled={!arme || envoi}
                className="flex items-center gap-2 border border-red-600 bg-red-600 px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-red-700 hover:bg-red-700 disabled:cursor-not-allowed disabled:border-gray-200/70 disabled:bg-gray-100 disabled:text-gray-400"
              >
                {envoi ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {t("suppr.definitivement")}
              </button>
              <button
                type="button"
                onClick={() => { setOuvert(false); setSaisie(""); setObstacles(null); setReconnexion(false); }}
                className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-gray-900"
              >
                {t("suppr.annuler")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
