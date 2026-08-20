"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Flame, Trophy, Newspaper, ArrowLeftRight, Globe, Search, ChevronDown, User, Briefcase,
  Link2 as LinkIcon, ArrowUpRight, Flag,
  Rocket, ClipboardList, Plus, Radio, Shield, LogOut, Share2, Check, Sparkles, MapPin,
  Users, ClipboardCheck, CalendarDays, BarChart3,
  type LucideIcon,
} from "lucide-react";
import type { EvolutionRole } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { isOrganizer, isVenueOwner } from "@/lib/hats";
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
  /**
   * Ouvre dans un nouvel onglet. Reserve aux pages vitrine : elles sortent du
   * produit pour argumenter, et quelqu'un qui suit un match en direct ne doit
   * pas perdre son ecran pour aller lire une presentation.
   */
  newTab?: boolean;
  /** Ce qu'on trouve derriere, pour le megamenu. */
  blurb?: string;
}

const PRIMARY: NavEntry[] = [
  { href: HOME, label: "Direct", Icon: Flame, exact: true },
  { href: "/actus", label: "Actus", Icon: Newspaper },
];

/**
 * Les portes d'entree du produit, autrefois repliees dans un menu « Extra ».
 *
 * Le repli partait d'une bonne intention — ce sont des actions, pas des
 * sections — mais il enterrait trois pages faites pour etre trouvees par
 * quelqu'un qui ne connait pas encore le produit. Une page d'acquisition
 * derriere un menu deroulant est une page qu'on ne lit pas.
 *
 * Les libelles portent le nom de produit complet — c'est ainsi que ces trois
 * espaces s'appellent, et la rangee est le seul endroit ou ils sont nommes.
 */
const ENTRIES: NavEntry[] = [
  {
    href: "/organisateurs", label: "Koppafoot Organize", Icon: Trophy, newTab: true,
    blurb: "Monter une compétition, tenir son calendrier et la diffuser en direct.",
  },
  {
    href: "/roles", label: "Koppafoot Evolution", Icon: Sparkles, newTab: true,
    blurb: "Choisir ce qu'on devient ici : joueur, manager, arbitre, organisateur.",
  },
  {
    href: "/terrains", label: "MyFields", Icon: MapPin, newTab: true,
    blurb: "Référencer un terrain et se rendre trouvable par les équipes.",
  },
];

/**
 * Le mercato ne s'affiche qu'une fois connecte. Sans compte, la page ne
 * propose que des arrivees deja confirmees — et ces memes arrivees sont
 * desormais dans le rail du Direct, ou un visiteur les croise sans avoir a
 * pousser une porte qui ne s'ouvre pas pour lui.
 *
 * Fleches de transfert, pas devanture : l'icone boutique se lisait « shop ».
 */
const MERCATO: NavEntry = { href: "/mercato", label: "Mercato", Icon: ArrowLeftRight };

/**
 * La Tribune does not exist for a visitor: its posts are gated behind
 * `isAuthenticated()` in firestore.rules, so a guest was being offered a
 * door onto an empty room — and the rail behind it spent every page load
 * failing to read authors. Signed in, it takes its place in the menu.
 */
const TRIBUNE: NavEntry = { href: "/feed", label: "La Tribune", Icon: Globe };

// The sidebar's role destinations, now reached from the avatar menu.
const EVOLUTION_LABEL: Record<EvolutionRole, { label: string; Icon: LucideIcon }> = {
  player: { label: "Espace joueur", Icon: User },
  manager: { label: "Espace manager", Icon: Briefcase },
  referee: { label: "Espace arbitre", Icon: Flag },
};

const ROLE_ITEMS: Partial<Record<EvolutionRole, NavEntry[]>> = {
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
  // L'arbitre n'a pas encore d'ecran a lui : ses designations et ses rapports
  // sont au placard. Son espace suffit tant que c'est le cas.
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

/**
 * « Koppa Links » — les portes du produit, repliees dans un megamenu.
 *
 * Une fois connecte, la barre portait sept entrees : Direct, Actus, Mercato,
 * la Tribune et les trois portes. Les trois portes sont celles qui QUITTENT
 * l'application — nouvel onglet, site de presentation. Les replier laisse
 * dans la barre ce qui est vraiment de la navigation interne.
 *
 * Typographie large a dessein : ce ne sont pas des lignes de menu mais trois
 * produits, et chacun a droit a son nom en grand et a une phrase qui dit ce
 * qu'il y a derriere. Un megamenu qui ne ferait que grossir une liste de
 * libelles n'aurait rien resolu.
 */
function KoppaLinksMenu() {
  const { open, setOpen, boxRef } = useDropdown();

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] font-black uppercase tracking-[0.1em] transition-colors ${
          open ? "bg-white/15 text-white" : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
        }`}
      >
        <LinkIcon size={17} className={open ? "text-amber-300" : "text-emerald-300/70"} />
        Koppa Links
        <ChevronDown
          size={15}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[26rem] border border-gray-200/70 bg-white shadow-xl">
          {ENTRIES.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="group flex items-start gap-4 border-b border-gray-200/70 px-6 py-5 transition-colors last:border-b-0 hover:bg-gray-50"
            >
              <item.Icon
                size={26}
                strokeWidth={1.5}
                className="mt-1 shrink-0 text-gray-300 transition-colors group-hover:text-emerald-600"
              />
              <span className="min-w-0">
                <span className="block font-display text-xl font-black uppercase leading-tight tracking-tight text-gray-900">
                  {item.label}
                </span>
                <span className="mt-1.5 block text-[13px] font-medium leading-relaxed text-gray-500">
                  {item.blurb}
                </span>
              </span>
              <ArrowUpRight
                size={17}
                className="mt-1 shrink-0 text-gray-300 transition-colors group-hover:text-emerald-600"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
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

// ---- Account: the one menu on the right --------------------------------------


function AccountMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const authModal = useAuthModal();
  const { open, setOpen, boxRef } = useDropdown();
  const [copied, setCopied] = useState(false);
  const [moderates, setModerates] = useState(false);

  // Les casquettes passent par le predicat partage : il lit le drapeau ET
  // l'ancien `user_type`, sans quoi tous les organisateurs d'avant auraient
  // perdu leur espace du jour au lendemain.
  const organizes = isOrganizer(user);
  const ownsVenues = isVenueOwner(user);

  // Meme signal que la barre laterale : sans lui /live-ops est injoignable, et
  // un moderateur n'a aucune porte vers la console dont on lui a donne le
  // code. Resolu seulement a l'ouverture — c'est une lecture de collection.
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
    // La feuille de partage parle d'elle-meme ; une copie silencieuse non.
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

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

  // Quatre roles activables, pas deux : arbitre et terrain manquaient depuis
  // leur degel, et retombaient sur le libelle « Évolution » comme si leur
  // titulaire n'avait rien choisi.
  const evolution = user.evolutionRole
    ? EVOLUTION_LABEL[user.evolutionRole]
    : { label: "Évolution", Icon: Rocket };

  const roleItems = user.evolutionRole ? ROLE_ITEMS[user.evolutionRole] ?? [] : [];

  // Les consoles reviennent ici avec la disparition du menu Extra. Elles y
  // sont a leur place : ce sont des espaces qui n'existent que pour CE
  // compte — on ne les voit que si on y a droit — a la difference des trois
  // pages d'entree, qui s'adressent a tout le monde et vivent dans la barre.
  const spaces: NavEntry[] = [];
  if (organizes) {
    spaces.push({ href: "/organizer", label: "Espace organisateur", Icon: ClipboardList });
    spaces.push({ href: "/organizer/competitions/new", label: "Nouvelle compétition", Icon: Plus });
  }
  if (moderates) {
    spaces.push({ href: "/live-ops", label: "Espace live", Icon: Radio });
  }
  // Casquette terrain : elle se cumule avec le role Evolution, elle ne le
  // remplace pas. Un arbitre proprietaire voit les deux.
  if (ownsVenues) {
    spaces.push({ href: "/mes-terrains", label: "Mes terrains", Icon: MapPin });
    spaces.push({ href: "/mes-reservations", label: "Mes réservations", Icon: CalendarDays });
  }
  spaces.push({ href: "/evolution", ...evolution });
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

          {/* Inviter quelqu'un est un geste qu'on fait depuis son compte :
              c'est SON lien de parrainage qui part. */}
          <div className="border-t border-gray-50 py-1">
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
                {copied ? "Lien copié" : "Inviter un ami"}
              </span>
            </button>
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
    // Colle en haut : sur un tableau de scores on defile beaucoup, et
    // remonter chercher la navigation a chaque fois est un aller-retour
    // inutile. z-40 passe au-dessus du contenu sans couvrir les modales.
    <header className="sticky top-0 z-40 bg-emerald-900 pt-safe">
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
          {(user
            ? [...PRIMARY, MERCATO, TRIBUNE]
            : PRIMARY
          ).map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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

          {/* Un compte sans role choisi : l'invitation passe devant, en
              plein contraste. Elle vivait jusqu'ici au fond du menu avatar —
              c'est-a-dire nulle part pour qui ne l'ouvre jamais, alors que
              c'est le geste qui donne acces a tout le reste du produit.
              Elle disparait d'elle-meme des qu'un role est actif. */}
          {user && !user.evolutionRole && (
            <Link
              href="/evolution"
              className="flex shrink-0 items-center gap-2 border border-amber-300 bg-amber-300 px-3.5 py-2.5 text-[13px] font-black uppercase tracking-[0.1em] text-gray-900 transition-colors hover:border-white hover:bg-white"
            >
              <Rocket size={16} />
              Evolution
            </Link>
          )}

          {/* Les trois portes, repliees — la barre garde la navigation
              interne, le megamenu porte ce qui sort de l'application. */}
          <KoppaLinksMenu />
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
