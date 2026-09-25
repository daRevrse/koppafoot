"use client";

import { useEffect, useState } from "react";
import {
  Radio, MapPin, Shield, Inbox, Ticket, Trophy,
  LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listModeratedCompetitions } from "@/lib/competition-firestore";
import { getMatchesIModerate } from "@/lib/firestore";
import { isOrganizer, isScorer, isVenueOwner, isSuperAdmin } from "@/lib/hats";
import { ROLE_DESTINATIONS } from "@/config/role-destinations";
import { useT } from "@/i18n";

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
 * Le menu s'appelle « MySpace » pour tout le monde : un compte cumule un role
 * et des casquettes, et « Espace joueur » mentait des qu'un joueur organisait
 * aussi une competition, le menu contenait alors deux familles dont une
 * seule etait nommee.
 */
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

  // Deux façons d'ouvrir la console, et il faut les deux : une compétition
  // qu'on modère, ou un simple match qu'on a été chargé de couvrir. Ne
  // regarder que les compétitions laissait l'entrée fermée pour quelqu'un
  // invité sur un amical, qui recevait la notification sans avoir nulle part
  // où aller.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      listModeratedCompetitions(user.uid).catch(() => []),
      getMatchesIModerate(user.uid).catch(() => []),
    ]).then(([comps, matchs]) => {
      if (!cancelled) setModerates(comps.length > 0 || matchs.length > 0);
    });
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;

  // Pas d'entrée « Espace joueur » vers /evolution : le menu s'appelle DÉJÀ
  // « Espace joueur ». Une ligne qui répète le titre de son propre menu
  // occupe une case et n'apprend rien.
  const roleItems: Espace[] = user.evolutionRole
    ? [...(ROLE_DESTINATIONS[user.evolutionRole] ?? [])]
    : [];

  // LE MERCATO A REJOINT « MES EQUIPES ». Il ne s'agit pas d'un espace : on y
  // cherche des joueurs pour SON equipe, et la page des equipes en porte
  // maintenant la porte, a cote des convocations.
  if (user.evolutionRole === "player" || user.evolutionRole === "manager") {
    // Demander un creneau ne demande aucune casquette : cette page suit le
    // role, pas la propriete d'un terrain. Elle etait rangee du cote des
    // casquettes, donc invisible pour ceux qui reservent vraiment.
    //
    // UN BILLET, PLUS UN CALENDRIER : « Calendrier » juste au-dessus portait
    // deja `CalendarDays`, et deux cases voisines montraient le meme dessin.
    // Une reservation est un creneau qu'on a pris, pas un agenda qu'on
    // consulte.
    roleItems.push({ href: "/mes-reservations", label: t("espace.mesReservations"), Icon: Ticket });
  }

  // Les casquettes nomment leur DESTINATION, pas un « espace ». « Espace
  // organisateur » dans un menu intitulé « Espace joueur » disait deux fois
  // le mot et une seule fois l'information.
  const hatItems: Espace[] = [];
  if (isOrganizer(user)) {
    // « Nouvelle competition » n'est pas ici : c'est une ACTION, pas une
    // destination, et elle vit deja en tete de l'espace organisateur. Un menu
    // de navigation qui propose de creer quelque chose melange deux gestes.
    hatItems.push({ href: "/organizer", label: t("espace.competitionsOrganisees"), Icon: Trophy });
  }
  // Deux chemins vers la console, comme dans lib/espaces-acces : moderer une
  // competition, ou porter la casquette de scoreur — qui donne acces aux
  // amicaux que personne ne couvre, meme sans moderer quoi que ce soit.
  if (moderates || isScorer(user)) {
    hatItems.push({ href: "/live-ops", label: t("espace.consoleLive"), Icon: Radio });
  }
  if (isVenueOwner(user)) {
    hatItems.push({ href: "/mes-terrains", label: t("espace.mesTerrains"), Icon: MapPin });
    // Les demandes RECUES, et non /mes-reservations qui liste celles qu'on a
    // faites ailleurs. Un proprietaire cliquait sur « Réservations » et
    // tombait sur sa page de client, sans jamais voir ce qu'on lui demandait.
    hatItems.push({ href: "/mes-terrains/reservations", label: t("espace.reservationsRecues"), Icon: Inbox });
  }
  if (isSuperAdmin(user)) {
    hatItems.push({ href: "/admin", label: t("espace.administration"), Icon: Shield });
  }

  return {
    label: NOM_DU_MENU,
    // Les 4 carres pour tous : l'icone du role (bonhomme, mallette) se
    // confondait avec celle du profil, juste a cote dans la barre.
    Icon: LayoutGrid,
    roleItems,
    hatItems,
  };
}
