"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, Users, Trophy, MessageCircle, Shield,
  ShieldCheck, Calendar, MapPin, User, Settings, LogOut, X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_BOTTOM_NAV, ROLE_BADGE_COLORS, type BottomNavItem } from "@/config/navigation";
import { ROLE_LABELS } from "@/types";
import {
  onJoinRequestsByManager, onInvitationsByManager,
  onMatchChallengesForManager,
  onInvitationsForPlayer, onParticipationsForPlayer,
  onRefereeAssignments,
  onLiveMatches,
} from "@/lib/firestore";

// ─── Icon map ────────────────────────────────────────────────
const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Home, Users, Trophy, MessageCircle, Shield,
  ShieldCheck, Calendar, MapPin,
};

function isActive(pathname: string, item: BottomNavItem): boolean {
  if (item.exact) return pathname === item.path;
  return pathname.startsWith(item.path);
}

// ─── Avatar Bottom Sheet ─────────────────────────────────────
function AvatarBottomSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    onClose();
    await logout();
    router.push("/login");
  }, [logout, router, onClose]);

  if (!open || !user) return null;

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const badgeColor = ROLE_BADGE_COLORS[user.userType];
  const profileUrl = user.userType === "venue_owner" ? "/venue-owner/profile" : "/profile";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[70] animate-slide-up">
        <div className="mx-2 mb-2 overflow-hidden rounded-2xl border border-white/10 bg-emerald-950/95 shadow-2xl backdrop-blur-xl">
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </div>

          {/* User info */}
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-800 ring-2 ring-emerald-400/30">
              {user.profilePictureUrl ? (
                <img
                  src={user.profilePictureUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-emerald-300">
                  {initials}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-emerald-400/70">
                {user.email ?? user.phone}
              </p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeColor}`}
              >
                {ROLE_LABELS[user.userType]}
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Divider */}
          <div className="mx-5 h-px bg-white/10" />

          {/* Menu items */}
          <div className="p-2">
            <Link
              href={profileUrl}
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5 hover:text-white transition-colors"
            >
              <User size={18} className="text-emerald-400" />
              Mon profil
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Settings size={18} className="text-emerald-400" />
              Paramètres
            </Link>
          </div>

          {/* Divider */}
          <div className="mx-5 h-px bg-white/10" />

          {/* Logout */}
          <div className="p-2 pb-safe">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={18} />
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────
export default function MobileBottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  // Real-time badge counts (same logic as sidebar)
  useEffect(() => {
    if (!user) return;
    const unsubs: (() => void)[] = [];

    if (user.userType === "manager") {
      let pendingApps = 0;
      let pendingInvs = 0;
      const updateMercato = () =>
        setBadgeCounts((prev) => ({ ...prev, "/mercato": pendingApps + pendingInvs }));

      unsubs.push(onJoinRequestsByManager(user.uid, (reqs) => {
        pendingApps = reqs.filter((r) => r.status === "pending").length;
        updateMercato();
      }));
      unsubs.push(onInvitationsByManager(user.uid, (invs) => {
        pendingInvs = invs.filter((i) => i.status === "pending").length;
        updateMercato();
      }));
      unsubs.push(onMatchChallengesForManager(user.uid, (challenges) => {
        setBadgeCounts((prev) => ({ ...prev, "/matches": challenges.length }));
      }));
    }

    if (user.userType === "player") {
      unsubs.push(onInvitationsForPlayer(user.uid, (invs) => {
        setBadgeCounts((prev) => ({ ...prev, "/mercato": invs.filter((i) => i.status === "pending").length }));
      }));
      unsubs.push(onParticipationsForPlayer(user.uid, (parts) => {
        setBadgeCounts((prev) => ({ ...prev, "/participations": parts.filter((p) => p.status === "pending").length }));
      }));
    }

    if (user.userType === "referee") {
      unsubs.push(onRefereeAssignments(user.uid, (matches) => {
        setBadgeCounts((prev) => ({ ...prev, "/referee-panel/matches": matches.filter((m) => m.refereeStatus === "invited").length }));
      }));
    }

    unsubs.push(
      onLiveMatches((liveMatches) => {
        setBadgeCounts((prev) => ({
          ...prev,
          "/matches": liveMatches.length > 0 ? -1 : (prev["/matches"] || 0),
        }));
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [user]);

  if (!user) return null;

  const items = ROLE_BOTTOM_NAV[user.userType];
  if (!items) return null;

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  return (
    <>
      <nav
        id="mobile-bottom-nav"
        className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
      >
        {/* Glassmorphism backdrop */}
        <div className="bottom-nav-glass border-t border-white/10">
          <div className="flex items-end justify-around px-1 pt-1.5 pb-safe">
            {/* Regular nav items (4 tabs) */}
            {items.map((item) => {
              const Icon = ICONS[item.icon] ?? Home;
              const active = isActive(pathname, item);
              const count = badgeCounts[item.path] ?? 0;

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`bottom-nav-item group relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all duration-200 ${
                    active ? "bottom-nav-item-active" : ""
                  }`}
                >
                  {/* Active indicator pill */}
                  {active && (
                    <span className="absolute -top-1.5 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  )}

                  {/* Icon container */}
                  <span className="relative">
                    <Icon
                      size={22}
                      className={`transition-colors duration-200 ${
                        active
                          ? "text-emerald-400"
                          : "text-white/50 group-hover:text-white/80"
                      }`}
                    />

                    {/* Badge: numeric count */}
                    {item.badge && count > 0 && (
                      <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-lg">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}

                    {/* Badge: LIVE pulse */}
                    {item.badge && count === -1 && (
                      <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                      </span>
                    )}
                  </span>

                  {/* Label */}
                  <span
                    className={`text-[10px] font-semibold leading-tight transition-colors duration-200 ${
                      active
                        ? "text-emerald-400"
                        : "text-white/40 group-hover:text-white/70"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {/* 5th tab: Avatar button */}
            <button
              onClick={() => setSheetOpen(true)}
              className="bottom-nav-item group relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all duration-200"
            >
              <span className="relative">
                <div className={`flex h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-full ring-[1.5px] transition-all duration-200 ${
                  sheetOpen
                    ? "ring-emerald-400 bg-emerald-700"
                    : "ring-white/30 bg-emerald-800 group-hover:ring-white/50"
                }`}>
                  {user.profilePictureUrl ? (
                    <img
                      src={user.profilePictureUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[8px] font-bold text-emerald-300">
                      {initials}
                    </span>
                  )}
                </div>
              </span>
              <span
                className={`text-[10px] font-semibold leading-tight transition-colors duration-200 ${
                  sheetOpen
                    ? "text-emerald-400"
                    : "text-white/40 group-hover:text-white/70"
                }`}
              >
                Moi
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Profile bottom sheet */}
      <AvatarBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
