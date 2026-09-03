"use client";

import { disposerSurTerrain, rayonPastille, RAYON_MAX_RANGS } from "@/lib/terrain";
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
// DEUX PALETTES, UN DESSIN. La fiche publique est sur fond blanc, l'editeur
// du manager sur fond noir : seules les couleurs changent, jamais les
// positions.
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
  pelouse: string;
  lignes: string;
  maillot: string;
  maillotTexte: string;
  videTrait: string;
  videTexte: string;
  nom: string;
}> = {
  // Un vert très pâle : le terrain est un décor, pas le sujet, les joueurs
  // doivent s'en détacher.
  clair: {
    pelouse: "#f0fdf4", lignes: "#bbf7d0",
    maillot: "#065f46", maillotTexte: "#ffffff",
    videTrait: "#d1d5db", videTexte: "#9ca3af",
    nom: "#111827",
  },
  // Même logique sur fond noir : la pelouse s'efface, les maillots ressortent.
  sombre: {
    pelouse: "#0b1a14", lignes: "#14532d",
    maillot: "#34d399", maillotTexte: "#052e20",
    videTrait: "#374151", videTexte: "#6b7280",
    nom: "#e5e7eb",
  },
};

export default function TerrainCompo({
  titulaires,
  taille,
  variante = "clair",
}: {
  titulaires: LineupEntry[];
  /** Voir `disposerSurTerrain` : le NvN annoncé, quand on le connaît. */
  taille?: number;
  variante?: Variante;
}) {
  const { places, ecart } = disposerSurTerrain(titulaires, taille);
  // La pastille rapetisse quand le rang se charge, plutot que de mordre sur
  // sa voisine. 4.2 reste le confort de lecture visé.
  const r = rayonPastille(ecart, Math.min(4.2, RAYON_MAX_RANGS));
  const c = PALETTES[variante];

  return (
    <svg viewBox="0 0 100 104" role="img" aria-label="Composition sur le terrain" className="w-full">
      {/* La pelouse et ses lignes. */}
      <rect x="0" y="0" width="100" height="104" fill={c.pelouse} />
      <g stroke={c.lignes} strokeWidth="0.6" fill="none">
        <rect x="3" y="3" width="94" height="98" />
        <line x1="3" y1="52" x2="97" y2="52" />
        <circle cx="50" cy="52" r="11" />
        <rect x="26" y="3" width="48" height="16" />
        <rect x="26" y="85" width="48" height="16" />
        <rect x="38" y="3" width="24" height="6" />
        <rect x="38" y="95" width="24" height="6" />
      </g>
      <circle cx="50" cy="52" r="1.2" fill={c.lignes} />

      {places.map((place, i) => {
        const joueur = place.entry;
        return (
          <g key={i}>
            <circle
              cx={place.x}
              cy={place.y}
              r={r}
              fill={joueur ? c.maillot : "transparent"}
              stroke={joueur ? c.maillot : c.videTrait}
              strokeWidth="0.7"
              strokeDasharray={joueur ? undefined : "1.6 1.2"}
            />
            {/* Le numéro dans la pastille, le nom dessous. Un emplacement que
                personne n'occupe garde le poste en gris : le lecteur voit
                qu'il manque un joueur, pas que le terrain est cassé. */}
            <text
              x={place.x}
              y={place.y + r * 0.36}
              textAnchor="middle"
              className="font-black"
              style={{ fontSize: `${(r * 0.95).toFixed(2)}px` }}
              fill={joueur ? c.maillotTexte : c.videTexte}
            >
              {joueur ? (joueur.number || "–") : place.etiquette}
            </text>
            {joueur && (
              <text
                // Les pastilles des ailes sont à 16 et 84 : un nom centré
                // dessus sortirait du cadre. On ramène l'ancre vers l'intérieur
                // plutôt que de rétrécir tout le terrain pour deux joueurs.
                x={Math.min(Math.max(place.x, 13), 87)}
                y={place.y + r + 3.8}
                textAnchor="middle"
                className="font-bold"
                style={{ fontSize: "2.7px" }}
                fill={c.nom}
              >
                {nomCourt(joueur.name)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
