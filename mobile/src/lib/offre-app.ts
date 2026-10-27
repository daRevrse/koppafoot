import type { CleLimite, Titres } from "@/lib/offre";
import { ecranOffre } from "@/lib/offre-ecran";
import { lirePrix, NOM_OFFRE, type PrixOffre } from "@/lib/paiement";

// ============================================
// La page Offre de l'application : ce que sont KoppaFoot+ et « Pas de pubs »,
// leurs tarifs, et où en est le compte. Ce qui se montre à quel profil se
// décide comme sur le site (lib/offre-ecran).
//
// ON N'Y ACHÈTE RIEN. Le Play Store n'accepte la vente d'un abonnement
// numérique que par son propre paiement, et interdit même d'envoyer payer
// ailleurs : la page présente, sans bouton ni lien de paiement. La décision
// est à prendre (paiement Google Play, ou rien dans l'application).
// ============================================

/** Où en est un droit pour ce compte (`vue` de /api/offre). */
export interface DroitVu {
  actif: boolean;
  /** `null` : sans échéance. */
  jusquAu: string | null;
}

/** Ce que l'application lit de GET /api/offre. */
export interface OffreDuCompte {
  estPro: boolean;
  pro: DroitVu | null;
  sansPub: DroitVu | null;
  limitesDepuis: string | null;
  limitesActives: boolean;
  limites: Record<CleLimite, number>;
  usage: Record<"equipes" | "terrains" | "competitions", number>;
  casquettes: Titres;
  leve: Record<CleLimite, boolean>;
}

/** Les prix de `settings/offre`, en FCFA ; `null` : pas de prix fixé. */
export interface Tarifs {
  mois: number | null;
  an: number | null;
}

export interface BlocOffre {
  actif: boolean;
  jusquAu: string | null;
  tarifs: Tarifs;
}

export interface Jauge {
  libelle: string;
  /** `null` : un plafond par compétition, rien à compter. */
  usage: number | null;
  max: number;
  /** KoppaFoot+ le lève pour ce compte. */
  illimite: boolean;
}

export interface VueOffre {
  titre: string;
  plus: (BlocOffre & { horsProfil: boolean; avantages: string[]; club: boolean }) | null;
  sansPub: BlocOffre | null;
  /** Ce que le compte utilise face aux plafonds : seulement pour qui gère. */
  jauges: Jauge[] | null;
  limitesActives: boolean;
  limitesDepuis: string | null;
}

/** Ce que KoppaFoot+ ouvre, dans l'ordre et les mots de la page du site. */
const AVANTAGES = {
  club: "Club multi-équipes : réunis tes équipes sous un même club, avec sa page et son encadrement",
  equipes: "Équipes illimitées",
  competitions: "Compétitions en cours illimitées, et plus de 16 équipes par compétition",
  terrains: "Terrains illimités",
  pub: "Aucune publicité",
};

/** Seulement ce que KoppaFoot+ ouvrirait à ce profil ; sans compte, tout. */
function avantagesPour(t: Titres | null): string[] {
  const a = (ok: boolean, texte: string) => (ok ? [texte] : []);
  return [
    ...a(!t || t.manager, AVANTAGES.club),
    ...a(!t || t.manager, AVANTAGES.equipes),
    ...a(!t || t.organisateur, AVANTAGES.competitions),
    ...a(!t || t.gerant, AVANTAGES.terrains),
    AVANTAGES.pub,
  ];
}

const tarifs = (prix: PrixOffre, droit: "pro" | "sans_pub"): Tarifs => ({ mois: prix[`${droit}_mois`], an: prix[`${droit}_an`] });

/**
 * « 13 000 FCFA ». L'espace des milliers est une espace insécable ordinaire :
 * l'espace fine que le français met là n'existe pas dans la police des titres,
 * qui l'affichait « 13000 ».
 */
export const montant = (n: number) => `${n.toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0")}\u00a0FCFA`;

/** Sans compte : les deux offres, tout ce que KoppaFoot+ peut ouvrir, et les tarifs. */
export function vueVisiteur(prixBrut: unknown): VueOffre {
  const prix = lirePrix(prixBrut);
  return {
    titre: "Offres",
    plus: { actif: false, jusquAu: null, tarifs: tarifs(prix, "pro"), horsProfil: false, avantages: avantagesPour(null), club: false },
    sansPub: { actif: false, jusquAu: null, tarifs: tarifs(prix, "sans_pub") },
    jauges: null,
    limitesActives: false,
    limitesDepuis: null,
  };
}

/**
 * Connecté : KoppaFoot+ à qui gère (ou l'a), « Pas de pubs » sauf tant que
 * KoppaFoot+ court, et les jauges du profil (`ecranOffre` du site).
 */
export function vueDuCompte(o: OffreDuCompte, prixBrut: unknown): VueOffre {
  const prix = lirePrix(prixBrut);
  const ecran = ecranOffre({
    titres: o.casquettes, plusActif: o.estPro, sansPubActif: o.sansPub?.actif === true, formules: [],
  });
  const c = o.casquettes;
  const jauge = (cle: CleLimite, libelle: string, usage: number | null): Jauge => ({
    libelle, usage, max: o.limites[cle], illimite: o.leve[cle],
  });
  return {
    titre: NOM_OFFRE[ecran.titre],
    plus: ecran.plus
      ? {
          actif: ecran.plus.etat === "actif",
          jusquAu: o.pro?.jusquAu ?? null,
          tarifs: tarifs(prix, "pro"),
          horsProfil: ecran.plus.horsProfil,
          avantages: avantagesPour(c),
          club: ecran.club,
        }
      : null,
    sansPub: ecran.sansPub
      ? { actif: ecran.sansPub.etat === "actif", jusquAu: o.sansPub?.jusquAu ?? null, tarifs: tarifs(prix, "sans_pub") }
      : null,
    jauges: ecran.jauges
      ? [
          ...(c.manager ? [jauge("equipes", "Équipes que tu gères", o.usage.equipes)] : []),
          ...(c.gerant ? [jauge("terrains", "Terrains référencés", o.usage.terrains)] : []),
          ...(c.organisateur
            ? [
                jauge("competitions", "Compétitions en cours", o.usage.competitions),
                jauge("equipesParCompetition", "Équipes par compétition", null),
              ]
            : []),
        ]
      : null,
    limitesActives: o.limitesActives,
    limitesDepuis: o.limitesDepuis,
  };
}
