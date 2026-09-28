"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Menu } from "lucide-react";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import { ROLE_REDIRECTS } from "@/types";
import AdminSidebar, { titreDeLaPage } from "@/components/layout/AdminSidebar";
import { ATraiterProvider } from "@/components/admin/ATraiterContext";
import { PlayerAvatar } from "@/components/ui/EntityAvatar";
import { isSuperAdmin } from "@/lib/hats";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOuvert, setMenuOuvert] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) { router.replace("/login"); return; }
    if (!user) { router.replace("/get-started"); return; }
    if (!isSuperAdmin(user)) {
      router.replace(ROLE_REDIRECTS[user.userType] ?? "/");
    }
  }, [user, firebaseUser, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!user || !isSuperAdmin(user)) return null;

  return (
    <ATraiterProvider>
      <div className="flex min-h-screen bg-gray-50">
        <AdminSidebar ouvert={menuOuvert} onFermer={() => setMenuOuvert(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="pt-safe sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-gray-200/70 bg-white px-4 sm:px-6">
            {/* Le bouton du menu vit DANS l'en-tête : posé en position fixe par
                -dessus, il recouvrait le titre de la page sur téléphone. */}
            <button
              onClick={() => setMenuOuvert(true)}
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center text-gray-700 hover:bg-gray-100 lg:hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu size={20} />
            </button>
            <p className="min-w-0 flex-1 truncate text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
              {titreDeLaPage(pathname)}
            </p>
            <NotificationDropdown />
            <Link href="/admin/profile" className="flex items-center gap-2 text-sm font-bold text-gray-700" aria-label="Mon profil">
              <PlayerAvatar name={`${user.firstName} ${user.lastName}`} photo={user.profilePictureUrl} size={30} />
              <span className="hidden sm:inline">{user.firstName}</span>
            </Link>
          </header>
          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
        </div>
      </div>
    </ATraiterProvider>
  );
}
