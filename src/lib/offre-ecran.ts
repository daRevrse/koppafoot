import { aDroitAKoppaFootPlus, offreAffichee, type DroitOffre, type Titres } from "@/lib/offre";
import type { FormuleEnVente } from "@/lib/paiement";

// ============================================
// Ce que la page de l'offre montre, décidé hors de l'écran.
//
// CHAQUE PROFIL NE VOIT QUE CE QUI LUI SERT. Qui gère voit KoppaFoot+, ses
// plafonds, puis « Pas de pubs » ; les autres ne voient que « Pas de pubs ».
// La page a une demi-douzaine de cas (en vente ou non, actif ou non, avec ou
// sans titre) : ils se décident ici, d'après ce que /api/offre rend, pour
// pouvoir être testés un par un. La page ne fait que les dessiner.
//
// Module pur : aucun SDK, aucun composant.
// ============================================

/** Où en est une offre pour ce compte : en cours, à vendre, ou sans prix pour l'instant. */
export type EtatBloc = "actif" | "a_vendre" | "pas_en_vente";

export interface EcranOffre {
  /** Le nom de la page, le même que l'entrée de menu (lib/offre, offreAffichee). */
  titre: DroitOffre;
  /**
   * Le bloc KoppaFoot+. `null` : le compte n'y a pas droit et ne l'a pas.
   * `horsProfil` : il l'a sans y avoir droit (accordé avant la règle, ou à la
   * main) ; il ne lui retire que la publicité.
   */
  plus: { etat: EtatBloc; formules: FormuleEnVente[]; horsProfil: boolean } | null;
  /** Les plafonds et ce que le compte utilise : seulement pour qui gère quelque chose. */
  jauges: boolean;
  /** Le lien vers le Club multi-équipes : à un manager qui a KoppaFoot+. */
  club: boolean;
  /** Le bloc « Pas de pubs ». `null` tant que KoppaFoot+ court : il le comprend déjà. */
  sansPub: { etat: EtatBloc; formules: FormuleEnVente[] } | null;
}

export function ecranOffre(o: {
  titres: Titres;
  plusActif: boolean;
  sansPubActif: boolean;
  /** Ce que le compte peut acheter (lib/paiement-serveur, formulesPour). */
  formules: FormuleEnVente[];
}): EcranOffre {
  const eligible = aDroitAKoppaFootPlus(o.titres);
  const bloc = (droit: DroitOffre, actif: boolean) => {
    const formules = o.formules.filter((f) => f.droit === droit);
    const etat: EtatBloc = actif ? "actif" : formules.length > 0 ? "a_vendre" : "pas_en_vente";
    return { etat, formules };
  };
  return {
    titre: offreAffichee(o.titres),
    plus: eligible || o.plusActif ? { ...bloc("pro", o.plusActif), horsProfil: !eligible } : null,
    jauges: eligible,
    club: o.plusActif && o.titres.manager,
    sansPub: o.plusActif ? null : bloc("sans_pub", o.sansPubActif),
  };
}
