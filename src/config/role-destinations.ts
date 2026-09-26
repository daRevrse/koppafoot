import { Users, UsersRound, ClipboardCheck, CalendarDays, BarChart3, Medal, Swords } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EvolutionRole } from "@/types";

// ============================================
// Où va un compte, selon ce qu'il EST sur le terrain.
//
// Cette liste vivait dans ScoreHeader, donc dans le menu avatar, et le menu
// avatar n'existe plus sur téléphone, où la barre du bas fait le même travail
// en mieux. « Mes équipes » et « Mes convocations » seraient devenues
// inatteignables au doigt en retirant ce menu.
//
// Elle est donc ici, partagée par les deux navigations. Le `hint` sert à la
// feuille mobile, qui a la place d'expliquer ; le header l'ignore.
//
// Ne pas confondre avec les casquettes (organisateur, propriétaire) : celles-
// là ne dépendent pas du rôle et se cumulent, voir lib/hats.
// ============================================

export interface RoleDestination {
  href: string;
  label: string;
  hint: string;
  Icon: LucideIcon;
}

export const ROLE_DESTINATIONS: Partial<Record<EvolutionRole, RoleDestination[]>> = {
  player: [
    // MES CONVOCATIONS ET LE MERCATO NE SONT PLUS ICI. Ils ne sont pas des
    // espaces a part : ils concernent l'equipe, et ils s'ouvrent depuis
    // « Mes equipes », qui en porte desormais les deux portes. Le menu
    // gagne deux cases et perd deux redites.
    { href: "/teams", label: "Mes équipes", hint: "Ton effectif, tes convocations, le mercato", Icon: Users },
    { href: "/calendar", label: "Calendrier", hint: "Tes matchs et entraînements", Icon: CalendarDays },
    { href: "/stats", label: "Mes statistiques", hint: "Buts, cartons et matchs joués", Icon: BarChart3 },
  ],
  manager: [
    { href: "/teams", label: "Mon équipe", hint: "Effectif, entraînements, palmarès", Icon: Users },
    // `Swords` ET NON `Users`. Les deux premieres cases du menu manager
    // portaient le MEME pictogramme, cote a cote : deux bonshommes pour
    // « Mon équipe » et deux bonshommes pour « Matchs amicaux ». Une icone
    // qui ne distingue pas ne sert a rien, elle occupe juste la place.
    // Un amical est une rencontre qu'on provoque — d'ou le duel.
    { href: "/matches", label: "Matchs amicaux", hint: "Défis et rencontres à planifier", Icon: Swords },
    { href: "/calendar", label: "Calendrier", hint: "Tes matchs et entraînements", Icon: CalendarDays },
    { href: "/mon-equipe", label: "Mes compétitions", hint: "Effectif engagé et classements", Icon: Medal },
  ],
  // L'arbitre n'avait rien ici tant que ses écrans étaient au placard, ce qui
  // donnait un rôle activable dont le menu s'ouvrait vide. « Mes
  // désignations » est maintenant une vraie page, elle porte tout ce qu'il
  // fait : répondre aux invitations, se porter candidat, ouvrir la console.
  referee: [
    { href: "/designations", label: "Mes désignations", hint: "Invitations, matchs à arbitrer et console", Icon: ClipboardCheck },
    { href: "/corps-arbitral", label: "Corps arbitral", hint: "Tes assistants et tes scoreurs", Icon: UsersRound },
    { href: "/calendar", label: "Calendrier", hint: "Les matchs que tu diriges", Icon: CalendarDays },
  ],
};
