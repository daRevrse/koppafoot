// ============================================
// Ce que la page admin « Joueur de la semaine » envoie pour fabriquer une
// affiche ou les calques de sa vidéo, lu et vérifié avant tout calcul.
//
// LE SERVEUR NE CROIT LE CORPS QUE SUR DEUX POINTS : le nom affiché, et le
// choix parmi les partenaires du jour. Les matchs, les buts, les équipes et
// la photo, il les relit lui-même (voir lib/joueur-semaine-admin) : une
// affiche ne doit pas porter des chiffres que la base n'a pas, ni une photo
// que son joueur n'a pas autorisée (voir lib/consentement-image).
//
// Pur : aucun SDK.
// ============================================

export type FormatDemande = "publication" | "vertical";

export interface DemandeAffiche {
  /** Le lundi de la semaine, « AAAA-MM-JJ ». */
  lundi: string;
  /** Les compétitions écartées pour cette semaine. */
  ecartees: string[];
  /** La clé du candidat (voir `CandidatDeLaSemaine.cle`). */
  cle: string;
  /** Le nom affiché, 1 à 40 caractères. */
  nom: string;
  /** Les partenaires retenus parmi ceux du jour, deux au plus. */
  partenaires: string[];
  /** Pour l'affiche seulement ; les calques sont toujours au format vertical. */
  format?: FormatDemande;
}

export const NOM_MAX = 40;

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const chaines = (v: unknown, max: number): string[] | null =>
  Array.isArray(v) && v.length <= max && v.every((x) => typeof x === "string" && x.length > 0 && x.length <= 200)
    ? (v as string[])
    : null;

/** La demande, ou ce qui ne va pas, en une phrase pour l'admin. */
export function lireDemande(corps: unknown): DemandeAffiche | { erreur: string } {
  if (!corps || typeof corps !== "object") return { erreur: "Demande illisible" };
  const c = corps as Record<string, unknown>;
  if (typeof c.lundi !== "string" || !JOUR.test(c.lundi)) return { erreur: "Semaine illisible" };
  const ecartees = chaines(c.ecartees ?? [], 100);
  if (!ecartees) return { erreur: "Compétitions écartées illisibles" };
  if (typeof c.cle !== "string" || !c.cle.trim() || c.cle.length > 200) return { erreur: "Joueur manquant" };
  const nom = typeof c.nom === "string" ? c.nom.trim() : "";
  if (!nom || nom.length > NOM_MAX) return { erreur: `Le nom doit faire de 1 à ${NOM_MAX} caractères` };
  const partenaires = chaines(c.partenaires ?? [], 2);
  if (!partenaires) return { erreur: "Deux partenaires au plus" };
  if (c.format !== undefined && c.format !== "publication" && c.format !== "vertical") return { erreur: "Format inconnu" };
  return {
    lundi: c.lundi,
    ecartees,
    cle: c.cle,
    nom,
    partenaires,
    ...(c.format ? { format: c.format as FormatDemande } : {}),
  };
}
