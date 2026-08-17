"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROLE_REDIRECTS } from "@/types";

// ============================================
// AuthLayout — centered card on the light dashboard background,
// consistent with the app shell (no more split screen).
// ============================================

/**
 * Le papier peint de la connexion : l'artwork du splash PWA, répété.
 * Ouvrir l'app installée et ouvrir /login donnent alors la même image.
 *
 * Deux couches de fond : le motif dessous, un voile de la couleur de fond
 * par-dessus. C'est le seul moyen d'atténuer une image de fond en CSS —
 * `opacity` toucherait aussi la carte et le logo. Le voile est dosé pour que
 * le motif se devine sans concurrencer le formulaire.
 *
 * Réservé à /login : les autres écrans d'authentification restent unis.
 */
const SPLASH_WALLPAPER: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(rgba(244,246,250,0.78), rgba(244,246,250,0.78))," +
    " url('/branding/background.jfif')",
  backgroundRepeat: "no-repeat, repeat",
  backgroundSize: "auto, 700px auto",
  backgroundPosition: "center, center top",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect authenticated users to their space — or to a same-site ?next=
  // target (invitation links bounce through login and come back here).
  useEffect(() => {
    if (!loading && user) {
      const next = new URLSearchParams(window.location.search).get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.replace(safeNext ?? ROLE_REDIRECTS[user.userType] ?? "/");
    }
  }, [user, loading, router]);

  // Même fond pendant la vérification de session, sinon la connexion s'ouvre
  // sur un aplat puis bascule sur le motif une fois l'auth résolue.
  const wallpaper = pathname === "/login" ? SPLASH_WALLPAPER : undefined;

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#F4F6FA]"
        style={wallpaper}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div
      className="flex min-h-screen flex-col items-center bg-[#F4F6FA] px-4 py-10 sm:justify-center"
      style={wallpaper}
    >
      {/* Logo */}
      <Link href="/" className="mb-6">
        <Image
          src="/branding/logo_full_name.png"
          alt="KOPPAFOOT"
          width={160}
          height={42}
          style={{ height: "auto" }}
          priority
        />
      </Link>

      {/* Centered card */}
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8 shadow-sm lg:p-10">
        {children}
      </div>

      {/* Bottom link to home */}
      <Link
        href="/"
        className="mt-6 text-xs font-semibold text-gray-400 transition-colors hover:text-gray-600"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
