"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Shield, Trophy, MapPin, Award, Flag,
  AlertTriangle, FileText, TrendingUp, Settings, LogOut, Menu, X, User,
  ChevronLeft, MessageSquare, Megaphone,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_GROUPED_NAV, isNavGroup, type NavItem, type NavEntry } from "@/config/navigation";
import SidebarNavGroup from "./SidebarNavGroup";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  LayoutDashboard, Users, Shield, Trophy, MapPin, Award, Flag,
  AlertTriangle, FileText, TrendingUp, Settings, MessageSquare, Megaphone,
};

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.path;
  return pathname.startsWith(item.path);
}

export default function AdminSidebar() {
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
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0F172A] to-[#1E293B]">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-white/5 px-5">
        <Link href="/admin" className="flex items-center gap-2.5">
          <Image
            src="/branding/logo_symbol.png"
            alt=""
            width={28}
            height={28}
            className="brightness-0 invert"
          />
          <div>
            <span className="text-base font-extrabold text-white font-display tracking-tight">KOPPA</span>
            <span className="text-[10px] ml-1 font-semibold text-blue-400 bg-blue-500/10 rounded px-1 py-0.5">ADMIN</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {ADMIN_GROUPED_NAV.map((entry: NavEntry) => {
            if (isNavGroup(entry)) {
              return (
                <SidebarNavGroup
                  key={entry.key}
                  group={entry}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                  variant="dark"
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
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-blue-600/15 text-white shadow-sm shadow-blue-500/5"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} className={active ? "text-blue-400" : "text-slate-500"} />
                {item.label}
                {active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 p-3 space-y-0.5">
        <Link
          href="/admin/profile"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <User size={17} />
          Mon profil
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-emerald-400 hover:bg-white/5 transition-colors"
        >
          <ChevronLeft size={17} />
          Retour au site
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut size={17} />
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setMobileOpen(true)} className="fixed left-4 top-4 z-40 rounded-xl bg-slate-800 p-2 shadow-lg lg:hidden">
        <Menu size={20} className="text-white" />
      </button>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-64 shadow-2xl">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 z-10 text-slate-400 hover:text-white"><X size={20} /></button>
            {sidebar}
          </div>
        </div>
      )}
      <aside className="hidden w-64 flex-shrink-0 lg:block">
        {sidebar}
      </aside>
    </>
  );
}
