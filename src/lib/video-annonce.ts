import {
  avance, net, sortieCubique, sortieRetour, type EtatCalque, type PlaceDuCalque,
} from "@/lib/video-joueur-semaine";

// ============================================
// La vidéo d'annonce d'un match chaud : une accroche, puis le flyer MATCHDAY,
// en vertical, qui se construit sous nos yeux (lib/og-annonce pour les
// calques). Voir docs/superpowers/specs/2026-10-22-matchs-chauds-design.md.
//
// DIX SECONDES, EN DEUX TEMPS.
//
//  1. L'ACCROCHE, deux secondes : une flamme s'allume et « MATCH À NE PAS
//     MANQUER » claque à l'écran. La première version montait le flyer
//     d'emblée, et rien ne disait pourquoi regarder : dans un fil de statuts,
//     c'était une affiche de match comme les autres. La flamme est là DÈS LA
//     PREMIÈRE IMAGE : c'est elle que WhatsApp et TikTok prennent en vignette.
//
//  2. L'AFFICHE, en place à cinq secondes et demie : un bandeau orange
//     « À ne pas manquer » reprend l'accroche en tête, le titre claque, les
//     deux écussons entrent chacun de son côté, puis la date, l'heure et le
//     terrain ; le reste du temps, on lit.
//
// Pas de forme des équipes (décidé avec le propriétaire), pas de musique.
//
// Pur : ce module dit où en est chaque calque à l'instant t. Le navigateur de
// l'organisateur dessine et encode (lib/video-joueur-semaine-client).
// ============================================

export const DUREE_ANNONCE = 10;

/** L'accroche tient l'écran jusque-là, puis s'efface. */
export const FIN_ACCROCHE = 1.9;
/** Le premier élément de l'affiche part à cet instant. */
const AFFICHE = 2.1;

/** Les calques de l'accroche : à l'écran au début, partis ensuite. */
export const CLES_ACCROCHE = ["lueur", "flamme", "accroche-0", "accroche-1"] as const;

/** Les calques, dans l'ordre d'empilement (lib/og-annonce les rend dans cet ordre). */
export const CLES_ANNONCE = [
  "fond", ...CLES_ACCROCHE,
  "bandeau", "logo", "surtitre", "titre", "camp-0", "versus", "camp-1", "infos", "pied",
] as const;

/** Où en est un calque de l'annonce à l'instant `t`, en secondes. */
export function etatCalqueAnnonce(c: PlaceDuCalque, t: number, largeur: number): EtatCalque {
  let dx = 0;
  let dy = 0;
  let opacite = 1;
  let echelle = 1;
  const monte = (debut: number, duree: number, distance: number) => {
    const p = sortieCubique(avance(t, debut, duree));
    opacite = p;
    dy = distance * (1 - p);
  };
  /** La sortie de l'accroche : elle s'efface en montant. */
  const sort = () => {
    const p = avance(t, FIN_ACCROCHE, 0.3);
    opacite = 1 - p;
    dy = -50 * p * p;
  };

  switch (c.cle) {
    // ── L'accroche ──────────────────────────────────────────
    case "lueur": // la chaleur derrière la flamme, là dès la première image
      opacite = 1 - avance(t, FIN_ACCROCHE, 0.5);
      break;
    case "flamme": // s'allume en grossissant, puis bat
      sort();
      echelle = t < 0.45
        ? 0.7 + 0.3 * sortieRetour(avance(t, 0, 0.45))
        : 1 + 0.035 * Math.sin((t - 0.45) * 2 * Math.PI * 1.5);
      echelle *= 1 - 0.25 * avance(t, FIN_ACCROCHE, 0.3);
      break;
    case "accroche-0": // « MATCH À NE PAS » claque depuis la gauche
      sort();
      dx = -(c.left + c.w + 40) * (1 - sortieRetour(avance(t, 0.25, 0.5)));
      break;
    case "accroche-1": // « MANQUER » claque depuis la droite, juste après
      sort();
      dx = (largeur - c.left + 40) * (1 - sortieRetour(avance(t, 0.45, 0.5)));
      break;

    // ── L'affiche ───────────────────────────────────────────
    case "bandeau": { // reprend l'accroche en tête : surgit en grossissant
      const p = avance(t, AFFICHE - 0.1, 0.4);
      opacite = Math.min(1, p * 3);
      echelle = 0.6 + 0.4 * sortieRetour(p);
      break;
    }
    case "logo": // descend du haut en fondu
      monte(AFFICHE, 0.5, -40);
      break;
    case "surtitre":
      monte(AFFICHE + 0.35, 0.45, 24);
      break;
    case "titre": // claque depuis la gauche, dépasse, se cale
      dx = -(c.left + c.w + 40) * (1 - sortieRetour(avance(t, AFFICHE + 0.55, 0.65)));
      break;
    case "camp-0": // entre par la gauche
      dx = -(c.left + c.w + 20) * (1 - sortieCubique(avance(t, AFFICHE + 1.3, 0.6)));
      break;
    case "camp-1": // entre par la droite, juste après
      dx = (largeur - c.left + 20) * (1 - sortieCubique(avance(t, AFFICHE + 1.5, 0.6)));
      break;
    case "versus":
      monte(AFFICHE + 2.05, 0.35, 30);
      break;
    case "infos":
      monte(AFFICHE + 2.5, 0.5, 40);
      break;
    case "pied":
      monte(AFFICHE + 3.0, 0.5, 20);
      break;
  }
  return { dx: net(dx), dy: net(dy), opacite: net(opacite), devoile: 1, zoom: 1, echelle: net(echelle - 1) + 1 };
}
