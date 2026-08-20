"use client";

import { isOrganizer } from "@/lib/hats";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Flame, Trophy, MessageCircle, User, LogOut, X, ClipboardList, Shield,
  Rocket, Briefcase, UserPlus, Check, Radio, LayoutGrid, ChevronRight, Plus, Newspaper,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listModeratedCompetitions } from "@/lib/competition-firestore";
import { shareInviteLink } from "@/lib/invite-link";
import { useAuthModal } from "@/components/auth/AuthModal";
import { ROLE_BOTTOM_NAV, MEMBER_BOTTOM, type BottomNavItem } from "@/config/navigation";

// ─── Icon map ────────────────────────────────────────────────
const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Flame, Trophy, MessageCircle, User, Newspaper,
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
  const [inviteCopied, setInviteCopied] = useState(false);

  const handleLogout = useCallback(async () => {
    onClose();
    await logout();
    // Home is public — no reason to send anyone to a login screen.
    router.push("/");
  }, [logout, router, onClose]);

  const handleInvite = useCallback(async () => {
    const result = await shareInviteLink(user?.firstName);
    if (result === "copied") {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2500);
    }
  }, [user?.firstName]);

  if (!open || !user) return null;

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const profileUrl = "/profile";

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
            <button
              onClick={handleInvite}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5 hover:text-white transition-colors"
            >
              {inviteCopied ? (
                <Check size={18} className="text-emerald-400" />
              ) : (
                <UserPlus size={18} className="text-emerald-400" />
              )}
              {inviteCopied ? "Lien copié !" : "Inviter un ami"}
            </button>
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

// ─── Spaces Bottom Sheet ─────────────────────────────────────
// The role spaces used to hang at the bottom of the profile sheet, three taps
// deep. They now have their own tab — the one the Tribune freed when it moved
// up to the header — and the same sheet styling as the profile button.
function SpacesSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  // Same signal as the desktop sidebar: without it /live-ops was unreachable
  // on mobile, so a moderator had to switch to a laptop to cover a match.
  const [moderates, setModerates] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    listModeratedCompetitions(user.uid)
      .then((comps) => {
        if (!cancelled) setModerates(comps.length > 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, user]);

  if (!open || !user) return null;

  // Évolution entry: label follows the activated role.
  const evolution =
    user.evolutionRole === "player"
      ? { label: "Espace joueur", hint: "Ton profil sportif et tes stats", Icon: User }
      : user.evolutionRole === "manager"
        ? { label: "Espace manager", hint: "Ton équipe et tes joueurs", Icon: Briefcase }
        : { label: "Évolution", hint: "Choisis ton rôle sur KoppaFoot", Icon: Rocket };

  const spaces: { href: string; label: string; hint: string; Icon: typeof User }[] = [
    { href: "/evolution", ...evolution },
  ];
  if (isOrganizer(user)) {
    spaces.push({
      href: "/organizer",
      label: "Espace organisateur",
      hint: "Tes compétitions, calendriers et équipes",
      Icon: ClipboardList,
    });
  } else {
    // Le pendant mobile du bouton du menu latéral : sans lui, la candidature
    // organisateur n'a plus aucune porte d'entrée depuis un téléphone.
    spaces.push({
      href: "/organisateurs",
      label: "Organiser ma compétition",
      hint: "Crée et gère tes propres compétitions",
      Icon: Plus,
    });
  }
  if (moderates) {
    spaces.push({
      href: "/live-ops",
      label: "Espace live",
      hint: "Saisir les matchs en direct",
      Icon: Radio,
    });
  }
  if (user.userType === "superadmin") {
    spaces.push({
      href: "/admin",
      label: "Administration",
      hint: "Utilisateurs, contenu et système",
      Icon: Shield,
    });
  }

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

          {/* Title */}
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-800 ring-2 ring-emerald-400/30">
              <LayoutGrid size={20} className="text-emerald-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">Mes espaces</p>
              <p className="truncate text-xs text-emerald-400/70">
                Change de casquette sans quitter l&apos;app
              </p>
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

          {/* Spaces */}
          <div className="p-2 pb-safe">
            {spaces.map(({ href, label, hint, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Icon size={18} className="flex-shrink-0 text-emerald-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{label}</span>
                  <span className="block truncate text-xs font-normal text-white/40">{hint}</span>
                </span>
                <ChevronRight size={16} className="flex-shrink-0 text-white/25" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────
export default function MobileBottomNav() {
  const { user } = useAuth();
  const authModal = useAuthModal();
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [spacesOpen, setSpacesOpen] = useState(false);
  const badgeCounts: Record<string, number> = {};

  // Public shell: guests get the member tabs; the 5th tab becomes a
  // login link instead of the profile sheet.
  const items = (user ? ROLE_BOTTOM_NAV[user.userType] : MEMBER_BOTTOM) ?? MEMBER_BOTTOM;

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "";

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
              const Icon = ICONS[item.icon] ?? Flame;
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

            {/* Troisieme place : l'espace du compte.
                
                Sans role Evolution, elle devient l'invitation a en choisir un,
                en jaune plein contraste — le meme geste que la barre desktop,
                qui n'existait pas ici. C'est la porte vers tout le reste du
                produit : la laisser au fond d'une feuille revenait a la
                cacher a qui ne l'ouvre jamais. */}
            {user && !user.evolutionRole && (
              <Link
                href="/evolution"
                className="bottom-nav-item group relative flex flex-col items-center gap-0.5 px-3 py-1.5"
              >
                <Rocket size={22} className="text-amber-300" />
                <span className="text-[10px] font-black leading-tight text-amber-300">
                  Evolution
                </span>
              </Link>
            )}

            {user && user.evolutionRole && (
              <button
                onClick={() => setSpacesOpen(true)}
                className="bottom-nav-item group relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all duration-200"
              >
                <span className="relative">
                  <LayoutGrid
                    size={22}
                    className={`transition-colors duration-200 ${
                      spacesOpen
                        ? "text-emerald-400"
                        : "text-white/50 group-hover:text-white/80"
                    }`}
                  />
                </span>
                <span
                  className={`text-[10px] font-semibold leading-tight transition-colors duration-200 ${
                    spacesOpen
                      ? "text-emerald-400"
                      : "text-white/40 group-hover:text-white/70"
                  }`}
                >
                  Espace
                </span>
              </button>
            )}

            {/* Last tab: avatar (authed) or login link (guest) */}
            {user ? (
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
            ) : (
              <button
                type="button"
                onClick={() => authModal.open()}
                className="bottom-nav-item group relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all duration-200"
              >
                <User size={22} className="text-white/50 group-hover:text-white/80" />
                <span className="text-[10px] font-semibold leading-tight text-white/40 group-hover:text-white/70">
                  Connexion
                </span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Profile bottom sheet */}
      {user && <AvatarBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />}

      {/* Role spaces bottom sheet */}
      {user && <SpacesSheet open={spacesOpen} onClose={() => setSpacesOpen(false)} />}
    </>
  );
}
