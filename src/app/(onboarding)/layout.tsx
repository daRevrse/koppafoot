"use client";

import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROLE_REDIRECTS } from "@/types";

// Onboarding shell. Deliberately mirrors (auth)/layout — /get-started is the
// tail of the sign-up funnel, so arriving here must not feel like landing on
// a different site.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Not authenticated at all → go to login
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    // Profile already exists → go to dashboard
    if (user) {
      router.replace(ROLE_REDIRECTS[user.userType] ?? "/");
    }
  }, [user, firebaseUser, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  // Don't render if no firebaseUser or if profile already exists
  if (!firebaseUser || user) return null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#F4F6FA] px-4 py-10 sm:justify-center">
      <div className="mb-6">
        <Image
          src="/branding/logo_full_name.png"
          alt="KOPPAFOOT"
          width={160}
          height={42}
          style={{ height: "auto" }}
          priority
        />
      </div>
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8 shadow-sm lg:p-10">
        {children}
      </div>
    </div>
  );
}
