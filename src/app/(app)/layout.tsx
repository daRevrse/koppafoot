"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import AppShell from "@/components/layout/AppShell";

// Routes in this group that render for guests. Everything else requires
// an authenticated profile. The shell (sidebar/header/bottom nav) renders
// for everyone — auth only changes which privileges it shows.
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/competitions") ||
    pathname.startsWith("/c/") ||
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

  useEffect(() => {
    if (loading || isPublic) return;

    // 1. Not authenticated -> go to login
    if (!firebaseUser) {
      if (pathname !== "/login") {
        router.replace("/login");
      }
      return;
    }

    // 2. Authenticated but no Firestore profile -> go to onboarding
    if (!user) {
      if (pathname !== "/get-started") {
        router.replace("/get-started");
      }
      return;
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
    if (!user) return null;
  }

  return <AppShell>{children}</AppShell>;
}
