"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList, Plus, Radio, MapPin, CalendarDays, Shield, Store,
  User, Briefcase, Flag, LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listModeratedCompetitions } from "@/lib/competition-firestore";
import { isOrganizer, isVenueOwner } from "@/lib/hats";
import { ROLE_DESTINATIONS } from "@/config/role-destinations";
import type { EvolutionRole } from "@/types";

// ============================================
// Ce qu'un compte peut ouvrir : son rôle d'un côté, ses casquettes de l'autre.
//
// Ce calcul a existé en DEUX exemplaires — un dans le header, un dans la
// barre du bas — et ils avaient déjà divergé : le mercato n'était que dans le
// premier, une entrée redondante « Espace joueur » que dans le second. C'est
// le genre d'écart qu'on ne voit jamais en relisant un seul des deux fichiers.
//
// Une seule source, donc, et les deux navigations la consomment.
// ============================================

export interface Espace {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const ROLE_META: Record<EvolutionRole, { label: string; Icon: LucideIcon }> = {
  player: { label: "Espace joueur", Icon: User },
  manager: { label: "Espace manager", Icon: Briefcase },
  referee: { label: "Espace arbitre", Icon: Flag },
};

export interface Espaces {
  /** Le nom du menu lui-même : « Espace joueur », « Mes espaces »… */
  label: string;
  Icon: LucideIcon;
  /** Ce que le rôle donne. */
  roleItems: Espace[];
  /** Ce que les casquettes donnent — cumulables, indépendantes du rôle. */
  hatItems: Espace[];
}

export function useEspaces(): Espaces | null {
  const { user } = useAuth();
  const [moderates, setModerates] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listModeratedCompetitions(user.uid)
      .then((comps) => { if (!cancelled) setModerates(comps.length > 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;

  // Pas d'entrée « Espace joueur » vers /evolution : le menu s'appelle DÉJÀ
  // « Espace joueur ». Une ligne qui répète le titre de son propre menu
  // occupe une case et n'apprend rien.
  const roleItems: Espace[] = user.evolutionRole
    ? [...(ROLE_DESTINATIONS[user.evolutionRole] ?? [])]
    : [];

  // Le mercato ne concerne que ceux qui jouent ou recrutent.
  if (user.evolutionRole === "player" || user.evolutionRole === "manager") {
    roleItems.push({ href: "/mercato", label: "Mercato", Icon: Store });
  }

  // Les casquettes nomment leur DESTINATION, pas un « espace ». « Espace
  // organisateur » dans un menu intitulé « Espace joueur » disait deux fois
  // le mot et une seule fois l'information.
  const hatItems: Espace[] = [];
  if (isOrganizer(user)) {
    hatItems.push({ href: "/organizer", label: "Compétitions organisées", Icon: ClipboardList });
    hatItems.push({ href: "/organizer/competitions/new", label: "Nouvelle compétition", Icon: Plus });
  }
  if (moderates) {
    hatItems.push({ href: "/live-ops", label: "Console live", Icon: Radio });
  }
  if (isVenueOwner(user)) {
    hatItems.push({ href: "/mes-terrains", label: "Mes terrains", Icon: MapPin });
    hatItems.push({ href: "/mes-reservations", label: "Réservations", Icon: CalendarDays });
  }
  if (user.userType === "superadmin") {
    hatItems.push({ href: "/admin", label: "Administration", Icon: Shield });
  }

  const meta = user.evolutionRole ? ROLE_META[user.evolutionRole] : null;
  return {
    // Sans rôle mais avec des casquettes — un organisateur qui n'a pas encore
    // choisi ce qu'il est sur le terrain — le menu s'appelle « Mes espaces ».
    label: meta?.label ?? "Mes espaces",
    Icon: meta?.Icon ?? LayoutGrid,
    roleItems,
    hatItems,
  };
}
