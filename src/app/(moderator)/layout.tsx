"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { listModeratedCompetitions } from "@/lib/competition-firestore";

// "Live ops" shell for moderators. Access is CONTROLLED: besides
// authentication, the user must moderate at least one competition (or be
// a superadmin) — everyone else is sent home. Per-competition membership
// stays enforced on the pages + by Firestore rules.
export default function ModeratorLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading, logout } = useAuth();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) { router.replace("/login"); return; }
    if (!user) { router.replace("/get-started"); return; }

    if (user.userType === "superadmin") {
      setAllowed(true);
      return;
    }
    let cancelled = false;
    listModeratedCompetitions(user.uid)
      .then((comps) => {
        if (cancelled) return;
        if (comps.length > 0) {
          setAllowed(true);
        } else {
          toast.error("Accès réservé aux modérateurs de compétition.");
          router.replace("/");
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/");
      });
    return () => { cancelled = true; };
  }, [user, firebaseUser, loading, router]);

  if (loading || !firebaseUser || !user || allowed !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

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
