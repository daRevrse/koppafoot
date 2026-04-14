"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROLE_REDIRECTS } from "@/types";

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
      router.replace(ROLE_REDIRECTS[user.userType] ?? "/dashboard");
    }
  }, [user, firebaseUser, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  // Don't render if no firebaseUser or if profile already exists
  if (!firebaseUser || user) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg-secondary)] px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-primary-600">KOPPAFOOT</h1>
        <p className="mt-1 text-sm text-gray-500">Complétez votre profil pour continuer</p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
