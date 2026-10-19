// ============================================
// La vidéo « Joueur de la semaine » : l'affiche verticale qui se monte sous nos
// yeux, chaque élément entrant à sa façon. Validée sur l'essai du 2026-10-19
// (voir docs/superpowers/specs/2026-10-19-joueur-de-la-semaine-design.md,
// « C. La vidéo »).
//
// Pur : ce module dit où en est chaque calque à l'instant t, rien de plus. Le
// navigateur de l'administration dessine et encode (voir
// lib/video-joueur-semaine-client) ; les calques viennent du serveur (voir
// lib/og-joueur-semaine, `calquesJoueurSemaine`).
//
// IMAGE PAR IMAGE, JAMAIS EN TEMPS RÉEL : t = n / FPS. Le rendu ne dépend ni de
// la vitesse de la machine ni d'un onglet en arrière-plan, où
// `requestAnimationFrame` ne tourne pas.
// ============================================

export const FPS = 30;
export const DUREE = 10;

export interface EtatCalque {
  dx: number;
  dy: number;
  opacite: number;
  /** La part dévoilée, de bas en haut (la photo). */
  devoile: number;
  /** Le zoom du contenu, centré (la photo). */
  zoom: number;
}

/** Ce qu'il faut d'un calque pour l'animer : sa clé et sa place (voir `CalqueVideo`). */
export interface PlaceDuCalque {
  cle: string;
  left: number;
  top: number;
  w: number;
  h: number;
}

const borne = (x: number) => Math.max(0, Math.min(1, x));
const avance = (t: number, debut: number, duree: number) => borne((t - debut) / duree);
const sortieCubique = (x: number) => 1 - Math.pow(1 - x, 3);
const entreeSortieCubique = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Dépasse un peu, puis revient : le bandeau qui « claque ». */
function sortieRetour(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** Le rebond de l'écusson qui tombe. */
function sortieRebond(x: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x - 1.5 / d) ** 2 + 0.75;
  if (x < 2.5 / d) return n * (x - 2.25 / d) ** 2 + 0.9375;
  return n * (x - 2.625 / d) ** 2 + 0.984375;
}

/** Un zéro est un zéro : pas de −0 ni de 1e-17 qui fasse trembler un calque au repos. */
const net = (x: number) => (Math.abs(x) < 1e-9 ? 0 : x);

/**
 * Où en est un calque à l'instant `t`, en secondes. `largeur` : celle de
 * l'image, d'où l'étiquette du nom glisse.
 */
export function etatDuCalque(c: PlaceDuCalque, t: number, largeur: number): EtatCalque {
  let dx = 0;
  let dy = 0;
  let opacite = 1;
  let devoile = 1;
  let zoom = 1;
  const [genre, rang] = c.cle.split("-");
  const indice = Number(rang ?? 0);

  switch (genre) {
    case "blocHaut": // descend du haut
      dy = -(c.top + c.h) * (1 - sortieCubique(avance(t, 0, 0.45)));
      break;
    case "bande": // descend du haut, juste après
      dy = -(c.top + c.h) * (1 - sortieCubique(avance(t, 0.1, 0.6)));
      break;
    case "semaine": { // monte en fondu
      const p = sortieCubique(avance(t, 0.75, 0.5));
      opacite = p;
      dy = 30 * (1 - p);
      break;
    }
    case "photo": // se dévoile de bas en haut en reculant, puis avance très lentement
      devoile = entreeSortieCubique(avance(t, 0.35, 0.75));
      zoom = t < 1.6
        ? 1.08 - 0.08 * sortieCubique(avance(t, 0.35, 1.25))
        : 1 + 0.045 * avance(t, 1.6, DUREE - 1.6);
      break;
    case "blocDroite": // glisse depuis la droite
      dx = 420 * (1 - sortieCubique(avance(t, 0.9, 0.5)));
      break;
    case "bandeau": // claque depuis la gauche, dépasse, se cale
      dx = -(c.left + c.w + 40) * (1 - sortieRetour(avance(t, 1.2, 0.6)));
      break;
    case "nom": // glisse depuis la droite
      dx = (largeur - c.left) * (1 - sortieCubique(avance(t, 1.75, 0.45)));
      break;
    case "ecusson": { // tombe et rebondit, l'un après l'autre
      // En dixièmes entiers : 2.2 + 0.2 vaut 2.4000000000000004, et l'écusson
      // ratait l'image de son départ.
      const debut = (22 + indice * 2) / 10;
      opacite = t >= debut ? 1 : 0;
      dy = -(c.top + c.h + 20) * (1 - sortieRebond(avance(t, debut, 0.7)));
      break;
    }
    case "label":
      opacite = avance(t, 2.6, 0.35);
      break;
    case "ligne": { // montent une par une
      const p = sortieCubique(avance(t, (280 + indice * 22) / 100, 0.45));
      opacite = p;
      dy = 40 * (1 - p);
      break;
    }
    case "pied": {
      const p = sortieCubique(avance(t, 3.7, 0.5));
      opacite = p;
      dy = 20 * (1 - p);
      break;
    }
  }
  return { dx: net(dx), dy: net(dy), opacite: net(opacite), devoile: net(devoile), zoom };
}
