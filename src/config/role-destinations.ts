import { Users, ClipboardCheck, CalendarDays, BarChart3, Trophy } from "lucide-react";
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
    { href: "/teams", label: "Mes équipes", hint: "Les équipes dont tu fais partie", Icon: Users },
    { href: "/participations", label: "Mes convocations", hint: "Réponds aux convocations reçues", Icon: ClipboardCheck },
    { href: "/calendar", label: "Calendrier", hint: "Tes matchs et entraînements", Icon: CalendarDays },
    { href: "/stats", label: "Mes statistiques", hint: "Buts, cartons et matchs joués", Icon: BarChart3 },
  ],
  manager: [
    { href: "/teams", label: "Mon équipe", hint: "Effectif, entraînements, palmarès", Icon: Users },
    { href: "/matches", label: "Matchs amicaux", hint: "Défis et rencontres à planifier", Icon: Users },
    { href: "/calendar", label: "Calendrier", hint: "Tes matchs et entraînements", Icon: CalendarDays },
    { href: "/mon-equipe", label: "Mes compétitions", hint: "Effectif engagé et classements", Icon: Trophy },
  ],
  // L'arbitre n'avait rien ici tant que ses écrans étaient au placard, ce qui
  // donnait un rôle activable dont le menu s'ouvrait vide. « Mes
  // désignations » est maintenant une vraie page, elle porte tout ce qu'il
  // fait : répondre aux invitations, se porter candidat, ouvrir la console.
  referee: [
    { href: "/designations", label: "Mes désignations", hint: "Invitations, matchs à arbitrer et console", Icon: ClipboardCheck },
    { href: "/calendar", label: "Calendrier", hint: "Les matchs que tu diriges", Icon: CalendarDays },
  ],
};
