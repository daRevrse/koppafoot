"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import AppSidebar from "@/components/layout/AppSidebar";
import AppHeader from "@/components/layout/AppHeader";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import PushNotificationSetup from "@/components/PushNotificationSetup";

// Routes in this group that render for guests. Everything else requires
// an authenticated profile. The shell (sidebar/header/bottom nav) renders
// for everyone — auth only changes which privileges it shows.
const PUBLIC_PATHS = ["/"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (loading || isPublic) return;

    // 1. Not authenticated -> go to login
    if (!firebaseUser) {
      if (pathname !== "/login") {
        router.replace("/login");
      }
      return;
    }

    // 2. Authenticated but no Firestore profile -> go to onboarding
    if (!user) {
      if (pathname !== "/get-started") {
        router.replace("/get-started");
      }
      return;
    }
  }, [user, firebaseUser, loading, router, pathname, isPublic]);

  // Protected routes gate on auth; the public home renders immediately
  // (its content is server-rendered — blanking it while auth resolves
  // would flash the page away).
  if (!isPublic) {
    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary-600" />
        </div>
      );
    }
    if (!user) return null;
  }

  return (
    <div className="flex min-h-screen">
      <PushNotificationSetup />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="main-content-app min-w-0 flex-1 overflow-x-hidden bg-[#F4F6FA] p-4 lg:p-6">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
