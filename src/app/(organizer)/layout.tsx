"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ROLE_REDIRECTS } from "@/types";
import ScoreShell from "@/components/layout/v2/ScoreShell";
import AuthRequired from "@/components/auth/AuthRequired";

// Organizer space. It renders inside the SHARED app shell — it used to have
// its own sidebar and header, which made entering it feel like leaving the
// product. Only the live match console breaks out: covering a match wants
// the full screen, not a navigation rail.
function isLiveConsole(pathname: string): boolean {
  return pathname.endsWith("/live");
}

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Superadmins run the organizer screens too — the sidebar offers them the
  // entry, so the guard has to agree or the link dead-ends.
  const allowed = user?.userType === "organizer" || user?.userType === "superadmin";

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) return;   // asked in place, see AuthRequired
    if (!user) { router.replace("/get-started"); return; }
    if (!allowed) {
      router.replace(ROLE_REDIRECTS[user.userType] ?? "/");
    }
  }, [user, firebaseUser, loading, allowed, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <ScoreShell showTribune={false}>
        <AuthRequired message="L'espace organisateur demande un compte KoppaFoot." />
      </ScoreShell>
    );
  }

  if (!user || !allowed) return null;

  if (isLiveConsole(pathname)) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return <ScoreShell showTribune={false}>{children}</ScoreShell>;
}
