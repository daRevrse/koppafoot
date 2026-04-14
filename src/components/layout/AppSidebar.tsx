"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, Users, Search, UserPlus, CheckCircle, MapPin, Calendar, Hash,
  Trophy, MessageSquare, Award, ShieldCheck, FileText, LogOut, Menu, X, User,
  Shirt, Globe, Shield, MessageCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_GROUPED_NAV, isNavGroup, type NavItem, type NavEntry } from "@/config/navigation";
import SidebarNavGroup from "./SidebarNavGroup";

// Map icon string names to lucide components
const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Home, Users, Search, UserPlus, CheckCircle, MapPin, Calendar, Hash,
  Trophy, MessageSquare, Award, ShieldCheck, FileText, User, Shirt, Globe, Shield, MessageCircle,
};

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.path;
  return pathname.startsWith(item.path);
}

export default function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;

  const navEntries: NavEntry[] = ROLE_GROUPED_NAV[user.userType] ?? [];

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-emerald-950">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-emerald-800 px-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/branding/logo_full_name.png"
            alt="KOPPAFOOT"
            width={140}
            height={36}
            className=""
            priority
          />
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
                  onNavigate={() => setMobileOpen(false)}
                  variant="sporty"
                  iconMap={ICONS}
                />
              );
            }
            // Standalone item (Dashboard)
            const item = entry as NavItem;
            const Icon = ICONS[item.icon] ?? Home;
            const active = isActive(pathname, item);
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
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-emerald-800 p-3">
        <Link
          href="/profile"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${pathname === "/profile"
            ? "bg-emerald-800/50 text-white"
            : "text-emerald-300 hover:bg-emerald-800/50 hover:text-white"
            }`}
        >
          <User size={20} className={pathname === "/profile" ? "text-accent-400" : "text-emerald-500"} />
          Mon profil
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-800/50 hover:text-white transition-colors"
        >
          <LogOut size={20} className="text-emerald-500" />
          Déconnexion
        </button>
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
      <aside className="hidden w-72 flex-shrink-0 lg:block">
        {sidebar}
      </aside>
    </>
  );
}
