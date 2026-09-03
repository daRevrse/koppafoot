"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Flame, Trophy, Newspaper, Globe, Search, ChevronDown, User, Link2 as LinkIcon, ArrowUpRight, X, Rocket, LogOut, LogIn, Sparkles, MapPin, Radio,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEspaces } from "@/hooks/useEspaces";
import { useT } from "@/i18n";
import type { CleTraduction } from "@/i18n/fr";
import {
  InviteCard, SupportBlock, InstallBlock, NotificationsBlock, PreferencesBlock,
} from "@/components/account/AccountExtras";
import { useAuthModal } from "@/components/auth/AuthModal";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import SearchModal from "./SearchModal";
import HeaderProgress from "./HeaderProgress";

// ============================================
// ScoreHeader, the one band of the shell.
//
// Everything the sidebar used to carry is horizontal now: the sections as
// tabs next to the logo, and everything else behind ONE menu on the right,
// the avatar, or a User icon when signed out. The role destinations that
// briefly lived on a third band went in there too: a second row of links was
// a lot of chrome for pages visited once a week.
//
// Shared bits (search, notifications) are reused as-is and re-toned for the
// dark band through descendant selectors, rather than forked, those files
// belong to the current shell and must keep working there unchanged.
// ============================================

/** The Direct board, the home. */
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
  /** La cle de traduction, quand l'entree en a une. Sinon, `label`. */
  cle?: CleTraduction;
}

const PRIMARY: NavEntry[] = [
  { href: HOME, label: "Direct", cle: "nav.direct", Icon: Flame, exact: true },
  { href: "/actus", label: "Actus", cle: "nav.actus", Icon: Newspaper },
];

/**
 * Les portes d'entree du produit, autrefois repliees dans un menu « Extra ».
 *
 * Le repli partait d'une bonne intention, ce sont des actions, pas des
 * sections, mais il enterrait trois pages faites pour etre trouvees par
 * quelqu'un qui ne connait pas encore le produit. Une page d'acquisition
 * derriere un menu deroulant est une page qu'on ne lit pas.
 *
 * Les libelles portent le nom de produit complet, c'est ainsi que ces trois
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
    href: "/scoreurs", label: "Koppafoot Score", Icon: Radio, newTab: true,
    blurb: "Tenir la console d'un match, et faire vivre le direct pour ceux qui n'y sont pas.",
  },
  {
    href: "/terrains", label: "MyFields", Icon: MapPin, newTab: true,
    blurb: "Référencer un terrain et se rendre trouvable par les équipes.",
  },
];


/**
 * La Tribune does not exist for a visitor: its posts are gated behind
 * `isAuthenticated()` in firestore.rules, so a guest was being offered a
 * door onto an empty room, and the rail behind it spent every page load
 * failing to read authors. Signed in, it takes its place in the menu.
 */
const TRIBUNE: NavEntry = { href: "/feed", label: "La Tribune", Icon: Globe };

// The sidebar's role destinations, now reached from the avatar menu.

const MENU_CLASS =
  "absolute right-0 top-full z-50 mt-2 max-h-[80vh] w-80 overflow-y-auto border border-gray-200/70 bg-white shadow-xl";

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
 * « Espace [role] », tout ce que CE compte peut faire, en un seul menu.
 *
 * Ces destinations vivaient dans le menu avatar, derriere une photo de
 * profil. On y cherchait « Mes equipes » ou « Mercato » dans un endroit qui
 * annonce un compte, pas un espace de travail, et le Mercato, lui, occupait
 * une place de la barre alors qu'il ne concerne qu'un role.
 *
 * Le menu porte le nom du role parce que c'est ainsi qu'on se pense en
 * l'ouvrant : on va « dans son espace joueur », pas « dans son profil ».
 *
 * Deux familles, separees par un filet : ce que le ROLE donne (equipes,
 * convocations, mercato) et ce que les CASQUETTES donnent (organisateur,
 * console live, terrains). Un compte peut cumuler les deux, et la separation
 * dit visuellement que ce ne sont pas des choses de meme nature.
 */
/**
 * Un bloc du megamenu, en grille d'icones.
 *
 * Une grille plutot qu'une liste : ces entrees sont des DESTINATIONS de meme
 * rang, pas les etapes d'une lecture. Une colonne de lignes suggere un ordre
 * de parcours qui n'existe pas, et fait descendre la derniere entree bien
 * plus bas que la premiere alors qu'aucune ne prime.
 *
 * `gap-px` sur un fond gris : les filets entre cellules sont les interstices
 * de la grille, pas des bordures a compter cellule par cellule.
 *
 * Hors du rendu de son parent : defini a l'interieur, React le recreerait a
 * chaque passage et remonterait tous ses enfants.
 */
function EspaceGroupe({ items, onPick }: { items: NavEntry[]; onPick: () => void }) {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-px bg-gray-200/70">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onPick}
          className="group flex flex-col items-center gap-2 bg-white px-2 py-5 text-center transition-colors hover:bg-gray-50"
        >
          <item.Icon
            size={22}
            strokeWidth={1.5}
            className="text-gray-300 transition-colors group-hover:text-emerald-600"
          />
          <span className="text-[10px] font-black uppercase leading-tight tracking-[0.08em] text-gray-700">
            {item.label}
          </span>
        </Link>
      ))}
    </div>
  );
}

function EspaceMenu({
  label, Icon, roleItems, hatItems,
}: {
  label: string;
  Icon: LucideIcon;
  roleItems: NavEntry[];
  hatItems: NavEntry[];
}) {
  const { open, setOpen, boxRef } = useDropdown();

  if (roleItems.length === 0 && hatItems.length === 0) return null;

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] font-black uppercase tracking-[0.1em] transition-colors ${open ? "bg-white/15 text-white" : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
          }`}
      >
        <Icon size={17} className={open ? "text-amber-300" : "text-emerald-300/70"} />
        {label}
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[21rem] overflow-hidden border border-gray-200/70 bg-white shadow-xl">
          <EspaceGroupe items={roleItems} onPick={() => setOpen(false)} />

          {/* Deux familles : ce que le ROLE donne, et ce que les CASQUETTES
              donnent. Le libelle dit pourquoi elles ne se melangent pas. */}
          {roleItems.length > 0 && hatItems.length > 0 && (
            <p className="border-y border-gray-200/70 bg-gray-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
              Mes casquettes
            </p>
          )}

          <EspaceGroupe items={hatItems} onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/**
 * « Koppa Links », les portes du produit, repliees dans un megamenu.
 *
 * Une fois connecte, la barre portait sept entrees : Direct, Actus, Mercato,
 * la Tribune et les trois portes. Les trois portes sont celles qui QUITTENT
 * l'application, nouvel onglet, site de presentation. Les replier laisse
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
        className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] font-black uppercase tracking-[0.1em] transition-colors ${open ? "bg-white/15 text-white" : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
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

/**
 * « Koppa Links » en mobile : une feuille, meme contenu que le megamenu.
 *
 * Les trois portes vivaient dans la rangee du header, masquee sous `lg`,
 * donc invisibles sur telephone. On avait nomme et dessine trois espaces
 * d'acquisition que la moitie des visiteurs ne pouvait pas atteindre.
 *
 * Une feuille montante plutot qu'un menu deroulant : sur un ecran de 375px,
 * un panneau ancre en haut a droite deborde ou se colle au bord.
 */
function KoppaLinksSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Koppa Links">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* `bottom-[var(--bottomnav-h)]` : la feuille s'arrete AU-DESSUS de la
          barre du bas, qui est fixee et flottait par-dessus, le dernier lien,
          MyFields, passait dessous et devenait illisible et intouchable.
          `max-h` + defilement pour le cas ou trois portes ne tiendraient pas
          sur un petit ecran. */}
      <div className="absolute inset-x-0 bottom-[var(--bottomnav-h,0px)] max-h-[70vh] overflow-y-auto border-t border-gray-200/70 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200/70 px-5 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
            Koppa Links
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 text-gray-400 transition-colors hover:text-gray-900"
          >
            <X size={18} />
          </button>
        </div>

        {ENTRIES.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-start gap-4 border-b border-gray-200/70 px-5 py-5 last:border-b-0 active:bg-gray-50"
          >
            <item.Icon size={24} strokeWidth={1.5} className="mt-0.5 shrink-0 text-gray-300" />
            <span className="min-w-0">
              <span className="block font-display text-lg font-black uppercase leading-tight tracking-tight text-gray-900">
                {item.label}
              </span>
              <span className="mt-1 block text-[13px] font-medium leading-relaxed text-gray-500">
                {item.blurb}
              </span>
            </span>
            <ArrowUpRight size={16} className="mt-1 shrink-0 text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}


// ---- Account: the one menu on the right --------------------------------------


/**
 * Le menu du compte, connecte ou non.
 *
 * Deconnecte, ce bouton ouvrait directement la boite de connexion, et tout
 * ce qu'il contient, l'invitation, l'aide, les preferences, disparaissait
 * avec le compte. Or rien la-dedans ne demande d'etre identifie : on peut
 * partager le lien de l'appli, lire l'aide et regarder les preferences sans
 * avoir de compte, et ce sont justement les gestes d'un visiteur.
 *
 * Le menu est donc le meme dans les deux etats. Seule sa tete change : la
 * fiche profil quand on a un compte, le bouton de connexion sinon. La boite
 * de dialogue, elle, ne disparait pas, elle reste ce qu'elle etait, ouverte
 * depuis ce bouton comme depuis les pages qui demandent un compte.
 */
function AccountMenu() {
  const { user, logout } = useAuth();
  const t = useT();
  const router = useRouter();
  const authModal = useAuthModal();
  const { open, setOpen, boxRef } = useDropdown();

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?"
    : "";

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={user ? t("compte.monCompte") : t("compte.compteEtReglages")}
        className="flex items-center gap-1 rounded-full p-0.5 pr-1 transition-colors hover:bg-white/10"
      >
        {user?.profilePictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.profilePictureUrl}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-white/20"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xs font-black text-white">
            {user ? initials : <User size={18} />}
          </span>
        )}
        <ChevronDown size={13} className="hidden text-emerald-200/70 sm:block" />
      </button>

      {open && (
        <div className={MENU_CLASS}>
          {user ? (
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="block border-b border-gray-200/70 px-4 py-3 transition-colors hover:bg-gray-50"
            >
              <span className="block truncate text-[13px] font-black text-gray-900">
                {user.firstName} {user.lastName}
              </span>
              <span className="block truncate text-[11px] font-bold text-gray-400">
                {t("compte.voirMonProfil")}
              </span>
            </Link>
          ) : (
            /* La meme place, l'autre geste. Une boite de dialogue et non une
               page : personne ne perd le match qu'il etait en train de lire. */
            <div className="border-b border-gray-200/70 p-3">
              <p className="mt-2 px-1 pb-2 text-[11px] font-semibold leading-relaxed font-display text-base font-black uppercase tracking-tight">
                {t("compte.faitesPlus")}
              </p>
              <button
                type="button"
                onClick={() => { setOpen(false); authModal.open(); }}
                className="flex w-full items-center justify-center gap-2 border border-gray-900 bg-gray-900 px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
              >
                <LogIn size={14} />
                {t("compte.seConnecter")}
              </button>
              {/* <p className="mt-2 px-1 text-[11px] font-semibold leading-relaxed text-gray-400">
                Suivre une équipe, pronostiquer, publier dans la Tribune : tout
                cela demande un compte. Le reste se lit sans.
              </p> */}
            </div>
          )}

          {/* Ni destinations de role ni casquettes ici : elles sont dans
              « MySpace », dans la barre. Une photo de profil annonce un
              compte, on n'y cherche pas « Mes equipes ». Ce menu ne garde
              que ce qui touche vraiment au compte. */}

          {/* Partager l'appli ne demande pas de compte : c'est le lien public
              qui part, et un visiteur convaincu est le meilleur porteur. */}
          <div className="border-t border-gray-200/70 p-3">
            <InviteCard firstName={user?.firstName} />
          </div>

          <div className="border-t border-gray-200/70">
            <SupportBlock onNavigate={() => setOpen(false)} />
          </div>

          <div className="border-t border-gray-200/70 pb-2">
            <InstallBlock />
            <NotificationsBlock />
            <PreferencesBlock />
          </div>

          {user && (
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await logout();
                // Home is public, no reason to send anyone to a login screen.
                router.push("/");
              }}
              className="flex w-full items-center gap-2.5 border-t border-gray-200/70 px-4 py-3 text-left transition-colors hover:bg-gray-50"
            >
              <LogOut size={15} className="shrink-0 text-gray-400" />
              <span className="text-[13px] font-bold text-gray-500">{t("compte.seDeconnecter")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---- The band ----------------------------------------------------------------

/**
 * Le header publie sa hauteur reelle dans `--header-h`.
 *
 * Les heros collants des pages s'y epinglent. Ils portaient jusqu'ici un
 * offset devine, `top-16` puis `lg:top-[72px]`, qui tombait juste en
 * desktop et faux en mobile : le header y mesure 78px a cause de `pt-safe`
 * et de la rangee plus haute, si bien que chaque hero glissait 14px SOUS le
 * header en defilant. Un chiffre ecrit a la main dans sept fichiers ne peut
 * pas suivre une hauteur qui depend du terminal.
 *
 * `ResizeObserver` plutot qu'une mesure au montage : la hauteur change avec
 * la rotation, l'encoche, et le passage d'un point de rupture a l'autre.
 */
function useHeaderHeight() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publier = () => {
      document.documentElement.style.setProperty(
        "--header-h",
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    };
    publier();

    // `border-box` explicitement : la hauteur du header change par son
    // PADDING (`py-3` en mobile, `lg:py-4` au-dessus). La boite de contenu,
    // elle, ne bouge pas d'un pixel, et `ResizeObserver` l'observe par
    // defaut, donc il ne se declenchait jamais au passage d'un point de
    // rupture. La variable restait figee sur la valeur du premier rendu.
    const ro = new ResizeObserver(publier);
    ro.observe(el, { box: "border-box" });

    // Ceinture et bretelles : une rotation de telephone change la hauteur
    // sans forcement passer par l'observateur selon le navigateur.
    window.addEventListener("resize", publier);
    window.addEventListener("orientationchange", publier);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", publier);
      window.removeEventListener("orientationchange", publier);
    };
  }, []);

  return ref;
}

export default function ScoreHeader() {
  const t = useT();
  const headerRef = useHeaderHeight();
  const { user } = useAuth();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const espaces = useEspaces();

  return (
    // Colle en haut : sur un tableau de scores on defile beaucoup, et
    // remonter chercher la navigation a chaque fois est un aller-retour
    // inutile. z-40 passe au-dessus du contenu sans couvrir les modales.
    <header ref={headerRef} className="sticky top-0 z-40 bg-emerald-900 pt-safe">
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
                {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] font-black uppercase tracking-[0.1em] transition-colors ${active
                  ? "bg-white/15 text-white"
                  : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
                  }`}
              >
                <item.Icon size={17} className={active ? "text-amber-300" : "text-emerald-300/70"} />
                {item.cle ? t(item.cle) : item.label}
              </Link>
            );
          })}

          {/* L'invitation a choisir un role, en jaune plein contraste : c'est
              le geste qui donne acces au reste du produit. Elle vaut pour un
              visiteur (-> /roles, la page PUBLIQUE) comme pour un compte sans
              role encore choisi (-> /evolution) — mais s'efface des qu'un
              role est actif, remplacee plus loin par l'espace du compte
              (EspaceMenu) : le sujet est alors traite, le repeter serait du
              bruit. Meme regle qu'en bas d'un telephone, voir
              MobileBottomNav. */}
          {(!user || !user.evolutionRole) && (
            <Link
              href={user ? "/evolution" : "/roles"}
              className="flex shrink-0 items-center gap-2 border border-amber-300 bg-amber-300 px-3.5 py-2.5 text-[13px] font-black uppercase tracking-[0.1em] text-gray-900 transition-colors hover:border-white hover:bg-white"
            >
              <Rocket size={16} />
              Evolution
            </Link>
          )}

          {/* L'espace du compte : son role et ses casquettes. Il remplace le
              Mercato, qui ne concernait qu'une partie des comptes et occupait
              pourtant une place de la rangee principale. */}
          {espaces && (
            <EspaceMenu
              label={espaces.label}
              Icon={espaces.Icon}
              roleItems={espaces.roleItems}
              hatItems={espaces.hatItems}
            />
          )}

          {/* Les trois portes, repliees, la barre garde la navigation
              interne, le megamenu porte ce qui sort de l'application. */}
          <KoppaLinksMenu />
        </nav>

        {/* A field on a pointer, an icon on a phone, both open the same
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
            {t("nav.recherche")}
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

          {/* Les trois portes : une feuille, puisque la rangee qui les porte
              en desktop est masquee ici. */}
          <button
            type="button"
            onClick={() => setLinksOpen(true)}
            aria-label="Koppa Links"
            className="flex h-11 w-11 items-center justify-center rounded-full text-emerald-100/80 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <LinkIcon size={22} />
          </button>

          {/* La Tribune, mobile only and members only: the tab bar leaves it
              out (see MEMBER_BOTTOM), so dropping it here would strand it. */}
          {user && (
            <Link
              href="/feed"
              aria-label="La Tribune"
              aria-current={pathname.startsWith("/feed") ? "page" : undefined}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors lg:hidden ${pathname.startsWith("/feed")
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
          {/* Le menu avatar disparait du telephone : la barre du bas porte
              deja « Moi » et « Espace », et le doubler en haut encombrait un
              header qui compte six commandes sur 375px. Ses entrees ont
              rejoint les deux feuilles du bas. */}
          <div className="hidden lg:block">
            <AccountMenu />
          </div>
        </div>
      </div>

      {/* Au bas du header, et donc calee sur sa hauteur reelle quoi qu'il
          arrive : `pt-safe` et l'encoche la deplacent avec lui. */}
      <HeaderProgress />

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      <KoppaLinksSheet open={linksOpen} onClose={() => setLinksOpen(false)} />
    </header>
  );
}
