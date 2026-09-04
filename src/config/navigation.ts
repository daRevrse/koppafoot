import type { CleTraduction } from "@/i18n/fr";
import type { UserRole } from "@/types";

// ============================================
// Types
// ============================================

export interface NavItem {
  path: string;
  icon: string; // lucide-react icon name
  label: string;
  badge?: boolean; // show dynamic badge count
  exact?: boolean; // exact path match for active state
}

export interface NavGroup {
  key: string;
  label: string;
  icon: string;
  items: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

// ============================================
// Member, unified nav (competition-first scope)
// ============================================
// Post-pivot: the same simple navigation for everyone, including guests
// (the home shell is public, auth only unlocks privileges). Legacy roles
// (manager/referee/venue_owner) map to the member nav until their
// verticals come back from _shelved.

export const MEMBER_NAV: NavEntry[] = [
  { path: "/", icon: "Flame", label: "Direct", exact: true },
  { path: "/competitions", icon: "Trophy", label: "Compétitions" },
  { path: "/feed", icon: "MessageCircle", label: "La Tribune" },
];

export const ROLE_GROUPED_NAV: Partial<Record<UserRole, NavEntry[]>> = {
  player: MEMBER_NAV,
  manager: MEMBER_NAV,
  referee: MEMBER_NAV,
  venue_owner: MEMBER_NAV,
  organizer: MEMBER_NAV,
  superadmin: MEMBER_NAV,
};

// Organizer navigation used to live here, feeding a dedicated
// OrganizerSidebar. The organizer space now renders inside the shared app
// shell, so its entries are declared with the other spaces in AppSidebar.

// ============================================
// Admin, Grouped
// ============================================

export const ADMIN_GROUPED_NAV: NavEntry[] = [
  { path: "/admin", icon: "LayoutDashboard", label: "Dashboard", exact: true },
  {
    key: "utilisateurs",
    label: "Utilisateurs",
    icon: "Users",
    items: [
      { path: "/admin/users", icon: "Users", label: "Utilisateurs" },
      { path: "/admin/organizers", icon: "ClipboardList", label: "Organisateurs" },
      { path: "/admin/scorers", icon: "Radio", label: "Scoreurs" },
      // « Terrains » tout court désignait CETTE page — la relecture des
      // candidatures — alors que /admin/venues, qui liste les terrains
      // publiés, n'était dans aucun menu. Deux pages voisines, un seul nom, et
      // celle qu'on cherchait était l'invisible.
      { path: "/admin/terrains", icon: "MapPin", label: "Candidatures terrain" },
    ],
  },
  {
    key: "contenu",
    label: "Contenu",
    icon: "Shield",
    items: [
      { path: "/admin/tribune", icon: "Megaphone", label: "Tribune" },
      { path: "/admin/teams", icon: "Shield", label: "Équipes" },
      { path: "/admin/venues", icon: "MapPin", label: "Terrains référencés" },
      { path: "/admin/matches", icon: "Trophy", label: "Matchs" },
      { path: "/admin/competitions", icon: "Trophy", label: "Compétitions" },
    ],
  },
  {
    key: "systeme",
    label: "Système",
    icon: "Settings",
    items: [
      { path: "/admin/stats", icon: "TrendingUp", label: "Statistiques" },
      { path: "/admin/messages", icon: "MessageSquare", label: "Messages" },
      { path: "/admin/campaigns", icon: "Megaphone", label: "Campagnes" },
      { path: "/admin/settings", icon: "Settings", label: "Paramètres" },
    ],
  },
];

// ============================================
// Role display config
// ============================================

export const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  player: "bg-emerald-100 text-emerald-700",
  manager: "bg-emerald-100 text-emerald-700",
  referee: "bg-emerald-100 text-emerald-700",
  venue_owner: "bg-emerald-100 text-emerald-700",
  organizer: "bg-amber-100 text-amber-700",
  superadmin: "bg-red-100 text-red-700",
};

// ============================================
// Mobile Bottom Navigation
// ============================================

export interface BottomNavItem {
  path: string;
  icon: string;   // lucide-react icon name
  /** Le libelle en francais, qui sert de repli si `cle` manque. */
  label: string;
  /**
   * La cle de traduction, quand l'entree en a une.
   *
   * Elle est facultative pour que ce fichier reste utilisable tel quel :
   * une entree ajoutee sans cle s'affiche en francais partout, ce qui est
   * lisible, plutot que de casser la barre le jour ou on oublie de la
   * declarer dans le dictionnaire.
   */
  cle?: CleTraduction;
  badge?: boolean;
  exact?: boolean;
}

// La Tribune is deliberately absent here: on mobile it lives in the header,
// next to the notification bell, so the tab bar keeps room for the role
// spaces (organisateur / live / évolution) that used to be buried in the
// profile sheet.
/**
 * Les deux sections de LECTURE de la barre du bas.
 *
 * « Compétitions » en est sortie : l'annuaire s'atteint depuis le Direct,
 * qui les liste déjà, alors qu'Actus n'était atteignable de nulle part en
 * mobile, la rangée du header qui la porte est masquée sous `lg`.
 *
 * Les deux places suivantes ne sont pas des liens fixes : l'espace du compte
 * (ou Evolution s'il n'a pas encore de rôle) et le bouton « Moi ». Voir
 * MobileBottomNav.
 */
export const MEMBER_BOTTOM: BottomNavItem[] = [
  { path: "/", icon: "Flame", label: "Direct", cle: "nav.direct", exact: true },
  { path: "/actus", icon: "Newspaper", label: "Actus", cle: "nav.actus" },
];

export const ROLE_BOTTOM_NAV: Partial<Record<UserRole, BottomNavItem[]>> = {
  player: MEMBER_BOTTOM,
  manager: MEMBER_BOTTOM,
  referee: MEMBER_BOTTOM,
  venue_owner: MEMBER_BOTTOM,
  organizer: MEMBER_BOTTOM,
  superadmin: MEMBER_BOTTOM,
};
