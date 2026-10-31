// Le calcul du clavier sur Android, sans écran (voir components/DefilementClavier).
// Tout est en points d'écran, mesurés depuis le haut de la fenêtre.

/** L'air gardé entre un champ et le clavier : le bord du champ collé aux touches se lit mal. */
const AIR = 24;

/** Ce que le clavier recouvre d'un écran qui finit à `basDeLEcran`. */
export function margeSousLeClavier(basDeLEcran: number, hautDuClavier: number): number {
  return Math.max(0, basDeLEcran - hautDuClavier);
}

/** De combien faire défiler pour voir un champ qui finit à `basDuChamp` ; 0 s'il est déjà visible. */
export function remonteePourLeChamp(basDuChamp: number, hautDuClavier: number): number {
  return Math.max(0, basDuChamp + AIR - hautDuClavier);
}
