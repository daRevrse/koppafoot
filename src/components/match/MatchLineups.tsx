"use client";

import { useState } from "react";
import TerrainCompo, { nomCourt } from "@/components/match/TerrainCompo";
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
// Le placement suit le POSTE, désormais porté par la feuille de match (voir
// lib/postes), et choisi match par match par le manager. Le dessin lui-même
// vit dans TerrainCompo, partagé avec l'éditeur de feuille : un joueur doit
// se trouver au même endroit qu'on lise le match ou qu'on le compose.
// ============================================

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
  // Tous les titulaires, sans plafond a onze : une competition se joue en NvN
  // (voir lib/terrain), et couper a onze aurait fait disparaitre des joueurs
  // d'un match a quatorze autant qu'il inventait des trous dans un 5v5.
  const titulaires = equipe.entries.filter((e) => e.role === "starter");
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
              <TerrainCompo titulaires={titulaires} />
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
