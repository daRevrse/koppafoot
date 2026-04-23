"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home, Users, Search, UserPlus, CheckCircle, MapPin, Calendar, Hash,
  Trophy, MessageSquare, Award, ShieldCheck, FileText, Menu, X, User,
  Shirt, Globe, Shield, MessageCircle, UserSearch,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_GROUPED_NAV, isNavGroup, type NavItem, type NavEntry } from "@/config/navigation";
import SidebarNavGroup from "./SidebarNavGroup";
import {
  onJoinRequestsByManager, onInvitationsByManager,
  onMatchChallengesForManager,
  onInvitationsForPlayer, onParticipationsForPlayer,
  onRefereeAssignments,
  onLiveMatches,
} from "@/lib/firestore";

// Map icon string names to lucide components
const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Home, Users, Search, UserPlus, CheckCircle, MapPin, Calendar, Hash,
  Trophy, MessageSquare, Award, ShieldCheck, FileText, User, Shirt, Globe, Shield, MessageCircle, UserSearch,
};

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.path;
  return pathname.startsWith(item.path);
}

export default function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const { user } = useAuth();
  const pathname = usePathname();

  // Real-time badge counts
  useEffect(() => {
    if (!user) return;
    const unsubs: (() => void)[] = [];

    if (user.userType === "manager") {
      // Mercato badge = pending candidatures + pending invitations
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

      // Matches badge = pending challenges
      unsubs.push(onMatchChallengesForManager(user.uid, (challenges) => {
        setBadgeCounts((prev) => ({ ...prev, "/matches": challenges.length }));
      }));
    }

    if (user.userType === "player") {
      // Mercato badge = pending invitations
      unsubs.push(onInvitationsForPlayer(user.uid, (invs) => {
        setBadgeCounts((prev) => ({ ...prev, "/mercato": invs.filter((i) => i.status === "pending").length }));
      }));
      // Participations badge
      unsubs.push(onParticipationsForPlayer(user.uid, (parts) => {
        setBadgeCounts((prev) => ({ ...prev, "/participations": parts.filter((p) => p.status === "pending").length }));
      }));
    }

    if (user.userType === "referee") {
      // Mes matchs badge = invited matches
      unsubs.push(onRefereeAssignments(user.uid, (matches) => {
        setBadgeCounts((prev) => ({ ...prev, "/referee-panel/matches": matches.filter((m) => m.refereeStatus === "invited").length }));
      }));
    }

    // Global live match badge for Communauté -> Matchs
    unsubs.push(
      onLiveMatches((liveMatches) => {
        setBadgeCounts((prev) => ({
          ...prev,
          "/community/matches": liveMatches.length > 0 ? -1 : 0,
          "/matches": liveMatches.length > 0 ? -1 : (prev["/matches"] || 0),
        }));
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [user]);

  if (!user) return null;

  const navEntries: NavEntry[] = ROLE_GROUPED_NAV[user.userType] ?? [];



  const sidebar = (
    <div className="flex h-full flex-col bg-emerald-950">
      {/* Header: Symbol + text + role badge */}
      <div className="flex h-16 items-center gap-2.5 border-b border-emerald-800 px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Image
            src="/branding/logo_symbol.png"
            alt="K"
            width={28}
            height={28}
            priority
          />
          <span className="text-base font-bold tracking-wide text-white font-display">KOPPAFOOT</span>
        </Link>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          user.userType === "player" ? "bg-emerald-700 text-emerald-100" :
          user.userType === "manager" ? "bg-blue-700 text-blue-100" :
          user.userType === "referee" ? "bg-purple-700 text-purple-100" :
          user.userType === "venue_owner" ? "bg-orange-700 text-orange-100" :
          "bg-red-700 text-red-100"
        }`}>
          {user.userType === "player" ? "Joueur" :
           user.userType === "manager" ? "Manager" :
           user.userType === "referee" ? "Arbitre" :
           user.userType === "venue_owner" ? "Propriétaire" :
           "Admin"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navEntries.map((entry) => {
            if (isNavGroup(entry)) {
              return (
                <SidebarNavGroup
                  key={entry.key}
                  group={entry}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                  variant="sporty"
                  iconMap={ICONS}
                  badgeCounts={badgeCounts}
                />
              );
            }
            // Standalone item (Dashboard)
            const item = entry as NavItem;
            const Icon = ICONS[item.icon] ?? Home;
            const active = isActive(pathname, item);
            const count = badgeCounts[item.path] ?? 0;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active
                  ? "bg-emerald-800/50 text-white border-l-2 border-accent-500"
                  : "text-emerald-200/70 hover:bg-emerald-800/50 hover:text-white"
                  }`}
              >
                <Icon size={20} className={active ? "text-accent-400" : "text-emerald-500"} />
                <span className="flex-1">{item.label}</span>
                {item.badge && count === -1 && (
                  <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 border border-red-500/20">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                    </span>
                    <span className="text-[9px] font-black tracking-widest text-red-500">LIVE</span>
                  </span>
                )}
                {item.badge && count > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer: Branding logo */}
      <div className="border-t border-emerald-800 px-4 py-4 flex items-center justify-center">
        <Image
          src="/branding/logo_full_name.png"
          alt="KOPPAFOOT"
          width={120}
          height={32}
          style={{ height: "auto" }}
          className="opacity-40"
          priority
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg bg-emerald-950 p-2 text-white shadow-md lg:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-72 shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 text-emerald-400 hover:text-white"
            >
              <X size={20} />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-72 flex-shrink-0 lg:block">
        {sidebar}
      </aside>
    </>
  );
}
