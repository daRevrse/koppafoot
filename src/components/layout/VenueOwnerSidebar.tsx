"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Calendar, TrendingUp, Plus, LogOut, Menu, X, User, Building2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { VENUE_OWNER_GROUPED_NAV, isNavGroup, type NavItem, type NavEntry } from "@/config/navigation";
import SidebarNavGroup from "./SidebarNavGroup";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  LayoutDashboard, Calendar, TrendingUp, Building2,
};

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.path;
  return pathname.startsWith(item.path);
}

export default function VenueOwnerSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-5">
        <Link href="/venue-owner" className="flex items-center gap-2">
          <Image
            src="/branding/logo_symbol.png"
            alt=""
            width={28}
            height={28}
          />
          <span className="text-lg font-bold text-primary-600 font-display">KOPPAFOOT</span>
          <span className="rounded bg-primary-100 px-1.5 py-0.5 text-xs font-semibold text-primary-700">PRO</span>
        </Link>
      </div>

      {/* Add venue CTA */}
      <div className="px-4 py-4">
        <Link
          href="/venue-owner/venues/new"
          className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          Ajouter un terrain
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3">
        <div className="space-y-1">
          {VENUE_OWNER_GROUPED_NAV.map((entry: NavEntry) => {
            if (isNavGroup(entry)) {
              return (
                <SidebarNavGroup
                  key={entry.key}
                  group={entry}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                  variant="light"
                  iconMap={ICONS}
                />
              );
            }
            const item = entry as NavItem;
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary-50 text-primary-700 border-l-2 border-primary-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon size={20} className={active ? "text-primary-600" : "text-gray-400"} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-3">
        <Link
          href="/venue-owner/profile"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <User size={18} className="text-gray-400" />
          Mon profil
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <LogOut size={18} className="text-gray-400" />
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setMobileOpen(true)} className="fixed left-4 top-4 z-40 rounded-lg bg-white p-2 shadow-md lg:hidden">
        <Menu size={20} />
      </button>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-64 bg-white shadow-xl">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 text-gray-400"><X size={20} /></button>
            {sidebar}
          </div>
        </div>
      )}
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white lg:block">
        {sidebar}
      </aside>
    </>
  );
}
