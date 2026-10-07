"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, Star } from "lucide-react";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { formatCourt, prixHeure, surfaceCourte } from "@/lib/terrains";
import type { TerrainDeVitrine } from "@/lib/vitrine";

// ============================================
// Un terrain dans la carte défilante du Direct (voir CarteDefilante et
// lib/vitrine) : sa photo, ce qu'on y joue, son prix, et le lien vers sa
// fiche, d'où l'on réserve.
// ============================================

const T = textes(
  {
    titre: "Terrain à la une",
    titreDecouverte: "Terrain à découvrir",
    aLaUne: "À la une",
    aDecouvrir: "À découvrir",
    avis: (n: number) => `${n} avis`,
    tous: "Tous les terrains",
  },
  {
    titre: "Featured pitch",
    titreDecouverte: "Pitch to discover",
    aLaUne: "Featured",
    aDecouvrir: "Discover",
    avis: (n: number) => `${n} review${n === 1 ? "" : "s"}`,
    tous: "All pitches",
  },
);

/** Les terrains de la vitrine, demandés une fois par page, seulement quand la carte est à l'écran. */
let demande: Promise<{ terrains: TerrainDeVitrine[]; aLaUne: boolean }> | null = null;

export function useVitrineDesTerrains(actif: boolean): { terrains: TerrainDeVitrine[]; aLaUne: boolean } {
  const [vitrine, setVitrine] = useState<{ terrains: TerrainDeVitrine[]; aLaUne: boolean }>({ terrains: [], aLaUne: false });
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    demande ??= fetch("/api/public/terrains-a-la-une")
      .then((r) => (r.ok ? r.json() : { terrains: [], aLaUne: false }))
      .catch(() => ({ terrains: [], aLaUne: false }));
    void demande.then((v) => {
      if (vivant) setVitrine({ terrains: Array.isArray(v.terrains) ? v.terrains : [], aLaUne: v.aLaUne === true });
    });
    return () => { vivant = false; };
  }, [actif]);
  return vitrine;
}

export default function DiapoTerrain({ terrain, aLaUne }: { terrain: TerrainDeVitrine; aLaUne: boolean }) {
  const t = useTextes(T);
  const { langue } = useLangue();
  const note = terrain.note.toFixed(1).replace(".", langue === "fr" ? "," : ".");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <p className="flex items-center gap-1.5 font-display text-sm font-black text-gray-900">
          <MapPin size={15} className="text-emerald-600" />
          {aLaUne ? t.titre : t.titreDecouverte}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
            aLaUne ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {aLaUne ? t.aLaUne : t.aDecouvrir}
        </span>
      </div>

      <Link href={`/terrains/${terrain.id}`} className="group block flex-1 border-t border-gray-200/70">
        <span className="relative block aspect-[16/9] overflow-hidden bg-gray-900">
          {terrain.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={terrain.photo}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-800 via-gray-900 to-black">
              <MapPin size={28} className="text-white/25" />
            </span>
          )}
        </span>
        <span className="block px-4 py-3">
          <span className="block truncate font-display text-base font-black tracking-tight text-gray-900 group-hover:text-emerald-700">
            {terrain.nom}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
            {terrain.ville && <span>{terrain.ville}</span>}
            {terrain.format && <span>{formatCourt(terrain.format)}</span>}
            {terrain.surface && <span>{surfaceCourte(terrain.surface)}</span>}
          </span>
          <span className="mt-2 flex items-center justify-between gap-2 text-xs font-bold">
            <span className="text-gray-700">{prixHeure(terrain.prix)}</span>
            {terrain.avis > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <Star size={12} className="fill-current" />
                {note}
                <span className="font-semibold text-gray-400">· {t.avis(terrain.avis)}</span>
              </span>
            )}
          </span>
        </span>
      </Link>

      <Link
        href="/terrains/annuaire"
        className="flex items-center justify-center gap-1 border-t border-gray-200/70 py-2.5 text-[10px] font-black uppercase tracking-wide text-emerald-500 transition-colors hover:bg-gray-50 hover:text-emerald-600"
      >
        {t.tous}
        <ChevronRight size={12} />
      </Link>
    </div>
  );
}
