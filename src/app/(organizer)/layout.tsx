"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ROLE_REDIRECTS } from "@/types";
import OrganizerSidebar from "@/components/layout/OrganizerSidebar";
import MobileBottomNav from "@/components/layout/MobileBottomNav";

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) { router.replace("/login"); return; }
    if (!user) { router.replace("/get-started"); return; }
    if (user.userType !== "organizer") {
      router.replace(ROLE_REDIRECTS[user.userType] ?? "/dashboard");
    }
  }, [user, firebaseUser, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if (!user || user.userType !== "organizer") return null;

  return (
    <div className="flex min-h-screen">
      <OrganizerSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
          <h2 className="text-lg font-semibold text-gray-900">Espace Organisateur</h2>
        </header>
        <main className="main-content-app flex-1 bg-[var(--color-bg-secondary)] p-4 lg:p-8">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
