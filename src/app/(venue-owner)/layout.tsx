"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ROLE_REDIRECTS } from "@/types";
import VenueOwnerSidebar from "@/components/layout/VenueOwnerSidebar";

export default function VenueOwnerLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) { router.replace("/login"); return; }
    if (!user) { router.replace("/get-started"); return; }
    if (user.userType !== "venue_owner") {
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

  if (!user || user.userType !== "venue_owner") return null;

  return (
    <div className="flex min-h-screen">
      <VenueOwnerSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
          <h2 className="text-lg font-semibold text-gray-900">Espace Pro</h2>
        </header>
        <main className="flex-1 bg-[var(--color-bg-secondary)] p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
