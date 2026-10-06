"use client";

import { useEffect, useRef } from "react";

// ============================================
// Des étapes qui apparaissent au défilement, une seule fois.
//
// Les enfants DIRECTS montent l'un après l'autre (globals.css, bloc
// « Mouvement ») quand le groupe entre à l'écran. Réservé aux vitrines : une
// page qu'on lit une fois, pas un écran de travail.
//
// VISIBLE PAR DÉFAUT. Le rendu serveur n'a pas d'attribut : tout s'affiche.
// Le script ne cache le groupe que s'il est encore sous l'écran au montage ;
// déjà visible, ou « réduire les animations » demandé, il ne touche à rien.
// Un script en retard ou absent ne laisse donc jamais un trou dans la page.
// ============================================

export default function Reveler({
  children,
  className,
  as: Balise = "div",
  contenu = false,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "ol" | "ul";
  /** Grille à filets : animer le contenu de chaque case, pas la case. */
  contenu?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return;

    // L'attribut, et non un état React : seul le CSS le lit, et le poser
    // directement évite un rendu de plus pour un effet purement visuel.
    el.dataset.revele = "attente";
    const io = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          el.dataset.revele = "vu";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -100px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Balise
      ref={ref as React.Ref<never>}
      className={className}
      data-revele-contenu={contenu ? "" : undefined}
    >
      {children}
    </Balise>
  );
}
