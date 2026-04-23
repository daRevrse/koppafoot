"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ROLE_REDIRECTS } from "@/types";
import AppSidebar from "@/components/layout/AppSidebar";
import AppHeader from "@/components/layout/AppHeader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

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

    // 3. Role-based redirect (if in wrong layout group)
    // AppLayout handles: player, manager, referee
    const isVenueOwner = user.userType === "venue_owner";
    const isSuperadmin = user.userType === "superadmin";

    if (isVenueOwner && !pathname.startsWith("/venue-owner")) {
      router.replace(ROLE_REDIRECTS.venue_owner);
      return;
    }
    if (isSuperadmin && !pathname.startsWith("/admin")) {
      router.replace(ROLE_REDIRECTS.superadmin);
      return;
    }
  }, [user, firebaseUser, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  // Don't render until user is valid for this layout
  if (!user || user.userType === "venue_owner" || user.userType === "superadmin") return null;

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 bg-[var(--color-bg-secondary)] p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
