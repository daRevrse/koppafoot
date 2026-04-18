"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROLE_REDIRECTS } from "@/types";
import BrandingPanel from "@/components/auth/BrandingPanel";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    if (!loading && user) {
      router.replace(ROLE_REDIRECTS[user.userType] ?? "/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1A1715]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="flex h-screen bg-[#1A1715]">
      {/* Left branding panel — fixed, no scroll */}
      <div className="hidden md:block md:w-1/2 lg:w-[45%] h-screen overflow-hidden">
        <BrandingPanel />
      </div>

      {/* Right form panel — scrollable */}
      <div className="relative flex flex-1 flex-col items-center overflow-y-auto px-6 py-12">
        {/* Subtle radial glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(5,150,105,0.06)_0%,transparent_70%)]" />

        {/* Mobile-only header */}
        <div className="relative z-10 mb-10 flex flex-col items-center md:hidden">
          <Link href="/" className="relative h-10 w-40">
            <Image
              src="/branding/logo_full_name.png"
              alt="KOPPAFOOT"
              fill
              className="object-contain"
              sizes="160px"
              priority
            />
          </Link>
          <p className="mt-3 text-xs text-white/30">
            Le foot amateur, en mieux.
          </p>
        </div>

        {/* Form container */}
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-8 lg:p-10">
          {children}
        </div>

        {/* Bottom link to home */}
        <Link
          href="/"
          className="relative z-10 mt-6 text-xs text-white/20 hover:text-white/40 transition-colors"
        >
          ← Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
