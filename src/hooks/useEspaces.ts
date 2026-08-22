"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList, Radio, MapPin, CalendarDays, Shield, Store, Inbox,
  User, Briefcase, Flag, LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listModeratedCompetitions } from "@/lib/competition-firestore";
import { isOrganizer, isVenueOwner } from "@/lib/hats";
import { ROLE_DESTINATIONS } from "@/config/role-destinations";
import { useT } from "@/i18n";
import type { EvolutionRole } from "@/types";

// ============================================
// Ce qu'un compte peut ouvrir : son rôle d'un côté, ses casquettes de l'autre.
//
// Ce calcul a existé en DEUX exemplaires, un dans le header, un dans la
// barre du bas, et ils avaient déjà divergé : le mercato n'était que dans le
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

/**
 * L'icone suit le role ; le NOM du menu, non.
 *
 * Il s'appelle « MySpace » pour tout le monde : un compte cumule un role et
 * des casquettes, et « Espace joueur » mentait des qu'un joueur organisait
 * aussi une competition, le menu contenait alors deux familles dont une
 * seule etait nommee.
 */
const ROLE_ICONS: Record<EvolutionRole, LucideIcon> = {
  player: User,
  manager: Briefcase,
  referee: Flag,
};

const NOM_DU_MENU = "MySpace";

export interface Espaces {
  /** Le nom du menu, le même pour tous : « MySpace ». */
  label: string;
  Icon: LucideIcon;
  /** Ce que le rôle donne. */
  roleItems: Espace[];
  /** Ce que les casquettes donnent, cumulables, indépendantes du rôle. */
  hatItems: Espace[];
}

export function useEspaces(): Espaces | null {
  const { user } = useAuth();
  const t = useT();
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
    roleItems.push({ href: "/mercato", label: t("espace.mercato"), Icon: Store });
    // Demander un creneau ne demande aucune casquette : cette page suit le
    // role, pas la propriete d'un terrain. Elle etait rangee du cote des
    // casquettes, donc invisible pour ceux qui reservent vraiment.
    roleItems.push({ href: "/mes-reservations", label: t("espace.mesReservations"), Icon: CalendarDays });
  }

  // Les casquettes nomment leur DESTINATION, pas un « espace ». « Espace
  // organisateur » dans un menu intitulé « Espace joueur » disait deux fois
  // le mot et une seule fois l'information.
  const hatItems: Espace[] = [];
  if (isOrganizer(user)) {
    // « Nouvelle competition » n'est pas ici : c'est une ACTION, pas une
    // destination, et elle vit deja en tete de l'espace organisateur. Un menu
    // de navigation qui propose de creer quelque chose melange deux gestes.
    hatItems.push({ href: "/organizer", label: t("espace.competitionsOrganisees"), Icon: ClipboardList });
  }
  if (moderates) {
    hatItems.push({ href: "/live-ops", label: t("espace.consoleLive"), Icon: Radio });
  }
  if (isVenueOwner(user)) {
    hatItems.push({ href: "/mes-terrains", label: t("espace.mesTerrains"), Icon: MapPin });
    // Les demandes RECUES, et non /mes-reservations qui liste celles qu'on a
    // faites ailleurs. Un proprietaire cliquait sur « Réservations » et
    // tombait sur sa page de client, sans jamais voir ce qu'on lui demandait.
    hatItems.push({ href: "/mes-terrains/reservations", label: t("espace.reservationsRecues"), Icon: Inbox });
  }
  if (user.userType === "superadmin") {
    hatItems.push({ href: "/admin", label: t("espace.administration"), Icon: Shield });
  }

  return {
    label: NOM_DU_MENU,
    // L'icone, elle, dit le role, c'est le seul endroit ou il se lit d'un
    // coup d'oeil dans la barre.
    Icon: (user.evolutionRole ? ROLE_ICONS[user.evolutionRole] : null) ?? LayoutGrid,
    roleItems,
    hatItems,
  };
}
