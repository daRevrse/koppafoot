"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Globe, Search } from "lucide-react";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import HeaderSearch from "./HeaderSearch";
import MobileSearchOverlay from "./MobileSearchOverlay";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// AppHeader — light top bar: search on the left, actions on the right
// (Tribune globe on mobile, notifications for authed users, join/login for
// guests). Profile, competitions and logout live in the sidebar and the
// profile page; the "Organiser ma compétition" CTA lives on /competitions —
// the header stays minimal.
// ============================================

export default function AppHeader() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const onTribune = pathname.startsWith("/feed");
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 lg:min-h-16 lg:px-6 pt-safe">
      {/* Mobile: compact logo */}
      <Link href="/" className="flex items-center gap-2 lg:hidden">
        <Image
          src="/branding/logo_symbol.png"
          alt="KoppaFoot"
          width={24}
          height={24}
          priority
        />
        <span className="font-display text-sm font-black tracking-wide text-gray-900">
          KOPPAFOOT
        </span>
      </Link>

      {/* Desktop: search. Teams resolve in its own dropdown, competitions are
          handed to /competitions?q= — see HeaderSearch. */}
      <div className="hidden min-w-0 flex-1 items-center lg:flex">
        <HeaderSearch />
      </div>

      {/* Right side — privileges depend on auth state */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-3">
        {/* Search — mobile only, since the bar above is lg:. Without it a phone
            has no way to search anything at all. */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Rechercher"
          title="Rechercher"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 lg:hidden"
        >
          <Search size={20} />
        </button>

        {/* La Tribune — mobile only. It left the bottom tab bar for this spot
            next to the bell; on desktop it stays in the sidebar and the rail. */}
        <Link
          href="/feed"
          aria-label="La Tribune"
          title="La Tribune"
          aria-current={onTribune ? "page" : undefined}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors lg:hidden ${
            onTribune
              ? "bg-emerald-50 text-emerald-600"
              : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          }`}
        >
          <Globe size={20} />
        </Link>

        {/* Guest CTAs are desktop-only: the mobile header is already carrying
            the search, the Tribune and the logo, and the bottom nav has its own
            "Connexion" tab for visitors. */}
        {user ? (
          <NotificationDropdown />
        ) : loading ? (
          <div className="hidden lg:block lg:h-8 lg:w-40" />
        ) : (
          <>
            <Link
              href="/login"
              className="hidden rounded-full px-3 py-2 text-xs font-bold text-gray-500 transition-colors hover:text-gray-900 lg:inline-flex lg:px-4 lg:text-sm"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="hidden rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-600 lg:inline-flex lg:px-5 lg:text-sm"
            >
              Rejoindre
            </Link>
          </>
        )}
      </div>

      {searchOpen && <MobileSearchOverlay onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
