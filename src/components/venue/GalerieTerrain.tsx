"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { Pelouse } from "@/components/venue/venue-ui";

// ============================================
// Les photos d'un terrain, en tête de sa fiche.
//
// LA PHOTO OUVRE LA FICHE, EN GRAND ET SANS VOILE. Elle portait un dégradé
// noir sur lequel on écrivait le nom et le tarif : la pelouse disparaissait
// sous le texte, alors que c'est elle qu'on vient voir. Le texte est passé
// dessous, sur fond clair.
//
// UNE MOSAÏQUE SUR ORDINATEUR : la photo principale et deux autres à côté,
// parce qu'une équipe qui choisit veut voir la pelouse, les vestiaires,
// l'éclairage de nuit — ce qu'une seule photo ne montre jamais. Sur
// téléphone, une seule photo et le nombre des autres : trois photos
// empilées repousseraient la demande de créneau d'un écran.
//
// Sans photo, la pelouse dessinée, comme dans l'annuaire.
//
// La visionneuse sert l'image entière : c'est ce qu'on est venu voir.
// ============================================

export default function GalerieTerrain({
  photos,
  nomTerrain,
  ferme = false,
}: {
  photos: string[];
  nomTerrain: string;
  /** Terrain fermé : les photos passent en gris, comme dans l'annuaire. */
  ferme?: boolean;
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

  const ouvrir = (i: number) => (e: React.MouseEvent<HTMLButtonElement>) => {
    declencheur.current = e.currentTarget;
    setOuverte(i);
  };

  if (!photos.length) {
    return (
      <div className="relative aspect-[2/1] overflow-hidden bg-emerald-700 sm:aspect-[4/1]">
        <Pelouse className={ferme ? "grayscale" : ""} />
      </div>
    );
  }

  const gris = ferme ? "grayscale" : "";
  const autres = photos.slice(1, 3);

  return (
    <>
      <div
        className={`grid gap-1.5 ${
          autres.length > 0
            ? "sm:h-[26rem] sm:grid-cols-3 sm:grid-rows-2 lg:h-[30rem]"
            : ""
        }`}
      >
        <button
          type="button"
          onClick={ouvrir(0)}
          aria-label={`Agrandir la photo 1 de ${nomTerrain}`}
          className={`group relative block aspect-[4/3] overflow-hidden bg-gray-900 ${
            autres.length > 0 ? "sm:col-span-2 sm:row-span-2 sm:aspect-auto" : "sm:aspect-[2/1]"
          }`}
        >
          <Image
            src={photos[0]}
            alt={`${nomTerrain}, photo principale`}
            fill
            fetchPriority="high"
            sizes="(max-width: 640px) 100vw, 66vw"
            className={`object-cover transition-transform duration-500 group-hover:scale-[1.02] ${gris}`}
          />
        </button>

        {autres.map((url, k) => (
          <button
            key={`${url}-${k}`}
            type="button"
            onClick={ouvrir(k + 1)}
            aria-label={`Agrandir la photo ${k + 2} de ${nomTerrain}`}
            className={`group relative hidden overflow-hidden bg-gray-900 sm:block ${
              autres.length === 1 ? "sm:row-span-2" : ""
            }`}
          >
            <Image
              src={url}
              alt=""
              fill
              sizes="33vw"
              className={`object-cover transition-transform duration-500 group-hover:scale-[1.03] ${gris}`}
            />
          </button>
        ))}
      </div>

      {/* Toutes les photos : sur téléphone, c'est le seul chemin vers les
          autres ; sur ordinateur, celui vers celles que la mosaïque tait. */}
      {photos.length > 1 && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={ouvrir(0)}
            className="inline-flex h-9 items-center gap-2 border border-gray-200/70 bg-white px-3 text-xs font-bold text-gray-700 transition-colors hover:border-gray-900 hover:text-gray-900"
          >
            <Images size={14} />
            Voir les {photos.length} photos
          </button>
        </div>
      )}

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
                loading="eager"
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
    </>
  );
}
