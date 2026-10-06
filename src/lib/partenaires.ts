// ============================================
// Les partenaires : les marques qui sponsorisent KoppaFoot ou une compétition.
//
// VENDUS EN DIRECT, AFFICHÉS PAR NOUS. Pas de régie publicitaire ici : une
// marque locale paie pour être vue sur les matchs de son quartier, et
// l'administration pose son visuel dans un emplacement. Le jour où une régie
// (AdSense) viendra boucher les emplacements invendus, elle se branchera dans
// le même composant (components/partenaires/Emplacement), là où il ne trouve
// aucun partenaire.
//
// LES EMPLACEMENTS SONT UNE LISTE FERMÉE, et c'est voulu. Chacun a été choisi
// pour ne gêner personne : jamais dans la console du direct, jamais dans une
// notification, jamais sur un écran de paiement ou d'inscription, jamais sur
// la fiche d'un joueur (des mineurs y figurent). Ajouter un emplacement est
// une décision, pas une ligne de code.
//
// Module pur : aucun SDK. Le serveur (lib/partenaires-server, les routes
// /api/partenaires) et le navigateur (l'emplacement, l'administration) le
// partagent.
// ============================================

export const EMPLACEMENTS = ["direct", "competition", "match"] as const;
export type EmplacementPartenaire = (typeof EMPLACEMENTS)[number];

/** Ce que l'administration lit, emplacement par emplacement. */
export const LIBELLE_EMPLACEMENT: Record<EmplacementPartenaire, string> = {
  direct: "Accueil Direct",
  competition: "Page d'une compétition",
  match: "Fiche d'un match",
};

/** Le partenariat, tel que Firestore le range (`partenariats/{id}`). */
export interface FirestorePartenariat {
  /** Le nom de la marque, affiché sous son visuel. */
  annonceur: string;
  /** Une phrase, facultative : « Fière partenaire du foot de quartier ». */
  accroche: string | null;
  /** Le visuel ou le logo, dans Storage (`partenaires/{id}/…`). */
  image_url: string | null;
  /** Où mène un clic. https seulement ; absent = le visuel ne mène nulle part. */
  lien: string | null;
  emplacements: EmplacementPartenaire[];
  /**
   * Une compétition précise : le partenaire n'apparaît que sur sa page et sur
   * les fiches de ses matchs, en priorité sur les partenaires généraux.
   * Absent = partout où ses emplacements le permettent.
   */
  competition_id: string | null;
  /** Le nom de cette compétition, recopié pour la liste de l'administration. */
  competition_nom: string | null;
  /** Première et dernière journée d'affichage, « 2026-10-01 », incluses. */
  debut: string;
  fin: string;
  /** Interrupteur de l'administration, indépendant des dates. */
  actif: boolean;
  /** Ce qu'on montre au partenaire : combien l'ont vu, combien ont cliqué. */
  vues: number;
  clics: number;
  created_by: string;
  created_at: unknown;
  updated_at: unknown;
}

/** Ce qu'un emplacement reçoit : rien de plus que ce qu'il affiche. */
export interface PartenaireAffiche {
  id: string;
  annonceur: string;
  accroche: string | null;
  imageUrl: string | null;
  /** Le visuel mène-t-il quelque part ? Le lien lui-même reste au serveur. */
  cliquable: boolean;
  /** Partenaire de CETTE compétition, plutôt que de KoppaFoot en général. */
  deLaCompetition: boolean;
}

export { jourDeLome } from "@/lib/jour";

/** Le partenariat est-il à l'affiche ce jour-là ? */
export function aLAffiche(p: Pick<FirestorePartenariat, "actif" | "debut" | "fin">, jour: string): boolean {
  return p.actif && p.debut <= jour && jour <= p.fin;
}

/**
 * Qui montrer dans un emplacement.
 *
 * Le partenaire d'une compétition passe devant les partenaires généraux sur
 * SES pages : c'est ce qu'il a acheté. Il n'apparaît jamais ailleurs. Entre
 * plusieurs candidats de même rang, on tourne : `tirage` vaut entre 0 et 1.
 */
export function choisirPartenaire<P extends Pick<FirestorePartenariat, "competition_id">>(
  candidats: P[],
  cid: string | null,
  tirage: number,
): P | null {
  const propres = cid ? candidats.filter((c) => c.competition_id === cid) : [];
  const generaux = candidats.filter((c) => !c.competition_id);
  const pool = propres.length ? propres : generaux;
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(tirage * pool.length))];
}

/** Un lien de partenaire acceptable : une adresse https complète. */
export function lienValide(lien: string | null | undefined): string | null {
  const brut = (lien ?? "").trim();
  if (!brut) return null;
  try {
    const u = new URL(brut);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Une date « AAAA-MM-JJ » bien formée. */
export function jourValide(jour: string | null | undefined): boolean {
  return typeof jour === "string" && /^\d{4}-\d{2}-\d{2}$/.test(jour) && !Number.isNaN(Date.parse(jour));
}
