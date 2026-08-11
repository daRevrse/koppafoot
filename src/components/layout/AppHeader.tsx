"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Globe } from "lucide-react";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState("");
  const onTribune = pathname.startsWith("/feed");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(term.trim() ? `/competitions?q=${encodeURIComponent(term.trim())}` : "/competitions");
  };

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

      {/* Desktop: search */}
      <div className="hidden min-w-0 flex-1 items-center lg:flex">
        <form onSubmit={handleSearch} className="relative w-full max-w-xs">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Rechercher une compétition, une équipe…"
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-xs font-semibold text-gray-700 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-colors"
          />
        </form>
      </div>

      {/* Right side — privileges depend on auth state */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-3">
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

        {user ? (
          <NotificationDropdown />
        ) : loading ? (
          <div className="h-8 w-28 lg:w-40" />
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-full px-3 py-2 text-xs font-bold text-gray-500 transition-colors hover:text-gray-900 lg:px-4 lg:text-sm"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-600 lg:px-5 lg:text-sm"
            >
              Rejoindre
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
