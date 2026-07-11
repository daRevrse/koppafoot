"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROLE_REDIRECTS } from "@/types";

// ============================================
// AuthLayout — centered card on the light dashboard background,
// consistent with the app shell (no more split screen).
// ============================================

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to their space
  useEffect(() => {
    if (!loading && user) {
      router.replace(ROLE_REDIRECTS[user.userType] ?? "/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#F4F6FA] px-4 py-10 sm:justify-center">
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
        ← Retour à l&apos;accueil
      </Link>
    </div>
  );
}
