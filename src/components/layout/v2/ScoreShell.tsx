"use client";

import ScoreHeader from "./ScoreHeader";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import PullToRefresh from "@/components/layout/PullToRefresh";
import PushNotificationSetup from "@/components/PushNotificationSetup";

// ============================================
// ScoreShell — the chrome of the product, everywhere.
//
// One band, and that is the whole point: where the old shell spent a column
// on the left, this spends a single row on top. The trending ticker and the
// role sub-nav that briefly sat above and below it are gone — three stacked
// bands ate the fold on a phone for navigation nobody used twice. What they
// carried now lives in the nav row and the account menu (see ScoreHeader).
//
// It wraps every group — public app, organizer and moderator — so entering
// one does not change the furniture.
//
// Kept from that shell: the mobile tab bar (the habit already learned on a
// phone), pull-to-refresh and the push prompt.
//
// The Tribune rail is gone, but its column is not: `rightGutter` holds the
// same 320px open on the right. Letting the content spread into it would
// have re-flowed every page in the product to chase a rail we removed, and
// a reading column that wide is worse, not better. The Tribune page mirrors
// this gutter on its left so it sits centred rather than shoved aside.
//
// `showTribune={false}` closes the gutter for management screens, which
// need the horizontal room for tables and brackets.
// ============================================

export default function ScoreShell({
  children,
  showTribune = true,
}: {
  children: React.ReactNode;
  showTribune?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <PushNotificationSetup />
      <ScoreHeader />

      <div className="flex min-w-0 flex-1">
        <main className="main-content-app min-w-0 flex-1 overflow-x-hidden bg-[#F4F6FA] p-3 lg:p-5">
          <PullToRefresh>{children}</PullToRefresh>
        </main>
        {showTribune && <div className="hidden w-80 flex-shrink-0 xl:block" aria-hidden />}
      </div>

      <MobileBottomNav />
    </div>
  );
}
