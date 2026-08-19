"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, Star } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { setCompetitionFollow } from "@/lib/competition-firestore";

// ============================================
// FollowCompetitionButton — follow/unfollow a competition. Followers
// receive push notifications (kickoff, goals, final score). Guests are
// sent to signup — this is the conversion sur-valeur.
//
// Trois habillages :
//  - "pill" : la pastille avec son libellé, pour une page compétition.
//  - "icon" : la cloche seule, posée sur la vignette du répertoire. Elle vit
//    à l'intérieur d'une carte cliquable, d'où le stopPropagation.
//  - "star" : l'étoile nue de l'en-tête de compétition sur le Direct, où la
//    cloche rentrerait en concurrence visuelle avec le badge "en direct".
//    C'est le même suivi : l'onglet Favoris du Direct lit la même liste.
// ============================================

export default function FollowCompetitionButton({
  cid,
  variant = "pill",
}: {
  cid: string;
  variant?: "pill" | "icon" | "star";
}) {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const isFollowing = following ?? user?.followedCompetitionIds?.includes(cid) ?? false;

  const toggle = async (e: React.MouseEvent) => {
    // La carte du répertoire est un lien : sans ça, suivre navigue.
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast("Crée un compte pour recevoir les buts en direct.", { icon: "🔔" });
      router.push("/signup");
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !isFollowing;
    setFollowing(next); // optimistic
    try {
      await setCompetitionFollow(user.uid, cid, next);
      // Le profil en contexte est lu une fois à la connexion : sans ce
      // rafraîchissement, l'étoile du sidebar et les autres cartes gardent
      // l'ancienne liste jusqu'au prochain chargement.
      await refreshUser();
      toast.success(next ? "Compétition suivie — tu recevras les buts en direct." : "Compétition retirée.");
    } catch {
      setFollowing(!next);
      toast.error("Impossible de mettre à jour. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const Icon = isFollowing ? BellRing : Bell;

  if (variant === "star") {
    return (
      <button
        onClick={toggle}
        disabled={busy}
        aria-label={isFollowing ? "Ne plus suivre cette compétition" : "Suivre cette compétition"}
        aria-pressed={isFollowing}
        title={isFollowing ? "Suivie" : "Suivre"}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
          isFollowing
            ? "text-amber-400 hover:bg-amber-50"
            : "text-gray-300 hover:bg-gray-100 hover:text-amber-400"
        }`}
      >
        <Star size={17} fill={isFollowing ? "currentColor" : "none"} />
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <button
        onClick={toggle}
        disabled={busy}
        aria-label={isFollowing ? "Ne plus suivre cette compétition" : "Suivre cette compétition"}
        title={isFollowing ? "Suivie" : "Suivre"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm backdrop-blur transition-colors disabled:opacity-60 ${
          isFollowing
            ? "bg-emerald-500 text-white hover:bg-emerald-600"
            : "bg-white/90 text-gray-500 hover:bg-white hover:text-emerald-600"
        }`}
      >
        <Icon size={15} />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-black transition-colors disabled:opacity-60 ${
        isFollowing
          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "bg-emerald-500 text-white hover:bg-emerald-600"
      }`}
    >
      <Icon size={13} />
      {isFollowing ? "Suivi" : "Suivre"}
    </button>
  );
}
