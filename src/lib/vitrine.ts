// ============================================
// La vitrine des terrains : ceux que le Direct montre à côté des Top
// performances (voir components/direct/CarteDefilante).
//
// À LA UNE D'ABORD. L'administration choisit les terrains mis en avant
// (`settings/vitrine.terrains_a_la_une`, écrit par le serveur seulement :
// un propriétaire, qui modifie sa fiche lui-même, ne doit pas pouvoir se
// mettre à la une). C'est la place qu'on vendra aux terrains.
//
// À DÉFAUT, À DÉCOUVRIR. Tant que personne n'est à la une, la carte montre
// les terrains qui se présentent le mieux — ouverts, avec une photo, les
// mieux notés —, pour que la place serve déjà à faire connaître les terrains
// référencés plutôt que de rester vide.
//
// Module pur : la route publique et les tests le partagent.
// ============================================

/** Un terrain tel que la carte le montre. */
export interface TerrainDeVitrine {
  id: string;
  nom: string;
  ville: string | null;
  photo: string | null;
  format: string | null;
  surface: string | null;
  prix: number | null;
  note: number;
  avis: number;
}

/** Ce que Firestore range sur `venues/{id}`, lu sans y croire. */
export interface TerrainBrut {
  id: string;
  name?: unknown;
  city?: unknown;
  photo_url?: unknown;
  field_size?: unknown;
  field_surface?: unknown;
  price_per_hour?: unknown;
  rating?: unknown;
  review_count?: unknown;
  available?: unknown;
}

/** Trois terrains au plus : la carte en fait défiler un à la fois. */
export const MAX_VITRINE = 3;

const texte = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const nombre = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Le terrain pour la carte, ou null s'il est fermé ou sans nom. */
export function versTerrainDeVitrine(b: TerrainBrut): TerrainDeVitrine | null {
  const nom = texte(b.name);
  if (!nom || b.available === false) return null;
  const prix = nombre(b.price_per_hour);
  return {
    id: b.id,
    nom,
    ville: texte(b.city),
    photo: texte(b.photo_url),
    format: texte(b.field_size),
    surface: texte(b.field_surface),
    prix: prix > 0 ? prix : null,
    note: nombre(b.rating),
    avis: nombre(b.review_count),
  };
}

/**
 * Les terrains de la vitrine : ceux à la une, dans l'ordre choisi ; à défaut,
 * les mieux présentés parmi `autres` (une photo obligatoire, puis la note et
 * le nombre d'avis).
 */
export function vitrineDesTerrains(
  aLaUne: TerrainBrut[],
  autres: TerrainBrut[],
  max = MAX_VITRINE,
): { terrains: TerrainDeVitrine[]; aLaUne: boolean } {
  const choisis = aLaUne.map(versTerrainDeVitrine).filter((t): t is TerrainDeVitrine => t !== null);
  if (choisis.length > 0) return { terrains: choisis.slice(0, max), aLaUne: true };

  const decouvertes = autres
    .map(versTerrainDeVitrine)
    .filter((t): t is TerrainDeVitrine => t !== null && t.photo !== null)
    .sort((a, b) => b.note - a.note || b.avis - a.avis || a.nom.localeCompare(b.nom));
  return { terrains: decouvertes.slice(0, max), aLaUne: false };
}
