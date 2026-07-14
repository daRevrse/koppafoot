"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home, Trophy, Star, Settings,
  ClipboardList, Shield, Radio, LogIn, Rocket, User, Briefcase, UserPlus, Check,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listPublicCompetitions, listModeratedCompetitions } from "@/lib/competition-firestore";
import { shareInviteLink } from "@/lib/invite-link";
import type { Competition } from "@/types";

// ============================================
// AppSidebar — light dashboard sidebar (ValueBet-style):
// logo row / profile block / menu / followed competitions.
// Public shell: guests get join/login CTAs in the profile slot.
// ============================================

// La Tribune lives in the right sidebar (and the mobile tab) — not here.
const MENU = [
  { path: "/", icon: Home, label: "Direct", exact: true },
  { path: "/competitions", icon: Trophy, label: "Compétitions" },
];

function isActive(pathname: string, path: string, exact?: boolean): boolean {
  if (exact) return pathname === path;
  return pathname.startsWith(path);
}

function CompetitionLogo({ competition, size = 26 }: { competition: Competition; size?: number }) {
  if (competition.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={competition.logoUrl}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {competition.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function AppSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [moderatesAny, setModeratesAny] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const handleInvite = async () => {
    const result = await shareInviteLink(user?.firstName);
    if (result === "copied") {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2500);
    }
  };

  // Évolution entry: label follows the activated role.
  const evolution = user
    ? user.evolutionRole === "player"
      ? { label: "Espace joueur", Icon: User }
      : user.evolutionRole === "manager"
        ? { label: "Espace manager", Icon: Briefcase }
        : { label: "Évolution", Icon: Rocket }
    : null;

  useEffect(() => {
    listPublicCompetitions().then(setCompetitions).catch(() => {});
  }, []);

  // "Live ops" is only for actual moderators (access is enforced by the
  // (moderator) layout too — this just hides the entry from everyone else).
  useEffect(() => {
    if (!user) {
      setModeratesAny(false);
      return;
    }
    let cancelled = false;
    listModeratedCompetitions(user.uid)
      .then((comps) => { if (!cancelled) setModeratesAny(comps.length > 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  return (
    <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 lg:block">
      <div className="flex h-full flex-col border-r border-gray-200 bg-white">
        {/* Logo row */}
        <div className="flex h-16 items-center justify-between border-b border-gray-100 px-5">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/branding/logo_symbol.png"
              alt="K"
              width={26}
              height={26}
              priority
            />
            <span className="font-display text-sm font-black tracking-wide text-gray-900">
              KOPPAFOOT
            </span>
          </Link>
          {user && (
            <Link href="/profile" className="text-gray-300 transition-colors hover:text-gray-500">
              <Settings size={17} />
            </Link>
          )}
        </div>

        {/* Profile block / guest CTAs */}
        {user ? (
          <div className="border-b border-gray-100 px-5 py-6 text-center">
            <div className="relative mx-auto h-16 w-16">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-lg font-black text-emerald-600 ring-2 ring-emerald-500 ring-offset-2">
                {user.profilePictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profilePictureUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                )}
              </div>
            </div>
            <p className="mt-3 truncate text-sm font-black text-gray-900">
              {user.firstName} {user.lastName}
            </p>
            {user.locationCity && (
              <p className="mt-0.5 truncate text-xs font-semibold text-gray-400">
                {user.locationCity}
              </p>
            )}
            <div className="mt-4 flex items-center justify-center">
              <div className="flex-1">
                <p className="text-sm font-black text-gray-900">{user.followersCount ?? 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Abonnés</p>
              </div>
              <div className="h-8 w-px bg-gray-100" />
              <div className="flex-1">
                <p className="text-sm font-black text-gray-900">{user.followingCount ?? 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Suivis</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-b border-gray-100 px-5 py-6">
            <p className="text-center text-xs font-semibold leading-relaxed text-gray-400">
              Rejoins Koppafoot pour suivre tes compétitions et recevoir les buts en direct.
            </p>
            <Link
              href="/signup"
              className="mt-4 flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600"
            >
              Rejoindre
            </Link>
            <Link
              href="/login"
              className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              <LogIn size={14} />
              Se connecter
            </Link>
          </div>
        )}

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-0.5 px-3">
            {MENU.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.path, item.exact);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                    active
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-500" />
                  )}
                  <Icon size={18} className={active ? "text-emerald-600" : "text-gray-400"} />
                  {item.label}
                </Link>
              );
            })}
            {evolution && (() => {
              const active = isActive(pathname, "/evolution");
              return (
                <Link
                  href="/evolution"
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                    active
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-500" />
                  )}
                  <evolution.Icon size={18} className={active ? "text-emerald-600" : "text-gray-400"} />
                  {evolution.label}
                </Link>
              );
            })()}
            {(user?.userType === "organizer" || user?.userType === "superadmin") && (
              <Link
                href="/organizer"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                <ClipboardList size={18} className="text-gray-400" />
                Espace organisateur
              </Link>
            )}
            {user?.userType === "superadmin" && (
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                <Shield size={18} className="text-gray-400" />
                Administration
              </Link>
            )}
            {user && moderatesAny && (
              <Link
                href="/live-ops"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                <Radio size={18} className="text-gray-400" />
                Live ops
              </Link>
            )}
          </div>

          {/* Followed competitions (favorite leagues slot) */}
          <div className="mt-6 px-3">
            <div className="mb-1.5 flex items-center justify-between px-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                Mes compétitions
              </p>
              <Link
                href="/competitions"
                className="text-[10px] font-black uppercase tracking-wide text-emerald-500 hover:text-emerald-600"
              >
                Suivre
              </Link>
            </div>
            {competitions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-300">Aucune compétition.</p>
            ) : (
              competitions.slice(0, 6).map((c) => {
                const followed = user?.followedCompetitionIds?.includes(c.id) ?? false;
                return (
                  <Link
                    key={c.id}
                    href={`/?c=${c.slug}`}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  >
                    <CompetitionLogo competition={c} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <Star
                      size={14}
                      className={followed ? "fill-amber-400 text-amber-400" : "text-gray-200"}
                    />
                  </Link>
                );
              })
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={handleInvite}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            {inviteCopied ? <Check size={15} /> : <UserPlus size={15} />}
            {inviteCopied ? "Lien copié !" : "Inviter un ami"}
          </button>
          <div className="mt-3 flex items-center justify-center">
            <Image
              src="/branding/logo_full_name.png"
              alt="KOPPAFOOT"
              width={100}
              height={26}
              style={{ height: "auto" }}
              className="opacity-30"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
