// ============================================
// Répartir cent points entre plusieurs parts.
//
// Arrondir chaque part séparément ne tombe pas toujours sur 100 : trois tiers
// font 33 + 33 + 33 = 99. Sur une barre dont les segments prennent leur
// largeur au pourcentage, le point perdu se lit — trois chiffres qui ne font
// pas un tout.
//
// On arrondit donc chaque part, puis l'écart — un point au plus, avec trois
// parts — se reporte sur la plus grande, là où il pèse le moins.
// ============================================

export function repartirCent<K extends string>(valeurs: Record<K, number>): Record<K, number> {
  const cles = Object.keys(valeurs) as K[];
  const total = cles.reduce((somme, k) => somme + Math.max(0, valeurs[k]), 0);
  const parts = {} as Record<K, number>;

  if (total <= 0) {
    for (const k of cles) parts[k] = 0;
    return parts;
  }

  for (const k of cles) parts[k] = Math.round((Math.max(0, valeurs[k]) / total) * 100);

  const ecart = 100 - cles.reduce((somme, k) => somme + parts[k], 0);
  if (ecart !== 0) {
    const plusGrande = cles.reduce((a, b) => (valeurs[b] > valeurs[a] ? b : a));
    parts[plusGrande] += ecart;
  }
  return parts;
}
