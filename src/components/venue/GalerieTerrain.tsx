"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Etiquette } from "@/components/ui/socle";

// ============================================
// Les autres vues d'un terrain.
//
// La fiche n'avait qu'une image — celle du bandeau. Une équipe qui choisit
// veut voir la pelouse de près, les vestiaires, l'éclairage de nuit : trois
// choses qu'une seule photo ne montre jamais.
//
// LES VIGNETTES PASSENT PAR next/image, et c'est désormais possible : le
// joker `hostname: "**"` a quitté next.config, donc l'optimiseur n'accepte
// plus que Firebase Storage — d'où l'on vient. Une vignette de 96px ne
// télécharge plus une image de 1600.
//
// La visionneuse, elle, sert l'image entière : c'est ce qu'on est venu voir.
// ============================================

export default function GalerieTerrain({
  photos,
  nomTerrain,
}: {
  photos: string[];
  nomTerrain: string;
}) {
  const [ouverte, setOuverte] = useState<number | null>(null);
  const fermerRef = useRef<HTMLButtonElement>(null);
  const declencheur = useRef<Element | null>(null);

  const fermer = useCallback(() => {
    setOuverte(null);
    if (declencheur.current instanceof HTMLElement) declencheur.current.focus();
  }, []);

  const bouger = useCallback(
    (pas: number) =>
      setOuverte((i) => (i === null ? null : (i + pas + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    if (ouverte === null) return;
    fermerRef.current?.focus();
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
      if (e.key === "ArrowRight") bouger(1);
      if (e.key === "ArrowLeft") bouger(-1);
    };
    document.addEventListener("keydown", auClavier);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", auClavier);
      document.body.style.overflow = avant;
    };
  }, [ouverte, fermer, bouger]);

  if (!photos.length) return null;

  return (
    <div className="mt-10">
      <Etiquette className="mb-3">
        Le terrain en images ({photos.length})
      </Etiquette>

      {/* Une bande qui défile plutôt qu'une grille : sur téléphone, six
          vignettes en grille repoussent tout ce qui suit d'un écran entier. */}
      <ul className="-mx-6 flex snap-x snap-mandatory gap-px overflow-x-auto px-6 pb-1 sm:mx-0 sm:px-0">
        {/* La clé porte l'index EN PLUS de l'adresse : rien n'interdit à un
            propriétaire de téléverser deux fois la même image, et deux clés
            identiques font disparaître une vignette sans un mot. */}
        {photos.map((url, i) => (
          <li key={`${url}-${i}`} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={(e) => {
                declencheur.current = e.currentTarget;
                setOuverte(i);
              }}
              aria-label={`Agrandir la photo ${i + 1} de ${nomTerrain}`}
              className="group relative block h-24 w-32 overflow-hidden bg-gray-900 sm:h-28 sm:w-40"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="160px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      {ouverte !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <button
            type="button"
            aria-label="Fermer"
            onClick={fermer}
            className="absolute inset-0 bg-gray-950/90"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Photo ${ouverte + 1} sur ${photos.length}, ${nomTerrain}`}
            className="relative flex h-full w-full max-w-5xl flex-col justify-center p-4 sm:p-8"
          >
            <div className="relative mx-auto aspect-[4/3] w-full">
              <Image
                src={photos[ouverte]}
                alt={`${nomTerrain}, photo ${ouverte + 1}`}
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-contain"
                priority
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                ref={fermerRef}
                type="button"
                onClick={fermer}
                className="flex items-center gap-2 border border-white/30 px-5 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-white"
              >
                <X size={14} /> Fermer
              </button>

              {photos.length > 1 && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => bouger(-1)}
                    aria-label="Photo précédente"
                    className="border border-white/30 p-3 text-white transition-colors hover:border-white"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-[11px] font-black tabular-nums uppercase tracking-[0.15em] text-white/70">
                    {ouverte + 1} / {photos.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => bouger(1)}
                    aria-label="Photo suivante"
                    className="border border-white/30 p-3 text-white transition-colors hover:border-white"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
