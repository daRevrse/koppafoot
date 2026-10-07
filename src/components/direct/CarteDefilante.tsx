"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMedia } from "@/hooks/useMedia";

// ============================================
// Une carte qui fait défiler plusieurs contenus à la même place : sur le
// Direct, les Top performances puis les terrains à la une (voir lib/vitrine).
//
// LA HAUTEUR DE LA PLUS GRANDE. Les diapositives sont empilées dans la même
// cellule de grille et s'échangent en fondu : la carte ne change pas de
// hauteur d'une diapositive à l'autre, et rien ne saute autour d'elle.
//
// LE DÉFILEMENT S'ARRÊTE quand on survole la carte ou qu'on la parcourt au
// clavier, quand l'onglet est caché, et chez qui a demandé à réduire les
// animations — on choisit alors aux points. Une diapositive cachée est
// `inert` : ni le clavier ni un lecteur d'écran n'y entrent.
// ============================================

/** Le temps d'une diapositive, celui des annonces (lib/partenaires). */
const DUREE_DIAPO_MS = 8000;

export interface Diapo {
  cle: string;
  /** Ce que disent le point qui y mène et le lecteur d'écran. */
  nom: string;
  contenu: ReactNode;
}

export default function CarteDefilante({ diapos, libelle }: { diapos: Diapo[]; libelle: string }) {
  const [indice, setIndice] = useState(0);
  const [pause, setPause] = useState(false);
  const reduit = useMedia("(prefers-reduced-motion: reduce)");
  const n = diapos.length;
  const courante = n > 0 ? indice % n : 0;

  useEffect(() => {
    if (n < 2 || pause || reduit) return;
    const minuterie = setInterval(() => {
      if (!document.hidden) setIndice((i) => (i + 1) % n);
    }, DUREE_DIAPO_MS);
    return () => clearInterval(minuterie);
  }, [n, pause, reduit]);

  return (
    <section
      aria-roledescription="carrousel"
      aria-label={libelle}
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onFocusCapture={() => setPause(true)}
      onBlurCapture={() => setPause(false)}
      className="border border-gray-200/70 bg-white"
    >
      <div className="grid">
        {diapos.map((d, i) => {
          const visible = i === courante;
          return (
            <div
              key={d.cle}
              role="group"
              aria-roledescription="diapositive"
              aria-label={d.nom}
              aria-hidden={!visible}
              inert={!visible}
              className={`flex flex-col [grid-area:1/1] transition-[opacity,visibility] duration-500 ${
                visible ? "visible opacity-100" : "invisible opacity-0"
              }`}
            >
              {d.contenu}
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <div className="flex items-center justify-center gap-1.5 border-t border-gray-200/70 py-2">
          {diapos.map((d, i) => (
            <button
              key={d.cle}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={d.nom}
              aria-current={i === courante}
              className={`h-1.5 rounded-full transition-all ${
                i === courante ? "w-5 bg-emerald-500" : "w-1.5 bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
