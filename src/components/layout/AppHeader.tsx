"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, LogOut, User, Radio, ClipboardList, Shield } from "lucide-react";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_BADGE_COLORS } from "@/config/navigation";
import { ROLE_LABELS } from "@/types";
import StreakBadge from "@/components/ui/StreakBadge";

export default function AppHeader() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="relative flex min-h-14 lg:min-h-16 items-center justify-between border-b-2 border-primary-600 bg-white px-4 lg:px-6 pt-safe">
      {/* Mobile: Logo compact — Desktop: spacer */}
      <div className="flex items-center gap-2 lg:hidden">
        <Image
          src="/branding/logo_symbol.png"
          alt="KoppaFoot"
          width={24}
          height={24}
          priority
        />
        <span className="text-sm font-bold tracking-wide text-emerald-950 font-display">
          KOPPAFOOT
        </span>
      </div>
      <div className="hidden lg:block" />

      {/* Right side — privileges depend on auth state */}
      {user ? (
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Streak badge */}
          <StreakBadge count={3} />

          {/* Notifications */}
          <NotificationDropdown />

          <div ref={dropdownRef} className="relative hidden lg:block">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                {user.profilePictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profilePictureUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                )}
              </div>
              <span className="hidden text-sm font-medium text-gray-700 md:block">
                {user.firstName}
              </span>
              <ChevronDown size={14} className="hidden text-gray-400 md:block" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                {/* User info */}
                <div className="mb-2 rounded-lg bg-gray-50 px-3 py-3">
                  <p className="text-sm font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{user.email ?? user.phone}</p>
                  <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_COLORS[user.userType]}`}>
                    {ROLE_LABELS[user.userType]}
                  </span>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <User size={16} className="text-gray-400" />
                  Mon profil
                </Link>
                {user.userType === "organizer" && (
                  <Link
                    href="/organizer"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <ClipboardList size={16} className="text-gray-400" />
                    Espace organisateur
                  </Link>
                )}
                {user.userType === "superadmin" && (
                  <Link
                    href="/admin"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Shield size={16} className="text-gray-400" />
                    Administration
                  </Link>
                )}
                <Link
                  href="/live-ops"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Radio size={16} className="text-gray-400" />
                  Live ops
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LogOut size={16} className="text-gray-400" />
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      ) : loading ? (
        // Auth still resolving: keep the slot stable, no flash of CTAs.
        <div className="h-8 w-40" />
      ) : (
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600"
          >
            Rejoindre
          </Link>
        </div>
      )}
    </header>
  );
}
