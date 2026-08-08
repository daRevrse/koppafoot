"use client";

import AppSidebar from "@/components/layout/AppSidebar";
import AppHeader from "@/components/layout/AppHeader";
import TribuneSidebar from "@/components/layout/TribuneSidebar";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import PullToRefresh from "@/components/layout/PullToRefresh";
import PushNotificationSetup from "@/components/PushNotificationSetup";

// ============================================
// AppShell — the one chrome of the product: sidebar, header, Tribune rail
// and mobile tab bar.
//
// It is shared by the public app, the organizer space and the live-ops list
// so those stop looking like separate products: before this, /organizer and
// /live-ops each rendered their own header and no sidebar, and entering one
// meant losing all navigation.
//
// `showTribune={false}` drops the right rail for management screens, which
// need the horizontal room for tables and brackets.
// ============================================

export default function AppShell({
  children,
  showTribune = true,
}: {
  children: React.ReactNode;
  showTribune?: boolean;
}) {
  return (
    <div className="flex min-h-screen">
      <PushNotificationSetup />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="main-content-app min-w-0 flex-1 overflow-x-hidden bg-[#F4F6FA] p-4 lg:p-6">
          <PullToRefresh>{children}</PullToRefresh>
        </main>
      </div>
      {showTribune && <TribuneSidebar />}
      <MobileBottomNav />
    </div>
  );
}
