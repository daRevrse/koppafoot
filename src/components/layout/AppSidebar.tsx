"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home, Activity, Trophy, Star, Settings,
  ClipboardList, Shield, Radio, LogIn, Rocket, User, Briefcase, UserPlus, Check,
  Users, BarChart3, Plus, GraduationCap, Store,
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
  // "Direct" is a live-score board, not a home page — a pulse reads truer
  // than a house, and leaves Radio free for the live-ops space.
  { path: "/", icon: Activity, label: "Direct", exact: true },
  { path: "/competitions", icon: Trophy, label: "Compétitions" },
];

// ============================================
// Spaces — the privileged areas (role, organizer, live, admin). Each is one
// header entry plus its destinations, rendered indented underneath.
//
// They live in the SAME sidebar as the public menu on purpose: /organizer
// and /live-ops have their own route groups and shells, which made them feel
// like separate products. Surfacing their destinations here keeps it one app.
//
// Every sub-entry must be a route the user can actually use today — a
// submenu of teasers would just be noise.
// ============================================

interface SpaceItem {
  path: string;
  icon: typeof Home;
  label: string;
  exact?: boolean;
}

interface Space {
  path: string;
  icon: typeof Home;
  label: string;
  items: SpaceItem[];
}

const ROLE_SPACE_ITEMS: Record<"player" | "manager", SpaceItem[]> = {
  player: [
    // /teams serves both sides: getTeamsByManager for a manager,
    // getTeamsByPlayer for a player. The player just had no way in.
    { path: "/teams", icon: Users, label: "Mes équipes" },
    { path: "/stats", icon: BarChart3, label: "Mes statistiques" },
    { path: "/mercato", icon: Store, label: "Mercato" },
  ],
  manager: [
    { path: "/teams", icon: Users, label: "Mon équipe" },
    { path: "/mon-equipe", icon: Trophy, label: "Mes compétitions" },
    { path: "/mercato", icon: Store, label: "Mercato" },
  ],
};

const ORGANIZER_ITEMS: SpaceItem[] = [
  { path: "/organizer", icon: Trophy, label: "Mes compétitions", exact: true },
  { path: "/organizer/competitions/new", icon: Plus, label: "Nouvelle compétition" },
];

const LIVE_ITEMS: SpaceItem[] = [
  { path: "/live-ops", icon: Radio, label: "Mes directs", exact: true },
  { path: "/live-ops/entrainement", icon: GraduationCap, label: "Match d'entraînement" },
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
  const [moderatesUid, setModeratesUid] = useState<string | null>(null);
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

  const isOrganizer = user?.userType === "organizer" || user?.userType === "superadmin";
  const moderatesAny = !!user && moderatesUid === user.uid;

  // Order matters: what the user does most often comes first.
  const spaces: Space[] = [];
  if (user && evolution) {
    spaces.push({
      path: "/evolution",
      icon: evolution.Icon,
      label: evolution.label,
      // Only an activated role has destinations; "Évolution" is the pitch.
      items: user.evolutionRole ? ROLE_SPACE_ITEMS[user.evolutionRole] ?? [] : [],
    });
  }
  if (isOrganizer) {
    // Gated on the granted role, not on owning a competition: an organizer
    // with none yet is exactly who needs "Nouvelle compétition".
    spaces.push({
      path: "/organizer",
      icon: ClipboardList,
      label: "Espace organisateur",
      items: ORGANIZER_ITEMS,
    });
  }
  if (user && moderatesAny) {
    spaces.push({
      path: "/live-ops",
      icon: Radio,
      label: "Espace live",
      items: LIVE_ITEMS,
    });
  }
  if (user?.userType === "superadmin") {
    spaces.push({ path: "/admin", icon: Shield, label: "Administration", items: [] });
  }

  useEffect(() => {
    listPublicCompetitions().then(setCompetitions).catch(() => {});
  }, []);

  // "Live ops" is only for actual moderators (access is enforced by the
  // (moderator) layout too — this just hides the entry from everyone else).
  // The result is stored WITH the uid it belongs to, so logging out or
  // switching account can't leave the entry showing on stale data.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listModeratedCompetitions(user.uid)
      .then((comps) => {
        if (!cancelled && comps.length > 0) setModeratesUid(user.uid);
      })
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
            {/* Privileged spaces — same shell, one app. Each renders its
                header entry plus its destinations, indented. */}
            {spaces.map((space) => {
              const SpaceIcon = space.icon;
              const spaceActive = isActive(pathname, space.path);
              return (
                <div key={space.path} className="space-y-0.5">
                  <Link
                    href={space.path}
                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                      spaceActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    {spaceActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-500" />
                    )}
                    <SpaceIcon size={18} className={spaceActive ? "text-emerald-600" : "text-gray-400"} />
                    {space.label}
                  </Link>
                  {space.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.path, item.exact);
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={`relative ml-3 flex items-center gap-3 rounded-lg border-l border-gray-100 py-2 pl-5 pr-3 text-sm font-semibold transition-colors ${
                          active
                            ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
                            : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                        }`}
                      >
                        <Icon size={15} className={active ? "text-emerald-600" : "text-gray-300"} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
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
                    // The Direct home no longer scopes to one competition, so
                    // ?c=slug is dead — send the user to the competition itself.
                    href={`/c/${c.slug}`}
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
