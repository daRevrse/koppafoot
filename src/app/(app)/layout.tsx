"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ROLE_REDIRECTS } from "@/types";
import AppSidebar from "@/components/layout/AppSidebar";
import AppHeader from "@/components/layout/AppHeader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Not authenticated → login
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }

    // Authenticated but no Firestore profile → complete onboarding
    if (!user) {
      router.replace("/get-started");
      return;
    }

    // Venue owners and superadmins have their own layouts
    if (user.userType === "venue_owner") {
      router.replace(ROLE_REDIRECTS.venue_owner);
      return;
    }
    if (user.userType === "superadmin") {
      router.replace(ROLE_REDIRECTS.superadmin);
      return;
    }
  }, [user, firebaseUser, loading, router]);

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
