"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import { ROLE_REDIRECTS } from "@/types";
import AdminSidebar from "@/components/layout/AdminSidebar";

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Centre de contrôle",
  "/admin/users": "Utilisateurs",
  "/admin/teams": "Équipes",
  "/admin/matches": "Matchs",
  "/admin/venues": "Terrains",
  "/admin/referees": "Arbitres",
  "/admin/reports": "Signalements",
  "/admin/bans": "Bannissements",
  "/admin/logs": "Logs système",
  "/admin/stats": "Statistiques",
  "/admin/settings": "Paramètres",
  "/admin/messages": "Messages",
  "/admin/campaigns": "Campagnes",
  "/admin/profile": "Mon profil",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) { router.replace("/login"); return; }
    if (!user) { router.replace("/get-started"); return; }
    if (user.userType !== "superadmin") {
      router.replace(ROLE_REDIRECTS[user.userType] ?? "/dashboard");
    }
  }, [user, firebaseUser, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user || user.userType !== "superadmin") return null;

  const pageTitle = PAGE_TITLES[pathname] ?? "Administration";

  return (
    <div className="flex min-h-screen bg-[#F8F9FB]">
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        {/* Premium header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200/60 bg-white/80 backdrop-blur-xl px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-bold text-gray-900 font-display">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-3">
            <NotificationDropdown />
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-[10px] font-bold text-white uppercase">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user.firstName}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
