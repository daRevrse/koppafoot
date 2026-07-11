"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Trophy, MessageCircle, User, ClipboardList, Shield, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_GROUPED_NAV, MEMBER_NAV, isNavGroup, type NavItem, type NavEntry } from "@/config/navigation";
import SidebarNavGroup from "./SidebarNavGroup";

// Map icon string names to lucide components
const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Home, Trophy, MessageCircle, User,
};

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.path;
  return pathname.startsWith(item.path);
}

export default function AppSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();

  // The shell is public: guests get the member nav, auth unlocks extras.
  const navEntries: NavEntry[] = user
    ? ROLE_GROUPED_NAV[user.userType] ?? MEMBER_NAV
    : MEMBER_NAV;

  const sidebar = (
    <div className="flex h-full flex-col bg-emerald-950">
      {/* Header: Symbol + text */}
      <div className="flex h-16 items-center gap-2.5 border-b border-emerald-800 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/branding/logo_symbol.png"
            alt="K"
            width={28}
            height={28}
            priority
          />
          <span className="text-base font-bold tracking-wide text-white font-display">KOPPAFOOT</span>
        </Link>
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
                  onNavigate={() => {}}
                  variant="sporty"
                  iconMap={ICONS}
                  badgeCounts={{}}
                />
              );
            }
            const item = entry as NavItem;
            const Icon = ICONS[item.icon] ?? Home;
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active
                  ? "bg-emerald-800/50 text-white border-l-2 border-accent-500"
                  : "text-emerald-200/70 hover:bg-emerald-800/50 hover:text-white"
                  }`}
              >
                <Icon size={20} className={active ? "text-accent-400" : "text-emerald-500"} />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Privileged spaces — auth-dependent */}
        {user && (user.userType === "organizer" || user.userType === "superadmin") && (
          <div className="mt-6 border-t border-emerald-800 pt-4">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
              Mes espaces
            </p>
            {user.userType === "organizer" && (
              <Link
                href="/organizer"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-emerald-200/70 transition-colors hover:bg-emerald-800/50 hover:text-white"
              >
                <ClipboardList size={20} className="text-emerald-500" />
                Espace organisateur
              </Link>
            )}
            {user.userType === "superadmin" && (
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-emerald-200/70 transition-colors hover:bg-emerald-800/50 hover:text-white"
              >
                <Shield size={20} className="text-emerald-500" />
                Administration
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* Guest CTAs */}
      {!user && (
        <div className="space-y-2 border-t border-emerald-800 px-4 py-4">
          <Link
            href="/signup"
            className="flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-400"
          >
            Rejoindre
          </Link>
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-800/50"
          >
            <LogIn size={15} />
            Se connecter
          </Link>
        </div>
      )}

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
      {/* Desktop sidebar only — mobile uses MobileBottomNav */}
      <aside className="sticky top-0 hidden h-screen w-72 flex-shrink-0 lg:block">
        {sidebar}
      </aside>
    </>
  );
}
