"use client";

import { useEspaces } from "@/hooks/useEspaces";
import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Flame, Trophy, MessageCircle, User, LogOut, X, Rocket, UserPlus, Check, LayoutGrid, Newspaper,
  } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
    // Home is public, no reason to send anyone to a login screen.
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
// deep. They now have their own tab, the one the Tribune freed when it moved
// up to the header, and the same sheet styling as the profile button.
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
  // La MEME source que le megamenu du desktop. Ce calcul existait ici en
  // double, et les deux avaient deja diverge : le mercato manquait de ce
  // cote, et une entree « Espace joueur » repetant le titre de la feuille
  // s'y etait ajoutee. Une seule source, plus d'ecart possible.
  const espaces = useEspaces();

  if (!open || !user || !espaces) return null;

  // La porte vers la candidature organisateur vivait ici pour les comptes qui
  // ne le sont pas encore. Koppa Links la porte desormais, avec les deux
  // autres portes du produit, la garder en double n'apprend rien.
  const spaces = [...espaces.roleItems, ...espaces.hatItems];

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

          {/* Grille d'icones, comme le megamenu du desktop.
              
              Ces entrees sont des destinations de meme rang : une colonne de
              lignes suggerait un ordre de parcours qui n'existe pas, et
              poussait la derniere bien plus bas que la premiere. En grille,
              elles se valent et se touchent du pouce sans defiler.

              La phrase d'aide de chaque entree disparait avec la ligne : sur
              trois colonnes il n'y a pas la place, et « Les equipes dont tu
              fais partie » sous « Mes equipes » ne disait rien de plus. */}
          <div className="grid grid-cols-3 gap-px bg-white/10 pb-safe">
            {spaces.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className="flex flex-col items-center gap-2 bg-emerald-950 px-2 py-5 text-center transition-colors active:bg-emerald-900"
              >
                <Icon size={22} strokeWidth={1.5} className="text-emerald-400" />
                <span className="text-[10px] font-black uppercase leading-tight tracking-[0.08em] text-white/80">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────
/**
 * La barre publie sa hauteur dans `--bottomnav-h`.
 *
 * Elle est fixee, donc elle flotte au-dessus de tout : sans cette mesure,
 * une feuille montante se glissait dessous et son dernier lien devenait
 * illisible et intouchable. Meme raison que `--header-h` en haut, la
 * hauteur depend du terminal (`pb-safe` sur un iPhone a encoche), donc on la
 * mesure au lieu de la deviner.
 */
function useBottomNavHeight() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    const publier = () => {
      document.documentElement.style.setProperty(
        "--bottomnav-h",
        el ? `${Math.round(el.getBoundingClientRect().height)}px` : "0px",
      );
    };
    publier();
    if (!el) return;
    const ro = new ResizeObserver(publier);
    ro.observe(el, { box: "border-box" });
    window.addEventListener("resize", publier);
    window.addEventListener("orientationchange", publier);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", publier);
      window.removeEventListener("orientationchange", publier);
      // La barre disparait au-dessus de `lg` : sa hauteur doit retomber a
      // zero, sinon les feuilles garderaient un espace fantome en desktop.
      document.documentElement.style.setProperty("--bottomnav-h", "0px");
    };
  }, []);

  return ref;
}

export default function MobileBottomNav() {
  const navRef = useBottomNavHeight();
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
        ref={navRef}
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
                    <span className="absolute -top-1.5 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-emerald-400" />
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
                en jaune plein contraste, le meme geste que la barre desktop,
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
