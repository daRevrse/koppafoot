"use client";

import Image from "next/image";
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel — hidden on mobile */}
      <div className="hidden md:flex md:w-1/2 lg:w-[45%]">
        <BrandingPanel />
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto bg-white px-4 py-12">
        {/* Mobile-only logo */}
        <div className="mb-8 md:hidden">
          <Image
            src="/branding/logo_full_name.png"
            alt="KOPPAFOOT"
            width={160}
            height={42}
            priority
          />
        </div>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
