"use client";

import {
  disposerSurTerrain, rayonPastille, RAYON_MAX_RANGS, type PlaceTerrain,
} from "@/lib/terrain";
import { versFormation } from "@/lib/formations";
import type { LineupEntry } from "@/types";

// ============================================
// Le terrain, et la composition dessus.
//
// Extrait de MatchLineups, qui le gardait pour lui. Le manager remplit
// maintenant sa feuille poste par poste (voir la fiche du match, mode
// composition) et a besoin de voir ce qu'il fabrique : deux dessins pour un
// meme placement auraient derive au premier ajustement, et lib/terrain
// s'impose deja de ne tenir QU'UNE geometrie pour que le joueur soit au meme
// endroit sur tous les ecrans. Le dessin suit la meme regle.
//
// ---------------------------------------------------------------------------
// UNE PELOUSE QUI EST UNE PELOUSE.
//
// Elle a longtemps ete un decor qu'on efface : un vert presque blanc sur la
// fiche publique, un vert presque noir dans l'editeur, au nom du principe que
// « les joueurs doivent s'en detacher ». Le principe est bon, la conclusion
// etait fausse — on obtenait un rectangle gris-vert que personne ne lit comme
// un terrain, et des maillots sombres qui s'y noyaient quand meme.
//
// Le vert est donc franc, le meme dans les deux themes, et c'est LUI qui fait
// reconnaitre l'image en un dixieme de seconde. Ce qui doit se detacher se
// detache autrement : les pastilles sont blanches et pleines, les noms sont
// poses sur une etiquette sombre.
//
// L'ETIQUETTE SOUS CHAQUE JOUEUR N'EST PAS UN ORNEMENT. Le nom etait ecrit a
// meme la pelouse : lisible sur le vert pale d'hier, il devient illisible des
// que le fond a du caractere, et il l'etait deja quand il tombait sur une
// ligne blanche du terrain. Une plaque sombre sous le texte le rend
// independant de ce qu'il y a derriere — c'est la seule facon de garder un
// fond dessine ET des noms lisibles.
//
// DEUX VARIANTES, ET ELLES NE CHANGENT PLUS QUE LE CADRE. `clair` pose la
// pelouse sur une page blanche, `sombre` dans un panneau noir : le vert
// s'assombrit d'un cran dans le second pour ne pas trouer l'ecran. Les
// positions, elles, n'ont jamais bouge et ne bougeront pas.
// ============================================

/**
 * « Jean-Baptiste Mensah » → « J. Mensah ». Un nom entier ne tient pas sous une
 * pastille de terrain ; l'initiale plus le nom de famille, si.
 *
 * `max` coupe ce qui reste trop long : un texte SVG ne se tronque pas tout
 * seul, il déborde sur son voisin ou hors du cadre. L'écart entre deux
 * pastilles dépend du rang le plus chargé (voir lib/terrain), donc la limite
 * est prise au plus serré.
 */
export function nomCourt(nom: string, max = 11): string {
  const bouts = nom.trim().split(/\s+/).filter(Boolean);
  if (bouts.length === 0) return "";
  const court = bouts.length === 1
    ? bouts[0]
    : `${bouts[0][0]}. ${bouts[bouts.length - 1]}`;
  return court.length > max ? `${court.slice(0, max - 1)}…` : court;
}

type Variante = "clair" | "sombre";

const PALETTES: Record<Variante, {
  pelouseHaut: string;
  pelouseBas: string;
  lignes: string;
  maillot: string;
  maillotTexte: string;
  videTrait: string;
  videTexte: string;
  etiquette: string;
  nom: string;
}> = {
  clair: {
    pelouseHaut: "#2ec06a", pelouseBas: "#15a04f",
    lignes: "#ffffff",
    maillot: "#ffffff", maillotTexte: "#064e3b",
    videTrait: "#ffffff", videTexte: "#ffffff",
    etiquette: "#0f2a1d", nom: "#ffffff",
  },
  // Un cran plus sombre : la même pelouse, mais qui ne troue pas un panneau
  // noir. Tout le reste est identique, volontairement.
  sombre: {
    pelouseHaut: "#1f9d57", pelouseBas: "#0f7a3f",
    lignes: "#ffffff",
    maillot: "#ffffff", maillotTexte: "#064e3b",
    videTrait: "#ffffff", videTexte: "#ffffff",
    etiquette: "#04150d", nom: "#ffffff",
  },
};

/**
 * La largeur de l'étiquette d'un nom.
 *
 * Un `<rect>` SVG ne se dimensionne pas sur son texte : il faut l'estimer.
 * 0.54 em par caractère est la moyenne d'une grasse sans-serif, et le nom est
 * déjà raccourci et plafonné par `nomCourt` — l'erreur reste sous le demi-
 * caractère, ce que le rembourrage absorbe.
 */
function largeurEtiquette(texte: string, taillePolice: number): number {
  return texte.length * taillePolice * 0.54 + taillePolice * 1.1;
}

export default function TerrainCompo({
  titulaires,
  taille,
  formation,
  variante = "clair",
  photos,
  onPlaceClick,
}: {
  titulaires: LineupEntry[];
  /** Voir `disposerSurTerrain` : le NvN annoncé, quand on le connaît. */
  taille?: number;
  /** « 4-3-3 », la forme annoncée par le manager. Absente, on place par poste. */
  formation?: string | null;
  variante?: Variante;
  /**
   * La photo de chaque joueur, par identifiant de ligne de feuille.
   *
   * Absente, la pastille garde son numéro — et c'est le cas courant : la
   * plupart des joueurs de club amateur n'ont pas de photo. Le visage prend
   * la place du numéro quand il existe, jamais l'inverse.
   */
  photos?: Record<string, string | null | undefined>;
  /**
   * Rend les emplacements CLIQUABLES, et fait de ce terrain un éditeur.
   *
   * C'est la seule différence entre la composition qu'on lit et celle qu'on
   * remplit : même dessin, même géométrie, même fichier. Deux terrains
   * auraient dérivé au premier ajustement.
   */
  onPlaceClick?: (index: number, place: PlaceTerrain) => void;
}) {
  const { places, ecart } = disposerSurTerrain(
    titulaires, taille, "haut", versFormation(formation),
  );
  // La pastille rapetisse quand le rang se charge, plutot que de mordre sur
  // sa voisine. 4.2 reste le confort de lecture visé.
  const r = rayonPastille(ecart, Math.min(4.2, RAYON_MAX_RANGS));
  const c = PALETTES[variante];
  const TAILLE_NOM = 2.7;
  // Un identifiant propre à ce rendu : deux terrains sur la même page
  // partageraient sinon le même dégradé, et le second réécrirait le premier.
  const idPelouse = `pelouse-${variante}`;

  return (
    <svg viewBox="0 0 100 104" role="img" aria-label="Composition sur le terrain" className="w-full">
      <defs>
        {/* Le dégradé, de la ligne médiane vers notre but : la pelouse a une
            profondeur, un aplat n'en a pas. */}
        <linearGradient id={idPelouse} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.pelouseHaut} />
          <stop offset="100%" stopColor={c.pelouseBas} />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="100" height="104" fill={`url(#${idPelouse})`} />

      {/* LES BANDES DE TONTE, très légères : ce sont elles qu'on reconnaît sur
          la photo d'un terrain, avant les lignes. À 4% d'opacité elles se
          devinent sans concurrencer les joueurs. */}
      <g fill="#ffffff" opacity="0.04" aria-hidden>
        {[0, 2, 4, 6].map((n) => (
          <rect key={n} x="0" y={n * 13} width="100" height="13" />
        ))}
      </g>

      {/* UN DEMI-TERRAIN, ET NON UN TERRAIN ENTIER.
          Le rectangle portait les deux surfaces et la ligne médiane au
          milieu : la moitié haute — celle de l'adversaire — restait vide,
          puisqu'on n'y place personne. Une composition se lit sur SON camp.
          À boîte égale, chaque ligne double donc de taille.

          La boîte reste 100×104 : les joueurs sont placés en pourcentages de
          ces coordonnées, et les changer aurait déplacé toute l'équipe. */}
      <g stroke={c.lignes} strokeWidth="0.5" fill="none" opacity="0.5">
        <rect x="3" y="3" width="94" height="98" />

        {/* En haut, la ligne médiane : le bord du cadre, et le rond central
            dont on ne voit que la moitié qui entre dans notre camp. */}
        <path d="M 34 3 A 16 16 0 0 0 66 3" />

        {/* En bas, notre but : surface de réparation, six mètres, cage. */}
        <rect x="22" y="71" width="56" height="30" />
        <rect x="36" y="89" width="28" height="12" />
        <rect x="42" y="101" width="16" height="3" />

        {/* L'arc au sommet de la surface, tracé depuis le point de penalty. */}
        <path d="M 45.42 71 A 11 11 0 0 1 54.58 71" />
      </g>

      <circle cx="50" cy="3" r="1.2" fill={c.lignes} opacity="0.5" />
      <circle cx="50" cy="81" r="0.9" fill={c.lignes} opacity="0.5" />

      {places.map((place, i) => {
        const joueur = place.entry;
        const nom = joueur ? nomCourt(joueur.name) : "";
        const l = largeurEtiquette(nom, TAILLE_NOM);
        // Les pastilles des ailes sont à 16 et 84 : une étiquette centrée
        // dessus sortirait du cadre. On ramène l'ancre vers l'intérieur plutôt
        // que de rétrécir tout le terrain pour deux joueurs.
        const ancre = Math.min(Math.max(place.x, l / 2 + 1), 99 - l / 2);
        const photo = joueur ? photos?.[joueur.playerId] : null;
        const idPhoto = `visage-${variante}-${i}`;

        return (
          <g
            key={i}
            {...(onPlaceClick
              ? {
                  onClick: () => onPlaceClick(i, place),
                  role: "button" as const,
                  tabIndex: 0,
                  onKeyDown: (e: React.KeyboardEvent<SVGGElement>) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPlaceClick(i, place);
                    }
                  },
                  "aria-label": joueur
                    ? `${joueur.name}, ${place.etiquette}. Changer ou retirer`
                    : `Emplacement libre, ${place.etiquette}. Choisir un joueur`,
                  style: { cursor: "pointer" },
                }
              : {})}
          >
            {/* L'ombre portée de la pastille : sans elle, un disque blanc sur
                un vert franc paraît collé au fond. */}
            {joueur && (
              <ellipse
                cx={place.x}
                cy={place.y + r * 0.92}
                rx={r * 0.78}
                ry={r * 0.22}
                fill="#000000"
                opacity="0.18"
              />
            )}

            <circle
              cx={place.x}
              cy={place.y}
              r={r}
              fill={joueur ? c.maillot : "transparent"}
              stroke={joueur ? "none" : c.videTrait}
              strokeWidth="0.6"
              strokeDasharray={joueur ? undefined : "1.6 1.2"}
              opacity={joueur ? 1 : 0.55}
            />

            {/* LE VISAGE, quand on l'a. Le disque blanc lui sert de cadre, et
                `slice` remplit le cercle sans déformer la photo — une tête
                étirée est pire que pas de photo du tout. */}
            {joueur && photo && (
              <>
                <defs>
                  <clipPath id={idPhoto}>
                    <circle cx={place.x} cy={place.y} r={r * 0.92} />
                  </clipPath>
                </defs>
                <image
                  href={photo}
                  x={place.x - r * 0.92}
                  y={place.y - r * 0.92}
                  width={r * 1.84}
                  height={r * 1.84}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#${idPhoto})`}
                />
              </>
            )}

            {/* Le numéro dans la pastille, le nom dessous. Un emplacement que
                personne n'occupe garde le poste : le lecteur voit qu'il manque
                un joueur, pas que le terrain est cassé.

                LA PHOTO PREND LA PLACE DU NUMÉRO, elle ne s'y superpose pas :
                un chiffre sur un visage n'est lisible sur aucun des deux. */}
            {!(joueur && photo) && (
              <text
                x={place.x}
                y={place.y + r * 0.36}
                textAnchor="middle"
                className="font-black"
                style={{ fontSize: `${(r * 0.95).toFixed(2)}px` }}
                fill={joueur ? c.maillotTexte : c.videTexte}
                opacity={joueur ? 1 : 0.65}
              >
                {joueur ? (joueur.number || "–") : place.etiquette}
              </text>
            )}

            {/* SUR UN EMPLACEMENT LIBRE ET CLIQUABLE, un « + » sous la lettre
                du poste : le pointillé dit qu'il manque quelqu'un, il ne dit
                pas qu'on peut le remplir d'un clic. */}
            {!joueur && onPlaceClick && (
              <text
                x={place.x}
                y={place.y + r * 1.02}
                textAnchor="middle"
                className="font-black"
                style={{ fontSize: `${(r * 0.62).toFixed(2)}px` }}
                fill={c.videTexte}
                opacity="0.75"
              >
                +
              </text>
            )}

            {joueur && (
              <>
                <rect
                  x={ancre - l / 2}
                  y={place.y + r + 1.1}
                  width={l}
                  height={TAILLE_NOM * 1.75}
                  rx={TAILLE_NOM * 0.875}
                  fill={c.etiquette}
                  opacity="0.82"
                />
                <text
                  x={ancre}
                  y={place.y + r + 1.1 + TAILLE_NOM * 1.24}
                  textAnchor="middle"
                  className="font-bold"
                  style={{ fontSize: `${TAILLE_NOM}px` }}
                  fill={c.nom}
                >
                  {nom}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
