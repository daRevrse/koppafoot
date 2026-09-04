"use client";

import { useEffect, useRef } from "react";

// ============================================
// Publier la hauteur réelle d'un élément dans une variable CSS.
//
// Le problème que ça résout, et il est déjà arrivé une fois dans ce produit
// (voir le commentaire de `useHeaderHeight` dans layout/v2/ScoreHeader) : une
// barre collante s'épingle sous un en-tête dont la hauteur dépend du
// terminal — padding qui change au point de rupture, encoche, rotation. Un
// offset écrit à la main, `top-[57px]`, tombe juste sur la machine de celui
// qui l'a mesuré et laisse glisser la barre sous l'en-tête partout ailleurs.
//
// `ResizeObserver` en `border-box` : la hauteur d'un en-tête change par son
// PADDING, et la boîte de contenu — celle qu'on observe par défaut — ne bouge
// alors pas d'un pixel. C'est l'erreur qui avait figé `--header-h` sur la
// valeur du premier rendu.
//
// ScoreHeader garde sa propre copie de ce calcul pour l'instant : la migrer
// touche l'en-tête de toutes les pages du produit, ça ne se fait pas en
// passant.
// ============================================

export function useHauteurPubliee<T extends HTMLElement>(nomVariable: string) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const publier = () => {
      document.documentElement.style.setProperty(
        nomVariable,
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    };
    publier();

    const ro = new ResizeObserver(publier);
    ro.observe(el, { box: "border-box" });

    // Ceinture et bretelles : une rotation de téléphone change la hauteur
    // sans forcément passer par l'observateur selon le navigateur.
    window.addEventListener("resize", publier);
    window.addEventListener("orientationchange", publier);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", publier);
      window.removeEventListener("orientationchange", publier);
    };
  }, [nomVariable]);

  return ref;
}
