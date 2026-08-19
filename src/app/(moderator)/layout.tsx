"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { listModeratedCompetitions } from "@/lib/competition-firestore";
import ScoreShell from "@/components/layout/v2/ScoreShell";
import AuthRequired from "@/components/auth/AuthRequired";

// "Live ops" space for moderators. Access is CONTROLLED: besides
// authentication, the user must moderate at least one competition (or be
// a superadmin) — everyone else is sent home. Per-competition membership
// stays enforced on the pages + by Firestore rules.
//
// The list screens render inside the SHARED app shell (they used to have
// their own header and no sidebar, which felt like a separate product).
// The match console keeps the full screen: covering a live match is a
// focused task, and the sidebar would only steal room and attention.
function isLiveConsole(pathname: string): boolean {
  return pathname.endsWith("/live");
}

export default function ModeratorLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [moderatesOk, setModeratesOk] = useState(false);
  const [checked, setChecked] = useState(false);

  // Superadmin access is a property of the profile, not a lookup — derive it
  // rather than writing it into state from inside the effect.
  const isSuperadmin = user?.userType === "superadmin";
  const allowed = isSuperadmin || moderatesOk;
  const ready = isSuperadmin || checked;

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) return;   // asked in place, see AuthRequired
    if (!user) { router.replace("/get-started"); return; }
    if (user.userType === "superadmin") return;

    let cancelled = false;
    listModeratedCompetitions(user.uid)
      .then((comps) => {
        if (cancelled) return;
        setModeratesOk(comps.length > 0);
        setChecked(true);
        if (comps.length === 0) {
          toast.error("Accès réservé aux modérateurs de compétition.");
          router.replace("/");
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/");
      });
    return () => { cancelled = true; };
  }, [user, firebaseUser, loading, router]);

  // Guest: keep the address, ask for the account over the top of it.
  if (!loading && !firebaseUser) {
    return (
      <ScoreShell showTribune={false}>
        <AuthRequired message="L'espace live demande un compte KoppaFoot." />
      </ScoreShell>
    );
  }

  if (loading || !user || !ready || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if (isLiveConsole(pathname)) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return <ScoreShell showTribune={false}>{children}</ScoreShell>;
}
