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
// Member — unified nav (competition-first scope)
// ============================================
// Post-pivot: the same simple navigation for everyone, including guests
// (the home shell is public — auth only unlocks privileges). Legacy roles
// (manager/referee/venue_owner) map to the member nav until their
// verticals come back from _shelved.

export const MEMBER_NAV: NavEntry[] = [
  { path: "/", icon: "Home", label: "Direct", exact: true },
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

// ============================================
// Organizer — Grouped
// ============================================

export const ORGANIZER_GROUPED_NAV: NavEntry[] = [
  { path: "/organizer", icon: "Trophy", label: "Mes compétitions", exact: true },
];

// ============================================
// Admin — Grouped
// ============================================

export const ADMIN_GROUPED_NAV: NavEntry[] = [
  { path: "/admin", icon: "LayoutDashboard", label: "Dashboard", exact: true },
  {
    key: "utilisateurs",
    label: "Utilisateurs",
    icon: "Users",
    items: [
      { path: "/admin/users", icon: "Users", label: "Utilisateurs" },
      { path: "/admin/bans", icon: "AlertTriangle", label: "Bannissements" },
    ],
  },
  {
    key: "moderation",
    label: "Modération",
    icon: "Flag",
    items: [
      { path: "/admin/reports", icon: "Flag", label: "Signalements" },
      { path: "/admin/logs", icon: "FileText", label: "Logs" },
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
  label: string;
  badge?: boolean;
  exact?: boolean;
}

export const MEMBER_BOTTOM: BottomNavItem[] = [
  { path: "/", icon: "Home", label: "Direct", exact: true },
  { path: "/competitions", icon: "Trophy", label: "Compétitions" },
  { path: "/feed", icon: "MessageCircle", label: "Tribune" },
];

export const ROLE_BOTTOM_NAV: Partial<Record<UserRole, BottomNavItem[]>> = {
  player: MEMBER_BOTTOM,
  manager: MEMBER_BOTTOM,
  referee: MEMBER_BOTTOM,
  venue_owner: MEMBER_BOTTOM,
  organizer: MEMBER_BOTTOM,
  superadmin: MEMBER_BOTTOM,
};
