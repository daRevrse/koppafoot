"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Flame, Trophy, Newspaper, ArrowLeftRight, Globe, Search, ChevronDown, User, Briefcase,
  Rocket, ClipboardList, Plus, Radio, Shield, LogOut, Share2, Check, Sparkles,
  ExternalLink,
  Users, ClipboardCheck, CalendarDays, BarChart3,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listModeratedCompetitions } from "@/lib/competition-firestore";
import { shareInviteLink } from "@/lib/invite-link";
import { useAuthModal } from "@/components/auth/AuthModal";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import SearchModal from "./SearchModal";

// ============================================
// ScoreHeader — the one band of the shell.
//
// Everything the sidebar used to carry is horizontal now: the sections as
// tabs next to the logo, and everything else behind ONE menu on the right —
// the avatar, or a User icon when signed out. The role destinations that
// briefly lived on a third band went in there too: a second row of links was
// a lot of chrome for pages visited once a week.
//
// Shared bits (search, notifications) are reused as-is and re-toned for the
// dark band through descendant selectors, rather than forked — those files
// belong to the current shell and must keep working there unchanged.
// ============================================

/** The Direct board — the home. */
export const HOME = "/";

interface NavEntry {
  href: string;
  label: string;
  Icon: LucideIcon;
  exact?: boolean;
}

const PRIMARY: NavEntry[] = [
  { href: HOME, label: "Direct", Icon: Flame, exact: true },
  { href: "/actus", label: "Actus", Icon: Newspaper },
  // Transfer arrows, not a shop front: the mercato is a market of movements
  // between clubs, and the storefront icon read as "boutique".
  { href: "/mercato", label: "Mercato", Icon: ArrowLeftRight },
];

/**
 * La Tribune does not exist for a visitor: its posts are gated behind
 * `isAuthenticated()` in firestore.rules, so a guest was being offered a
 * door onto an empty room — and the rail behind it spent every page load
 * failing to read authors. Signed in, it takes its place in the menu.
 */
const TRIBUNE: NavEntry = { href: "/feed", label: "La Tribune", Icon: Globe };

// The sidebar's role destinations, now reached from the avatar menu.
const ROLE_ITEMS: Record<"player" | "manager", NavEntry[]> = {
  player: [
    { href: "/teams", label: "Mes équipes", Icon: Users },
    { href: "/participations", label: "Mes convocations", Icon: ClipboardCheck },
    { href: "/calendar", label: "Calendrier", Icon: CalendarDays },
    { href: "/stats", label: "Mes statistiques", Icon: BarChart3 },
  ],
  manager: [
    { href: "/teams", label: "Mon équipe", Icon: Users },
    { href: "/matches", label: "Matchs amicaux", Icon: Users },
    { href: "/calendar", label: "Calendrier", Icon: CalendarDays },
    { href: "/mon-equipe", label: "Mes compétitions", Icon: Trophy },
  ],
};

const MENU_CLASS =
  "absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-gray-100 bg-white py-1 shadow-lg";

/** Open state + click-outside, shared by the three menus of the band. */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return { open, setOpen, boxRef };
}

function MenuLink({
  href, label, Icon, onClick,
}: {
  href: string; label: string; Icon: LucideIcon; onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-gray-50"
    >
      <Icon size={15} className="shrink-0 text-emerald-500" />
      <span className="truncate text-[13px] font-bold text-gray-700">{label}</span>
    </Link>
  );
}

/**
 * Same row, but leaving the app. The organizer site has its own chrome and
 * its own reading order — opening it in place would swap the furniture under
 * someone who was watching a match.
 */
function MenuExternalLink({
  href, label, Icon, onClick,
}: {
  href: string; label: string; Icon: LucideIcon; onClick: () => void;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-gray-50"
    >
      <Icon size={15} className="shrink-0 text-emerald-500" />
      <span className="truncate text-[13px] font-bold text-gray-700">{label}</span>
      <ExternalLink size={12} className="ml-auto shrink-0 text-gray-300" />
    </a>
  );
}

// ---- Account: the one menu on the right --------------------------------------

/**
 * Extra — what the product offers you, as opposed to the sections above it.
 *
 * Organising a competition and inviting a friend are actions, not places, so
 * they sat awkwardly as tabs between Direct and La Tribune. Folded into one
 * dropdown they keep their place in the menu without competing with the
 * sections for the eye.
 */
function ExtraMenu() {
  const { user } = useAuth();
  const { open, setOpen, boxRef } = useDropdown();
  const [copied, setCopied] = useState(false);
  const [moderates, setModerates] = useState(false);

  const organizes = user?.userType === "organizer" || user?.userType === "superadmin";

  // Same signal as the sidebar: without it /live-ops is unreachable, and a
  // moderator has no way into the console they were handed a code for.
  // Resolved only when the menu opens — it is a collection read.
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    listModeratedCompetitions(user.uid)
      .then((comps) => { if (!cancelled) setModerates(comps.length > 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, user]);

  const handleInvite = async () => {
    const result = await shareInviteLink(user?.firstName);
    // The share sheet speaks for itself; a silent clipboard copy does not.
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] font-black uppercase tracking-[0.1em] transition-colors ${
          open ? "bg-white/15 text-white" : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Sparkles size={17} className="text-amber-300" />
        Extra
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-gray-100 bg-white py-1 shadow-lg">
          {/* The consoles first: for the few who have them, this is why they
              opened the menu. */}
          {organizes && (
            <MenuLink
              href="/organizer"
              label="Espace organisateur"
              Icon={ClipboardList}
              onClick={() => setOpen(false)}
            />
          )}
          {moderates && (
            <MenuLink
              href="/live-ops"
              label="Espace live"
              Icon={Radio}
              onClick={() => setOpen(false)}
            />
          )}
          {(organizes || moderates) && <div className="my-1 border-t border-gray-100" />}

          {organizes ? (
            <MenuLink
              href="/organizer/competitions/new"
              label="Nouvelle compétition"
              Icon={Plus}
              onClick={() => setOpen(false)}
            />
          ) : (
            <MenuExternalLink
              href="/organisateurs"
              label="Organiser ma compétition"
              Icon={Trophy}
              onClick={() => setOpen(false)}
            />
          )}
          <button
            type="button"
            onClick={handleInvite}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-gray-50"
          >
            {copied ? (
              <Check size={15} className="shrink-0 text-emerald-500" />
            ) : (
              <Share2 size={15} className="shrink-0 text-emerald-500" />
            )}
            <span className="truncate text-[13px] font-bold text-gray-700">
              {copied ? "Lien copié !" : "Inviter un ami"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const authModal = useAuthModal();
  const { open, setOpen, boxRef } = useDropdown();

  // Signed out: the same slot becomes the way in — and the way in is a
  // dialog, not a page, so nobody loses the match they were reading.
  if (!user) {
    return (
      <div className="shrink-0">
        <button
          type="button"
          onClick={() => authModal.open()}
          aria-label="Se connecter"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <User size={20} />
        </button>
      </div>
    );
  }

  const evolution =
    user.evolutionRole === "player"
      ? { label: "Espace joueur", Icon: User }
      : user.evolutionRole === "manager"
        ? { label: "Espace manager", Icon: Briefcase }
        : { label: "Évolution", Icon: Rocket };

  const roleItems =
    user.evolutionRole === "manager"
      ? ROLE_ITEMS.manager
      : user.evolutionRole === "player"
        ? ROLE_ITEMS.player
        : [];

  // The organizer and live consoles moved to the Extra menu: they are rooms
  // in the product, not settings on this account, and the avatar menu was
  // becoming the place everything went when it fitted nowhere else. What
  // stays here is what is about *you* — your role, and the admin console.
  const spaces: NavEntry[] = [{ href: "/evolution", ...evolution }];
  if (user.userType === "superadmin") {
    spaces.push({ href: "/admin", label: "Administration", Icon: Shield });
  }

  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Mon compte"
        className="flex items-center gap-1 rounded-full p-0.5 pr-1 transition-colors hover:bg-white/10"
      >
        {user.profilePictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.profilePictureUrl}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-white/20"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xs font-black text-white">
            {initials}
          </span>
        )}
        <ChevronDown size={13} className="hidden text-emerald-200/70 sm:block" />
      </button>

      {open && (
        <div className={MENU_CLASS}>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block border-b border-gray-50 px-3 pb-2 pt-1.5 transition-colors hover:bg-gray-50"
          >
            <span className="block truncate text-[13px] font-black text-gray-900">
              {user.firstName} {user.lastName}
            </span>
            <span className="block truncate text-[11px] font-bold text-gray-400">
              Voir mon profil
            </span>
          </Link>

          {roleItems.length > 0 && (
            <div className="border-b border-gray-50 py-1">
              {roleItems.map((item) => (
                <MenuLink key={item.href} {...item} onClick={() => setOpen(false)} />
              ))}
            </div>
          )}

          <div className="py-1">
            {spaces.map((item) => (
              <MenuLink key={item.href} {...item} onClick={() => setOpen(false)} />
            ))}
          </div>

          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await logout();
              // Home is public — no reason to send anyone to a login screen.
              router.push("/");
            }}
            className="flex w-full items-center gap-2.5 border-t border-gray-50 px-3 py-2 text-left transition-colors hover:bg-gray-50"
          >
            <LogOut size={15} className="shrink-0 text-gray-400" />
            <span className="text-[13px] font-bold text-gray-500">Se déconnecter</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ---- The band ----------------------------------------------------------------

export default function ScoreHeader() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="bg-emerald-900 pt-safe">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 lg:gap-5 lg:px-8 lg:py-4">
        <Link href={HOME} className="flex shrink-0 items-center gap-2">
          <Image src="/branding/logo_symbol.png" alt="KoppaFoot" width={34} height={34} priority />
          <span className="font-display text-base font-black uppercase tracking-[0.14em] text-white lg:text-lg">
            Koppafoot
          </span>
        </Link>

        {/* Sections. Hidden on a phone: the bottom tab bar owns navigation
            there, and the mobile band stays light. */}
        <nav className="ml-auto hidden min-w-0 items-center gap-0.5 lg:flex">
          {(user ? [...PRIMARY, TRIBUNE] : PRIMARY).map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] font-black uppercase tracking-[0.1em] transition-colors ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.Icon size={17} className={active ? "text-amber-300" : "text-emerald-300/70"} />
                {item.label}
              </Link>
            );
          })}

          <span aria-hidden className="mx-1 h-5 w-px bg-white/15" />
          <ExtraMenu />
        </nav>

        {/* A field on a pointer, an icon on a phone — both open the same
            modal, so there is one search surface to maintain and one place
            the filters live. It travels with the menu, on the right: the
            logo holds the left on its own. */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden w-56 shrink-0 items-center gap-2.5 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-left transition-colors hover:bg-white/15 lg:flex xl:w-72"
        >
          <Search size={17} className="shrink-0 text-emerald-200/50" />
          <span className="truncate text-xs font-semibold text-emerald-200/50">
            Compétition, équipe, joueur…
          </span>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-0">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Rechercher"
            className="flex h-11 w-11 items-center justify-center rounded-full text-emerald-100/80 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <Search size={22} />
          </button>

          {/* La Tribune, mobile only and members only: the tab bar leaves it
              out (see MEMBER_BOTTOM), so dropping it here would strand it. */}
          {user && (
          <Link
            href="/feed"
            aria-label="La Tribune"
            aria-current={pathname.startsWith("/feed") ? "page" : undefined}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors lg:hidden ${
              pathname.startsWith("/feed")
                ? "bg-white/15 text-white"
                : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Globe size={22} />
          </Link>
          )}

          {user && (
            <div className="[&_button:hover]:bg-white/10 [&_button:hover]:text-white [&_button]:text-emerald-100/80">
              <NotificationDropdown />
            </div>
          )}
          <AccountMenu />
        </div>
      </div>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
