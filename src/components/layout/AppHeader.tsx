"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Plus, LogOut } from "lucide-react";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { listPublicCompetitions } from "@/lib/competition-firestore";
import type { Competition } from "@/types";

// ============================================
// AppHeader — light top bar (ValueBet-style): search input + quick
// competition logos on the left, actions on the right. Privileges
// (notifications, avatar, logout) depend on auth state.
// ============================================

export default function AppHeader() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [competitions, setCompetitions] = useState<Competition[]>([]);

  useEffect(() => {
    listPublicCompetitions().then(setCompetitions).catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(term.trim() ? `/competitions?q=${encodeURIComponent(term.trim())}` : "/competitions");
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
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

      {/* Desktop: search + quick competition logos */}
      <div className="hidden min-w-0 flex-1 items-center gap-4 lg:flex">
        <form onSubmit={handleSearch} className="relative w-full max-w-xs">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Rechercher une compétition, une équipe…"
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-xs font-semibold text-gray-700 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-colors"
          />
        </form>
        <div className="flex items-center gap-1.5">
          {competitions.slice(0, 4).map((c) => (
            <Link
              key={c.id}
              href={`/?c=${c.slug}`}
              title={c.name}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-gray-100 bg-white transition-transform hover:scale-110"
            >
              {c.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logoUrl} alt={c.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] font-black text-emerald-600">
                  {c.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Right side — privileges depend on auth state */}
      {user ? (
        <div className="flex shrink-0 items-center gap-2 lg:gap-3">
          <NotificationDropdown />
          <Link
            href="/organizer"
            className="hidden items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition-colors hover:bg-emerald-600 sm:flex"
          >
            <Plus size={14} />
            Organiser
          </Link>
          <Link
            href="/profile"
            className="hidden h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-xs font-black text-emerald-600 ring-1 ring-gray-100 transition-shadow hover:ring-emerald-300 lg:flex"
          >
            {user.profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.profilePictureUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
            )}
          </Link>
          <button
            onClick={handleLogout}
            title="Déconnexion"
            className="hidden text-gray-300 transition-colors hover:text-gray-500 lg:block"
          >
            <LogOut size={16} />
          </button>
        </div>
      ) : loading ? (
        <div className="h-8 w-40" />
      ) : (
        <div className="flex shrink-0 items-center gap-2">
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
        </div>
      )}
    </header>
  );
}
