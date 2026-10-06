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

//
// SUR LE DIRECT, DEUX EMPLACEMENTS :
//   · `direct` : le bandeau, en tête du contenu sur téléphone, sous l'affiche
//     du match sur tablette, en haut du rail de droite sur grand écran (là,
//     dans son visuel vertical s'il en a un). Un seul endroit à la fois.
//   · `direct_vide` : un jour sans aucun match, sous « Voir demain ». La
//     place ne coûte rien au lecteur, il n'y a rien d'autre à montrer ; elle
//     se vend à part, son audience n'est pas celle du bandeau.
export const EMPLACEMENTS = ["direct", "direct_vide", "competition", "match"] as const;
export type EmplacementPartenaire = (typeof EMPLACEMENTS)[number];

/** Ce que l'administration lit, emplacement par emplacement. */
export const LIBELLE_EMPLACEMENT: Record<EmplacementPartenaire, string> = {
  direct: "Accueil Direct (bandeau)",
  direct_vide: "Accueil Direct, jour sans match",
  competition: "Page d'une compétition",
  match: "Fiche d'un match",
};

/**
 * Comment le partenaire se présente.
 *
 * `logo` : son logo en vignette, son nom et son accroche à côté, dans un
 * encadré. `banniere` : une image pleine largeur, faite par la marque, qui
 * porte elle-même son message ; le nom ne l'accompagne qu'en petit, avec la
 * mention « Partenaire ».
 */
export const FORMATS = ["logo", "banniere"] as const;
export type FormatPartenaire = (typeof FORMATS)[number];

export const LIBELLE_FORMAT: Record<FormatPartenaire, string> = {
  logo: "Logo et nom",
  banniere: "Bannière",
};

/**
 * La bannière a UNE proportion, 4 pour 1, quel que soit l'emplacement.
 *
 * Une marque locale fait son visuel une fois, souvent sur Canva : un seul
 * format à lui demander, et elle sait exactement ce qui paraîtra. 4:1 tient
 * dans le rail de l'accueil Direct (320 px de large, 80 de haut) comme en
 * pleine largeur sur téléphone ; sur ordinateur, la bannière s'arrête à
 * 768 px de large (192 de haut) pour ne pas écraser la page.
 */
export const RATIO_BANNIERE = 4;
export const BANNIERE_CONSEILLEE = { largeur: 1200, hauteur: 300 } as const;

/**
 * LE VISUEL VERTICAL, FACULTATIF : 1 pour 2, pour le rail de droite du Direct
 * sur grand écran (300 × 600 à l'affichage). Une marque qui n'en fournit pas
 * y paraît quand même, avec sa bannière 4:1, qui tient dans le rail : le
 * vertical est un plus qu'on vend, jamais une condition.
 */
export const RATIO_VERTICALE = 1 / 2;
export const VERTICALE_CONSEILLEE = { largeur: 600, hauteur: 1200 } as const;

/** Le partenariat, tel que Firestore le range (`partenariats/{id}`). */
export interface FirestorePartenariat {
  /** Le nom de la marque, affiché sous son visuel. */
  annonceur: string;
  /** Une phrase, facultative : « Fière partenaire du foot de quartier ». */
  accroche: string | null;
  /** Absent sur les partenariats d'avant les bannières : un logo. */
  format?: FormatPartenaire;
  /** Le visuel ou le logo, dans Storage (`partenaires/{id}/visuel-…`). */
  image_url: string | null;
  /**
   * Le visuel vertical d'une bannière, 1:2, facultatif (`partenaires/{id}/verticale-…`).
   * Absent : le rail de droite montre la bannière 4:1.
   */
  image_verticale_url?: string | null;
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
  format: FormatPartenaire;
  imageUrl: string | null;
  /** Le visuel vertical d'une bannière, s'il y en a un. */
  imageVerticaleUrl: string | null;
  /** Le visuel mène-t-il quelque part ? Le lien lui-même reste au serveur. */
  cliquable: boolean;
  /** Partenaire de CETTE compétition, plutôt que de KoppaFoot en général. */
  deLaCompetition: boolean;
}

export { jourDeLome } from "@/lib/jour";

/**
 * Le format à afficher.
 *
 * Une bannière sans image n'aurait rien à montrer : elle retombe sur
 * l'encadré, qui a toujours au moins le nom de la marque. L'administration
 * refuse ce cas (une bannière exige son visuel) ; ceci couvre un document
 * abîmé ou un visuel effacé à la main.
 */
export function formatDe(p: Pick<FirestorePartenariat, "format" | "image_url">): FormatPartenaire {
  return p.format === "banniere" && p.image_url ? "banniere" : "logo";
}

/**
 * Ce qu'il faut dire à l'administrateur d'une image de bannière, ou `null`
 * si elle convient.
 *
 * Le recadrage est annoncé au-delà de 15 % d'écart avec le 4:1 : en deçà, il
 * ne rogne qu'une marge que personne ne remarque. Une image étroite est
 * signalée aussi, elle serait floue en pleine largeur sur ordinateur.
 */
export function avisBanniere(largeur: number, hauteur: number): string | null {
  if (!(largeur > 0 && hauteur > 0)) return null;
  const { largeur: l, hauteur: h } = BANNIERE_CONSEILLEE;
  const ratio = largeur / hauteur;
  if (Math.abs(ratio / RATIO_BANNIERE - 1) > 0.15) {
    return `Cette image fait ${largeur} × ${hauteur} px : elle sera recadrée au centre pour tenir en 4:1, comme l'aperçu le montre. Format conseillé : ${l} × ${h} px.`;
  }
  if (largeur < 800) {
    return `Cette image ne fait que ${largeur} px de large : elle sera floue sur grand écran. ${l} × ${h} px conseillés.`;
  }
  return null;
}

/** Comme `avisBanniere`, pour le visuel vertical (1:2, affiché en 300 × 600). */
export function avisVerticale(largeur: number, hauteur: number): string | null {
  if (!(largeur > 0 && hauteur > 0)) return null;
  const { largeur: l, hauteur: h } = VERTICALE_CONSEILLEE;
  if (Math.abs(largeur / hauteur / RATIO_VERTICALE - 1) > 0.15) {
    return `Cette image fait ${largeur} × ${hauteur} px : elle sera recadrée au centre pour tenir en 1:2, comme l'aperçu le montre. Format conseillé : ${l} × ${h} px.`;
  }
  if (largeur < 450) {
    return `Cette image ne fait que ${largeur} px de large : elle sera floue sur grand écran. ${l} × ${h} px conseillés.`;
  }
  return null;
}

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
