"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import ScoreShell from "@/components/layout/v2/ScoreShell";
import AuthRequired from "@/components/auth/AuthRequired";

// Routes in this group that render for guests. Everything else requires
// an authenticated profile. The shell (sidebar/header/bottom nav) renders
// for everyone — auth only changes which privileges it shows.
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/competitions") ||
    pathname === "/actus" ||
    // The market shows its confirmed moves to anybody; the tools inside it
    // still ask for an account (see MercatoPublic).
    pathname === "/mercato" ||
    pathname.startsWith("/c/") ||
    // Les fiches publiques d'une entite : un joueur, une equipe. Ce sont des
    // pages qu'on partage — un lien vers un joueur qui demande un compte pour
    // etre lu ne se partage pas. Rien de prive n'y figure : ce que la fiche
    // montre est deja lisible sans compte dans les regles Firestore, et les
    // actions (suivre, ajouter au mercato) ouvrent la modale d'elles-memes.
    /^\/profile\/[^/]+$/.test(pathname) ||
    /^\/teams\/[^/]+$/.test(pathname) ||
    // Invitation links arrive by email — guests must see them to sign in/up.
    pathname.startsWith("/invitations/") ||
    // Staff access codes arrive by WhatsApp: the volunteer must reach the
    // screen to be told what to do, rather than be bounced to a bare login.
    pathname.startsWith("/staff/rejoindre")
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = isPublicPath(pathname);

  // Signing in no longer costs a navigation: a guest on a protected page is
  // shown the sign-in dialog in place (see AuthRequired below). Onboarding
  // keeps its redirect — a Firebase account with no Firestore profile has a
  // form to fill, and that does not fit in a dialog.
  useEffect(() => {
    if (loading || isPublic) return;
    if (!firebaseUser) return;
    if (!user && pathname !== "/get-started") {
      router.replace("/get-started");
    }
  }, [user, firebaseUser, loading, router, pathname, isPublic]);

  // Protected routes gate on auth; the public home renders immediately
  // (its content is server-rendered — blanking it while auth resolves
  // would flash the page away).
  if (!isPublic) {
    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary-600" />
        </div>
      );
    }
    // Guest: keep the address, ask for the account over the top of it.
    if (!firebaseUser) {
      return (
        <ScoreShell>
          <AuthRequired />
        </ScoreShell>
      );
    }
    // Authenticated without a profile: the effect above is sending them to
    // onboarding, so render nothing for the one frame it takes.
    if (!user) return null;
  }

  return <ScoreShell>{children}</ScoreShell>;
}
