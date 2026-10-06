import { MapPin, Radio, Rocket, Trophy, type LucideIcon } from "lucide-react";
import type { Langue } from "@/i18n/config";
import { isOrganizer, isScorer, isVenueOwner } from "@/lib/hats";
import type { UserProfile } from "@/types";

// ============================================
// Les vitrines : les espaces publics du produit, en une seule table.
//
// POURQUOI UNE TABLE. Chaque surface tenait sa propre liste : le menu Koppa
// Links (Organize, Score, MyFields), le pied des vitrines (Organize,
// Evolution, MyFields : Score n'y était pas), et l'en-tête des vitrines, qui
// avait oublié /scoreurs, resté sans sections ni action. Trois listes, trois
// produits différents selon l'endroit d'où on regardait. Elles lisent toutes
// celle-ci.
//
// UNE VITRINE COUVRE SES SOUS-PAGES (`chemins`) : la candidature, l'annuaire,
// la fiche d'un terrain appartiennent à leur espace, et l'en-tête le dit au
// lieu de retomber sur un logo seul.
//
// À NE PAS CONFONDRE avec les espaces du COMPTE (hooks/useEspaces), qui sont
// les écrans de travail d'un rôle ou d'une casquette : `monEspace` fait le
// pont, une vitrine propose « Mon espace » à qui en a déjà un.
// ============================================

export type CleVitrine = "organize" | "score" | "fields" | "evolution";

export interface Vitrine {
  cle: CleVitrine;
  nom: string;
  /** La page de présentation. */
  chemin: string;
  /** Les pages qui en font partie (préfixes), la vitrine comprise. */
  chemins: string[];
  Icone: LucideIcon;
  /** Une phrase pour le menu Koppa Links. */
  phrase: Record<Langue, string>;
  /** Les ancres de la page de présentation, dans l'ordre de la page. */
  sections: { href: string; label: string }[];
  /** Ce qu'on vient y faire, pour qui n'a pas encore d'espace. */
  action: { href: string; label: string };
  /** Le contexte de connexion (config/auth-contextes), si l'espace en a un. */
  contexteAuth: string | null;
  /** Dans le menu Koppa Links ? Evolution a son propre bouton, voir ScoreHeader. */
  dansKoppaLinks: boolean;
  /** L'écran de travail de qui a déjà cet espace, ou null. */
  monEspace: (user: UserProfile | null) => { href: string; label: string } | null;
}

export const VITRINES: Vitrine[] = [
  {
    cle: "organize",
    nom: "Koppafoot Organize",
    chemin: "/organisateurs",
    chemins: ["/organisateurs"],
    Icone: Trophy,
    phrase: {
      fr: "Monter une compétition, tenir son calendrier et la diffuser en direct.",
      en: "Set up a competition, run its fixtures and stream it live.",
    },
    sections: [
      { href: "#methode", label: "La méthode" },
      { href: "#tutoriel", label: "Tutoriel" },
      { href: "#questions", label: "Questions" },
    ],
    action: { href: "/organisateurs/candidature", label: "Candidater" },
    contexteAuth: "organisateur",
    dansKoppaLinks: true,
    monEspace: (u) => (isOrganizer(u) ? { href: "/organizer", label: "Mes compétitions" } : null),
  },
  {
    cle: "score",
    nom: "Koppafoot Score",
    chemin: "/scoreurs",
    chemins: ["/scoreurs"],
    Icone: Radio,
    phrase: {
      fr: "Tenir la console d'un match, et faire vivre le direct pour ceux qui n'y sont pas.",
      en: "Run a match console, and bring the game to life for those who can't be there.",
    },
    sections: [
      { href: "#deroulement", label: "Comment ça se passe" },
      { href: "#cadre", label: "Le cadre" },
      { href: "#questions", label: "Questions" },
    ],
    action: { href: "/scoreurs/candidature", label: "Candidater" },
    contexteAuth: "scoreur",
    dansKoppaLinks: true,
    monEspace: (u) => (isScorer(u) ? { href: "/live-ops", label: "Ma console" } : null),
  },
  {
    cle: "fields",
    nom: "MyFields",
    chemin: "/terrains",
    chemins: ["/terrains"],
    Icone: MapPin,
    phrase: {
      fr: "Référencer un terrain et se rendre trouvable par les équipes.",
      en: "List a pitch and make it easy for teams to find.",
    },
    sections: [
      { href: "#etapes", label: "Comment ça marche" },
      { href: "#cadre", label: "Le cadre" },
    ],
    action: { href: "/terrains/candidature", label: "Référencer" },
    contexteAuth: "terrain",
    dansKoppaLinks: true,
    monEspace: (u) => (isVenueOwner(u) ? { href: "/mes-terrains", label: "Mes terrains" } : null),
  },
  {
    cle: "evolution",
    nom: "Koppafoot Evolution",
    chemin: "/roles",
    chemins: ["/roles"],
    Icone: Rocket,
    phrase: {
      fr: "Joueur, manager ou arbitre : choisir son rôle, et en changer.",
      en: "Player, manager or referee: pick your role, and change it.",
    },
    sections: [
      { href: "#ouverts", label: "Les rôles" },
      { href: "#choisir", label: "Choisir" },
    ],
    // Une ancre, et non /evolution : le choix se fait sur cette page même.
    action: { href: "#choisir", label: "Choisir mon rôle" },
    contexteAuth: null,
    dansKoppaLinks: false,
    monEspace: (u) => (u?.evolutionRole ? { href: "#choisir", label: "Changer de rôle" } : null),
  },
];

/** La vitrine d'une adresse : la page de présentation ou l'une de ses sous-pages. */
export function vitrineDe(pathname: string): Vitrine | null {
  return (
    VITRINES.find((v) => v.chemins.some((c) => pathname === c || pathname.startsWith(`${c}/`))) ?? null
  );
}
