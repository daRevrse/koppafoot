"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { setCompetitionFollow } from "@/lib/competition-firestore";

// ============================================
// FollowCompetitionButton — follow/unfollow a competition. Followers
// receive push notifications (kickoff, goals, final score). Guests are
// sent to signup — this is the conversion sur-valeur.
// ============================================

export default function FollowCompetitionButton({ cid }: { cid: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const isFollowing = following ?? user?.followedCompetitionIds?.includes(cid) ?? false;

  const toggle = async () => {
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
      toast.success(next ? "Compétition suivie — tu recevras les buts en direct." : "Compétition retirée.");
    } catch {
      setFollowing(!next);
      toast.error("Impossible de mettre à jour. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

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
      {isFollowing ? <BellRing size={13} /> : <Bell size={13} />}
      {isFollowing ? "Suivi" : "Suivre"}
    </button>
  );
}
