// ============================================
// LES ÉCRANS DE DÉMARRAGE iOS, ET LES APPAREILS QUI LES RÉCLAMENT.
//
// Une PWA autonome sur iOS n'affiche une image de lancement que si la requête
// média correspond EXACTEMENT à l'appareil : largeur CSS, hauteur CSS ET
// densité de pixels. Une seule de travers et Safari ignore la balise pour
// ouvrir sur un écran blanc — d'où cette table plutôt qu'une image unique.
//
// Android ne prend aucune image : Chrome fabrique son écran de démarrage avec
// le nom du manifeste, sa `background_color` et l'icône 512. C'est pourquoi
// `background_color` vaut la couleur de fond de l'illustration, pour que les
// deux plateformes arrivent au même endroit.
//
// CETTE LISTE EST PARTAGÉE, ET C'EST TOUT SON INTÉRÊT. Le `<head>` déclare une
// balise par appareil, et scripts/generer-splash.ts produit un fichier par
// appareil. Deux listes tenues à la main auraient fini par diverger — une
// entrée ajoutée d'un côté donne une balise qui pointe vers un fichier absent,
// c'est-à-dire un écran blanc au lancement, exactement ce qu'on répare ici.
// ============================================

/** `[largeur CSS, hauteur CSS, densité]`, un triplet par appareil. */
export const IOS_LAUNCH_DEVICES: ReadonlyArray<readonly [number, number, number]> = [
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3],
  [414, 896, 2], [414, 896, 3], [390, 844, 3], [360, 780, 3],
  [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3],
  [768, 1024, 2], [834, 1112, 2], [834, 1194, 2], [820, 1180, 2], [1024, 1366, 2],
];

/**
 * La couleur de fond de l'illustration.
 *
 * Elle sert deux fois : le manifeste la donne à Chrome, qui peint son propre
 * écran de démarrage dessus, et le générateur la pose derrière l'image. Une
 * seule constante pour que les deux ne se contredisent pas.
 */
export const SPLASH_FOND = "#0d291b";

/** Le chemin d'un fichier de démarrage, pour un appareil donné. */
export function cheminSplash(w: number, h: number, dpr: number): string {
  return `/splash/splash-${w * dpr}x${h * dpr}.jpg`;
}
