"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Trophy, MessageCircle, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_GROUPED_NAV, isNavGroup, type NavItem, type NavEntry } from "@/config/navigation";
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

  if (!user) return null;

  const navEntries: NavEntry[] = ROLE_GROUPED_NAV[user.userType] ?? [];

  const sidebar = (
    <div className="flex h-full flex-col bg-emerald-950">
      {/* Header: Symbol + text */}
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
      {/* Desktop sidebar only — mobile uses MobileBottomNav */}
      <aside className="sticky top-0 hidden h-screen w-72 flex-shrink-0 lg:block">
        {sidebar}
      </aside>
    </>
  );
}
