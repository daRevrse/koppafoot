import {
  avance, net, sortieCubique, sortieRetour, type EtatCalque, type PlaceDuCalque,
} from "@/lib/video-joueur-semaine";

// ============================================
// La vidéo d'annonce d'un match chaud : le flyer MATCHDAY, en vertical, qui
// se construit sous nos yeux (lib/og-annonce pour les calques). Voir
// docs/superpowers/specs/2026-10-22-matchs-chauds-design.md.
//
// HUIT SECONDES, TOUT EN PLACE AU BOUT DE TROIS ET DEMIE : le titre claque,
// les deux écussons entrent chacun de son côté, puis la date, l'heure et le
// terrain ; le reste du temps, on lit. Pas de forme des équipes (décidé avec
// le propriétaire), pas de musique.
//
// Pur : ce module dit où en est chaque calque à l'instant t. Le navigateur de
// l'organisateur dessine et encode (lib/video-joueur-semaine-client).
// ============================================

export const DUREE_ANNONCE = 8;

/** Les calques, dans l'ordre d'empilement (lib/og-annonce les rend dans cet ordre). */
export const CLES_ANNONCE = ["fond", "logo", "surtitre", "titre", "camp-0", "versus", "camp-1", "infos", "pied"] as const;

/** Où en est un calque de l'annonce à l'instant `t`, en secondes. */
export function etatCalqueAnnonce(c: PlaceDuCalque, t: number, largeur: number): EtatCalque {
  let dx = 0;
  let dy = 0;
  let opacite = 1;
  const monte = (debut: number, duree: number, distance: number) => {
    const p = sortieCubique(avance(t, debut, duree));
    opacite = p;
    dy = distance * (1 - p);
  };

  switch (c.cle) {
    case "logo": // descend du haut en fondu
      monte(0, 0.5, -40);
      break;
    case "surtitre":
      monte(0.35, 0.45, 24);
      break;
    case "titre": // claque depuis la gauche, dépasse, se cale
      dx = -(c.left + c.w + 40) * (1 - sortieRetour(avance(t, 0.55, 0.65)));
      break;
    case "camp-0": // entre par la gauche
      dx = -(c.left + c.w + 20) * (1 - sortieCubique(avance(t, 1.3, 0.6)));
      break;
    case "camp-1": // entre par la droite, juste après
      dx = (largeur - c.left + 20) * (1 - sortieCubique(avance(t, 1.5, 0.6)));
      break;
    case "versus":
      monte(2.05, 0.35, 30);
      break;
    case "infos":
      monte(2.5, 0.5, 40);
      break;
    case "pied":
      monte(3.0, 0.5, 20);
      break;
  }
  return { dx: net(dx), dy: net(dy), opacite: net(opacite), devoile: 1, zoom: 1 };
}
