"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { Article } from "@/lib/news-rss";

// ============================================
// Le hero du jour, un article à la fois, en grand.
//
// Il fonctionne sans photo, et c'est voulu : aucune source d'articles
// atteignable ne fournit d'image (voir le champ `image` dans news-rss). Le
// hero est donc typographique, le titre EST l'illustration, et se remplira
// d'images le jour où une source en donne, sans changer de forme.
//
// Défilement manuel, pas automatique : une page d'actualité qui bouge toute
// seule fait rater la ligne qu'on était en train de lire.
// ============================================

export default function ArticleHero({ articles }: { articles: Article[] }) {
  const [i, setI] = useState(0);
  const count = articles.length;

  const go = useCallback(
    (dir: 1 | -1) => setI((x) => (x + dir + count) % count),
    [count],
  );

  // Flèches du clavier : le hero est une galerie, elle se parcourt comme telle.
  useEffect(() => {
    if (count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, go]);

  if (count === 0) return null;
  const a = articles[i];

  return (
    <section aria-label="À la une aujourd'hui" className="space-y-3">
      <div className="relative aspect-[16/9] overflow-hidden bg-gray-900 sm:aspect-[21/9]">
        {a.image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={a.id} src={a.image} alt="" className="h-full w-full object-cover opacity-80" />
            {/* Le voile porte le texte : sans lui, un titre blanc sur une
                photo claire devient illisible une fois sur trois. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
          </>
        ) : (
          /* Sans photo : le numero du volet tient lieu d'image, assez grand
             pour que le cadre ne soit pas un aplat vide. */
          <span
            aria-hidden
            className="absolute -right-4 -top-10 select-none font-display text-[13rem] font-black leading-none text-white/5 sm:text-[18rem]"
          >
            {String(i + 1).padStart(2, "0")}
          </span>
        )}

        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
            {a.source}
          </p>
          <h2 className="mt-3 max-w-3xl font-display text-2xl font-black leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl">
            {a.title}
          </h2>
          <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-white/70">
            Lire chez {a.source} <ExternalLink size={13} />
          </span>
        </a>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Article précédent"
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 p-2.5 text-white transition-colors hover:bg-black/70"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Article suivant"
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 p-2.5 text-white transition-colors hover:bg-black/70"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex items-center gap-2">
          {articles.map((x, k) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setI(k)}
              aria-label={`Article ${k + 1} sur ${count}`}
              aria-current={k === i ? "true" : undefined}
              className={`h-1 flex-1 transition-colors ${k === i ? "bg-gray-900" : "bg-gray-200 hover:bg-gray-400"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
