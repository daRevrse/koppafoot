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
// Player / Manager / Referee — Grouped
// ============================================

const PLAYER_GROUPED: NavEntry[] = [
  { path: "/dashboard", icon: "Home", label: "Tableau de bord", exact: true },
  {
    key: "vestiaire",
    label: "Vestiaire",
    icon: "Shirt",
    items: [
      { path: "/teams", icon: "Users", label: "Mes équipes" },
      { path: "/mercato", icon: "UserSearch", label: "Mercato", badge: true },
    ],
  },
  {
    key: "matchs",
    label: "Matchs",
    icon: "Trophy",
    items: [
      { path: "/participations", icon: "CheckCircle", label: "Participations", badge: true },
      { path: "/calendar", icon: "Calendar", label: "Calendrier" },
    ],
  },
  {
    key: "communaute",
    label: "Communauté",
    icon: "Globe",
    items: [
      { path: "/venues", icon: "MapPin", label: "Terrains" },
      { path: "/feed", icon: "MessageCircle", label: "La Tribune" },
    ],
  },
];

const MANAGER_GROUPED: NavEntry[] = [
  { path: "/dashboard", icon: "Home", label: "Tableau de bord", exact: true },
  {
    key: "equipe",
    label: "Mon équipe",
    icon: "Shield",
    items: [
      { path: "/teams", icon: "Users", label: "Mes équipes" },
      { path: "/mercato", icon: "UserSearch", label: "Mercato", badge: true },
    ],
  },
  {
    key: "competition",
    label: "Compétition",
    icon: "Trophy",
    items: [
      { path: "/matches", icon: "Trophy", label: "Matchs", badge: true },
      { path: "/calendar", icon: "Calendar", label: "Calendrier" },
    ],
  },
  {
    key: "communaute",
    label: "Communauté",
    icon: "Globe",
    items: [
      { path: "/venues", icon: "MapPin", label: "Terrains" },
      { path: "/feed", icon: "MessageCircle", label: "La Tribune" },
    ],
  },
];

const REFEREE_GROUPED: NavEntry[] = [
  { path: "/dashboard", icon: "Home", label: "Tableau de bord", exact: true },
  {
    key: "arbitrage",
    label: "Arbitrage",
    icon: "ShieldCheck",
    items: [
      { path: "/referee/find-matches", icon: "Search", label: "Trouver match" },
      { path: "/referee/matches", icon: "ShieldCheck", label: "Mes matchs" },
      { path: "/referee/reports", icon: "FileText", label: "Rapports" },
    ],
  },
  {
    key: "planning",
    label: "Planning",
    icon: "Calendar",
    items: [
      { path: "/calendar", icon: "Calendar", label: "Calendrier" },
    ],
  },
  {
    key: "communaute",
    label: "Communauté",
    icon: "MessageCircle",
    items: [
      { path: "/feed", icon: "MessageCircle", label: "La Tribune" },
    ],
  },
];

export const ROLE_GROUPED_NAV: Partial<Record<UserRole, NavEntry[]>> = {
  player: PLAYER_GROUPED,
  manager: MANAGER_GROUPED,
  referee: REFEREE_GROUPED,
};

// ============================================
// Venue Owner — Grouped
// ============================================

export const VENUE_OWNER_GROUPED_NAV: NavEntry[] = [
  { path: "/venue-owner", icon: "LayoutDashboard", label: "Tableau de bord", exact: true },
  {
    key: "gestion",
    label: "Gestion",
    icon: "Building2",
    items: [
      { path: "/venue-owner/bookings", icon: "Calendar", label: "Réservations" },
      { path: "/venue-owner/stats", icon: "TrendingUp", label: "Statistiques" },
    ],
  },
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
    key: "competition",
    label: "Compétition",
    icon: "Trophy",
    items: [
      { path: "/admin/teams", icon: "Shield", label: "Équipes" },
      { path: "/admin/matches", icon: "Trophy", label: "Matchs" },
      { path: "/admin/venues", icon: "MapPin", label: "Terrains" },
      { path: "/admin/referees", icon: "Award", label: "Arbitres" },
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
      { path: "/admin/settings", icon: "Settings", label: "Paramètres" },
    ],
  },
];

// ============================================
// Legacy flat exports (backward compat)
// ============================================

const PLAYER_NAV: NavItem[] = [
  { path: "/dashboard", icon: "Home", label: "Tableau de bord", exact: true },
  { path: "/teams", icon: "Users", label: "Mes équipes" },
  { path: "/mercato", icon: "UserSearch", label: "Mercato", badge: true },
  { path: "/participations", icon: "CheckCircle", label: "Participations", badge: true },
  { path: "/venues", icon: "MapPin", label: "Terrains" },
  { path: "/calendar", icon: "Calendar", label: "Calendrier" },
  { path: "/feed", icon: "MessageCircle", label: "La Tribune" },
];

const MANAGER_NAV: NavItem[] = [
  { path: "/dashboard", icon: "Home", label: "Tableau de bord", exact: true },
  { path: "/teams", icon: "Users", label: "Mes équipes" },
  { path: "/matches", icon: "Trophy", label: "Matchs" },
  { path: "/mercato", icon: "UserSearch", label: "Mercato", badge: true },
  { path: "/venues", icon: "MapPin", label: "Terrains" },
  { path: "/calendar", icon: "Calendar", label: "Calendrier" },
  { path: "/feed", icon: "MessageCircle", label: "La Tribune" },
];

const REFEREE_NAV: NavItem[] = [
  { path: "/dashboard", icon: "Home", label: "Tableau de bord", exact: true },
  { path: "/referee/matches", icon: "ShieldCheck", label: "Mes matchs" },
  { path: "/referee/reports", icon: "FileText", label: "Rapports" },
  { path: "/calendar", icon: "Calendar", label: "Calendrier" },
  { path: "/feed", icon: "MessageCircle", label: "La Tribune" },
];

export const ROLE_NAV: Partial<Record<UserRole, NavItem[]>> = {
  player: PLAYER_NAV,
  manager: MANAGER_NAV,
  referee: REFEREE_NAV,
};

export const VENUE_OWNER_NAV: NavItem[] = [
  { path: "/venue-owner", icon: "LayoutDashboard", label: "Tableau de bord", exact: true },
  { path: "/venue-owner/bookings", icon: "Calendar", label: "Réservations" },
  { path: "/venue-owner/stats", icon: "TrendingUp", label: "Statistiques" },
];

export const ADMIN_NAV: NavItem[] = [
  { path: "/admin", icon: "LayoutDashboard", label: "Dashboard", exact: true },
  { path: "/admin/users", icon: "Users", label: "Utilisateurs" },
  { path: "/admin/teams", icon: "Shield", label: "Équipes" },
  { path: "/admin/matches", icon: "Trophy", label: "Matchs" },
  { path: "/admin/venues", icon: "MapPin", label: "Terrains" },
  { path: "/admin/referees", icon: "Award", label: "Arbitres" },
  { path: "/admin/reports", icon: "Flag", label: "Signalements" },
  { path: "/admin/bans", icon: "AlertTriangle", label: "Bannissements" },
  { path: "/admin/logs", icon: "FileText", label: "Logs" },
  { path: "/admin/stats", icon: "TrendingUp", label: "Statistiques" },
  { path: "/admin/settings", icon: "Settings", label: "Paramètres" },
];

// ============================================
// Role display config
// ============================================

export const ROLE_HEADER_TITLES: Partial<Record<UserRole, string>> = {
  player: "Espace Joueur",
  manager: "Espace Manager",
  referee: "Espace Arbitre",
};

export const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  player: "bg-emerald-100 text-emerald-700",
  manager: "bg-blue-100 text-blue-700",
  referee: "bg-purple-100 text-purple-700",
  venue_owner: "bg-orange-100 text-orange-700",
  superadmin: "bg-red-100 text-red-700",
};
