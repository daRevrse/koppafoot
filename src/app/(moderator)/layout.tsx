"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Minimal "live ops" shell for moderators. Gated on AUTHENTICATION ONLY — any
// userType is allowed (moderators keep their normal role; per-competition
// membership is enforced on the pages + by Firestore rules). No sidebar.
export default function ModeratorLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) { router.replace("/login"); return; }
    if (!user) { router.replace("/get-started"); return; }
  }, [user, firebaseUser, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if (!firebaseUser || !user) return null;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-100 bg-white/90 px-4 backdrop-blur-xl">
        <Link href="/live-ops" className="flex items-center gap-2">
          <Image src="/branding/logo_symbol.png" alt="Koppafoot" width={28} height={28} className="h-7 w-7" />
          <span className="font-display text-base font-black tracking-tight text-gray-900">Live ops</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <LogOut size={16} /> Déconnexion
        </button>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
