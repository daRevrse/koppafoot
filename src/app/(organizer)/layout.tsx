"use client";

import { gereLaCompetition, isOrganizer } from "@/lib/hats";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getCompetition } from "@/lib/competition-firestore";
import { Loader2 } from "lucide-react";
import { ROLE_REDIRECTS, type Competition } from "@/types";
import ScoreShell from "@/components/layout/v2/ScoreShell";
import AuthRequired from "@/components/auth/AuthRequired";

// Organizer space. It renders inside the SHARED app shell, it used to have
// its own sidebar and header, which made entering it feel like leaving the
// product. Only the live match console breaks out: covering a match wants
// the full screen, not a navigation rail.
function isLiveConsole(pathname: string): boolean {
  return pathname.endsWith("/live");
}

/**
 * La compétition dont parle l'adresse, `/organizer/competitions/{cid}/…`, ou
 * `null` ailleurs dans l'espace (l'accueil, la création).
 */
function competitionDuChemin(pathname: string): string | null {
  const m = /^\/organizer\/competitions\/([^/]+)/.exec(pathname);
  return m && m[1] !== "new" ? m[1] : null;
}

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // DEUX PORTES. L'accueil et la création demandent la casquette
  // d'organisateur. Les écrans d'UNE compétition demandent d'en faire partie
  // — organisateur, modérateur, ou l'administration (voir lib/hats) — avec
  // ou sans casquette : un modérateur configure la compétition qu'on lui a
  // confiée, sans avoir à candidater comme organisateur.
  //
  // La garde de la compétition vit ici, une fois, plutôt que dans chaque
  // page : la moitié d'entre elles n'en avaient pas, et s'ouvraient à tout
  // organisateur, ses écritures refusées une à une par les règles.
  const cid = competitionDuChemin(pathname);
  const [lue, setLue] = useState<{ cid: string; competition: Competition | null } | null>(null);
  const competition = lue && lue.cid === cid ? lue.competition : undefined;

  useEffect(() => {
    if (!cid || !firebaseUser) return;
    let annule = false;
    getCompetition(cid)
      .then((c) => { if (!annule) setLue({ cid, competition: c }); })
      .catch(() => { if (!annule) setLue({ cid, competition: null }); });
    return () => { annule = true; };
  }, [cid, firebaseUser]);

  // Superadmins run the organizer screens too, the sidebar offers them the
  // entry, so the guard has to agree or the link dead-ends.
  const allowed = cid ? gereLaCompetition(user, competition) : isOrganizer(user);
  const decide = !cid || competition !== undefined;

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) return;   // asked in place, see AuthRequired
    if (!user) { router.replace("/get-started"); return; }
    if (!decide) return;
    if (!allowed) {
      router.replace(isOrganizer(user) ? "/organizer" : ROLE_REDIRECTS[user.userType] ?? "/");
    }
  }, [user, firebaseUser, loading, allowed, decide, router]);

  if (loading || (firebaseUser && user && !decide)) {
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
