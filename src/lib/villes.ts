// ============================================
// Une ville, écrite d'une seule façon.
//
// D'OÙ ÇA VIENT : en novembre 2026, sur 46 comptes, Lomé s'écrivait de cinq
// façons — « Lomé », « Lomé  » (espace finale), « Lome », « lome », « LOME ».
// Les filtres « Ville » de l'annuaire des terrains et du mercato sont bâtis
// sur ces valeurs brutes : chercher « Lomé » ratait tous les autres.
//
// DEUX OUTILS, DEUX MOMENTS.
//   - `normaliserVille` à l'ÉCRITURE : ce qui part en base est propre. Une
//     ville connue reprend son orthographe officielle (accents compris) ; une
//     ville inconnue est gardée telle quelle, seulement nettoyée de ses espaces
//     et, si elle a été tapée tout en minuscules ou tout en majuscules,
//     remise en casse de titre.
//   - `cleVille` à la COMPARAISON : sans accent, sans majuscule, sans espace
//     superflue. Deux valeurs de même clé sont la même ville, même si une
//     ancienne donnée a échappé au nettoyage.
//
// LA LISTE N'EST PAS UNE LISTE BLANCHE. On ne refuse jamais une ville parce
// qu'elle n'y est pas : elle sert seulement à rendre son accent à « Lome » ou
// son trait d'union à « porto novo ». La compléter quand une nouvelle ville
// apparaît en base sous plusieurs formes.
//
// Module sans dépendance : le navigateur, le serveur et l'appli mobile
// l'importent.
// ============================================

/** Orthographes officielles. L'ordre n'importe pas. */
const VILLES_CONNUES = [
  // Togo
  "Lomé", "Kara", "Sokodé", "Kpalimé", "Atakpamé", "Dapaong", "Tsévié", "Aného",
  "Bassar", "Mango", "Notsé", "Badou", "Tabligbo", "Vogan", "Kandé", "Niamtougou",
  "Sotouboua", "Blitta", "Agou", "Amlamé", "Tchamba", "Bafilo", "Kévé", "Agbodrafo",
  "Baguida", "Adidogomé", "Agoè-Nyivé", "Togblékopé",
  // Voisins et capitales de la région
  "Cotonou", "Porto-Novo", "Abomey-Calavi", "Parakou", "Ouidah", "Accra", "Kumasi",
  "Aflao", "Ouagadougou", "Bobo-Dioulasso", "Bamako", "Abidjan", "Niamey", "Dakar",
  "Conakry", "Lagos", "Rabat", "Casablanca", "Libreville", "Douala", "Yaoundé",
  // Diaspora
  "Paris", "Lyon", "Marseille", "Bruxelles", "Montréal",
];

/**
 * La clé de comparaison : minuscules, sans accent, espaces et traits d'union
 * confondus. « Lomé  », « LOME » et « lome » donnent toutes « lome ».
 */
export function cleVille(valeur: string | null | undefined): string {
  return (valeur ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\s\-‐-―_]+/g, " ")
    .trim();
}

const PAR_CLE = new Map(VILLES_CONNUES.map((v) => [cleVille(v), v]));

/** « bobo dioulasso » → « Bobo Dioulasso » ; « KIPE » → « Kipe ». */
function casseDeTitre(valeur: string): string {
  return valeur
    .toLocaleLowerCase("fr")
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toLocaleUpperCase("fr"));
}

/**
 * La ville telle qu'elle doit être enregistrée. Chaîne vide si rien de lisible.
 *
 * Ne valide pas : « 1m89 » ressort « 1m89 ». Le refus se fait dans le
 * formulaire (`villeRequise`, `villeOptionnelle`), le nettoyage ici.
 */
export function normaliserVille(valeur: string | null | undefined): string {
  const propre = (valeur ?? "").replace(/\s+/g, " ").trim();
  if (!propre) return "";
  const connue = PAR_CLE.get(cleVille(propre));
  if (connue) return connue;
  const lettres = propre.replace(/[^\p{L}]/gu, "");
  const casseUniforme = lettres === lettres.toLocaleLowerCase("fr") || lettres === lettres.toLocaleUpperCase("fr");
  return casseUniforme ? casseDeTitre(propre) : propre;
}

/** Comme `normaliserVille`, mais `null` quand il ne reste rien. */
export function normaliserVilleOuNull(valeur: string | null | undefined): string | null {
  return normaliserVille(valeur) || null;
}

/** Deux villes sont-elles la même ? */
export function memeVille(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = cleVille(a);
  return ka !== "" && ka === cleVille(b);
}

/**
 * Les villes d'une liste de valeurs, une seule fois chacune, triées.
 *
 * Pour un menu « Ville » : « Lomé » et « LOME » n'y apparaissent qu'une fois,
 * sous leur forme normalisée.
 */
export function villesDistinctes(valeurs: Iterable<string | null | undefined>): string[] {
  const parCle = new Map<string, string>();
  for (const v of valeurs) {
    const k = cleVille(v);
    if (k && !parCle.has(k)) parCle.set(k, normaliserVille(v));
  }
  return [...parCle.values()].sort((a, b) => a.localeCompare(b, "fr"));
}
