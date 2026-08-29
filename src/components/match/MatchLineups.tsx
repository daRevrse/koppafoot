"use client";

import { useState } from "react";
import type { LineupEntry } from "@/types";

// ============================================
// La composition, sur un terrain.
//
// Elle s'affichait en deux colonnes de texte côte à côte — deux listes de
// noms numérotés. Une liste ne dit pas qui joue derrière qui : c'est
// exactement l'information qu'une composition porte, et la seule qu'un
// tableau perdait. Sur un téléphone, les deux colonnes tombaient de surcroît
// à 160px de large et forçaient un écran de défilement par équipe.
//
// UN SEUL TERRAIN, DEUX BOUTONS. Afficher les deux camps sur un même terrain
// demanderait deux fois onze pastilles dans la hauteur d'un écran : illisible.
// On montre une équipe à la fois, et on bascule. Le terrain garde la même
// place quel que soit le camp regardé, donc rien ne saute sous le doigt.
//
// Le dispositif est un GK-4-3-3 quelle que soit la vraie organisation : la
// plateforme ne stocke pas de poste, seulement un ordre et un rôle
// (titulaire / remplaçant). Le 4-3-3 est le dispositif le plus lisible d'un
// coup d'œil, et il place les onze titulaires sans jamais mentir sur autre
// chose que leur rôle exact — que personne n'a saisi.
// ============================================

/** Le GK-4-3-3, en coordonnées relatives : x de 0 (gauche) à 100, y de 0 à 100. */
const FORMATION = [
  { x: 50, y: 91, poste: "G" },
  { x: 16, y: 73, poste: "D" }, { x: 38, y: 77, poste: "D" },
  { x: 62, y: 77, poste: "D" }, { x: 84, y: 73, poste: "D" },
  { x: 26, y: 55, poste: "M" }, { x: 50, y: 59, poste: "M" }, { x: 74, y: 55, poste: "M" },
  { x: 22, y: 33, poste: "A" }, { x: 50, y: 26, poste: "A" }, { x: 78, y: 33, poste: "A" },
];

/**
 * « Jean-Baptiste Mensah » → « J. Mensah ». Un nom entier ne tient pas sous une
 * pastille de terrain ; l'initiale plus le nom de famille, si.
 *
 * `max` coupe ce qui reste trop long : deux joueurs de la même ligne sont
 * séparés de 22 unités sur le terrain, et un texte SVG ne se tronque pas tout
 * seul — il déborde sur son voisin, ou hors du cadre.
 */
function nomCourt(nom: string, max = 11): string {
  const bouts = nom.trim().split(/\s+/).filter(Boolean);
  if (bouts.length === 0) return "";
  const court = bouts.length === 1
    ? bouts[0]
    : `${bouts[0][0]}. ${bouts[bouts.length - 1]}`;
  return court.length > max ? `${court.slice(0, max - 1)}…` : court;
}

function Terrain({ titulaires }: { titulaires: LineupEntry[] }) {
  return (
    <svg viewBox="0 0 100 104" role="img" aria-label="Composition sur le terrain" className="w-full">
      {/* La pelouse et ses lignes. Un vert très pâle : le terrain est un
          décor, pas le sujet, les joueurs doivent s'en détacher. */}
      <rect x="0" y="0" width="100" height="104" fill="#f0fdf4" />
      <g stroke="#bbf7d0" strokeWidth="0.6" fill="none">
        <rect x="3" y="3" width="94" height="98" />
        <line x1="3" y1="52" x2="97" y2="52" />
        <circle cx="50" cy="52" r="11" />
        <rect x="26" y="3" width="48" height="16" />
        <rect x="26" y="85" width="48" height="16" />
        <rect x="38" y="3" width="24" height="6" />
        <rect x="38" y="95" width="24" height="6" />
      </g>
      <circle cx="50" cy="52" r="1.2" fill="#bbf7d0" />

      {FORMATION.map((place, i) => {
        const joueur = titulaires[i];
        return (
          <g key={i}>
            <circle
              cx={place.x}
              cy={place.y}
              r="4.2"
              fill={joueur ? "#065f46" : "#ffffff"}
              stroke={joueur ? "#065f46" : "#d1d5db"}
              strokeWidth="0.7"
              strokeDasharray={joueur ? undefined : "1.6 1.2"}
            />
            {/* Le numéro dans la pastille, le nom dessous. Un emplacement que
                personne n'occupe garde le poste en gris : le lecteur voit
                qu'il manque un joueur, pas que le terrain est cassé. */}
            <text
              x={place.x}
              y={place.y + 1.5}
              textAnchor="middle"
              className="font-black"
              style={{ fontSize: "4px" }}
              fill={joueur ? "#ffffff" : "#9ca3af"}
            >
              {joueur ? (joueur.number || "–") : place.poste}
            </text>
            {joueur && (
              <text
                // Les pastilles des ailes sont à 16 et 84 : un nom centré
                // dessus sortirait du cadre. On ramène l'ancre vers l'intérieur
                // plutôt que de rétrécir tout le terrain pour deux joueurs.
                x={Math.min(Math.max(place.x, 13), 87)}
                y={place.y + 8}
                textAnchor="middle"
                className="font-bold"
                style={{ fontSize: "2.7px" }}
                fill="#111827"
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

export default function MatchLineups({
  home, away,
}: {
  home: { name: string; entries: LineupEntry[] };
  away: { name: string; entries: LineupEntry[] };
}) {
  // On ouvre sur le camp qui a une compo, s'il n'y en a qu'un : basculer pour
  // découvrir que l'autre côté est vide est un geste pour rien.
  const [cote, setCote] = useState<"home" | "away">(
    home.entries.length === 0 && away.entries.length > 0 ? "away" : "home",
  );

  const equipe = cote === "home" ? home : away;
  const titulaires = equipe.entries.filter((e) => e.role === "starter").slice(0, 11);
  const remplacants = equipe.entries.filter((e) => e.role === "substitute");

  return (
    <div>
      {/* Les deux boutons de bascule. Segmentés plutôt qu'empilés : ils sont
          exclusifs, et le geste est un aller-retour. */}
      <div className="grid grid-cols-2 divide-x divide-gray-200/70 border border-gray-200/70">
        {(["home", "away"] as const).map((k) => {
          const e = k === "home" ? home : away;
          const on = cote === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setCote(k)}
              aria-pressed={on}
              className={`truncate px-3 py-2.5 text-[11px] font-black uppercase tracking-wide transition-colors ${
                on ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:text-gray-900"
              }`}
            >
              {e.name}
            </button>
          );
        })}
      </div>

      {titulaires.length === 0 ? (
        <p className="border border-t-0 border-gray-200/70 bg-gray-50/50 py-10 text-center text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
          Pas de compo
        </p>
      ) : (
        <>
          {/* Le terrain garde le ratio d'un terrain, donc sa hauteur suit sa
              largeur. Sans plafond il occuperait 900px sur un écran large,
              pour onze pastilles qui n'ont rien à y gagner. */}
          <div className="border border-t-0 border-gray-200/70">
            <div className="mx-auto w-full max-w-sm">
              <Terrain titulaires={titulaires} />
            </div>
          </div>

          {/* Les remplaçants, en une ligne de pastilles. Ils tiennent en deux
              lignes de texte là où une seconde colonne aurait coûté un écran. */}
          {remplacants.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
                Banc
              </span>
              {remplacants.map((r) => (
                <span key={r.playerId} className="text-[11px] font-bold text-gray-600">
                  <span className="mr-1 tabular-nums text-gray-400">{r.number || "–"}</span>
                  {nomCourt(r.name)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
