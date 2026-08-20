"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ExternalLink } from "lucide-react";
import type { Article } from "@/lib/news-rss";

// ============================================
// Les actus dans le rail du Direct.
//
// Le fil le plus recent, coupe court : cinq titres. Le rail accompagne le
// tableau des scores, il ne rivalise pas avec la page Actus, d'ou le lien
// vers elle en pied de bloc plutot qu'une liste qui descend sans fin.
//
// Titre, media, et le lien part chez l'editeur : rien n'est recopie.
// ============================================

const SHOWN = 5;

export default function NewsRail() {
  const [articles, setArticles] = useState<Article[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/actus")
      .then((r) => (r.ok ? r.json() : { articles: [] }))
      .then((d) => { if (alive) setArticles(d.articles ?? []); })
      .catch(() => { if (alive) setArticles([]); });
    return () => { alive = false; };
  }, []);

  // Rien a montrer : le rail se tait plutot que d'afficher un cadre vide.
  if (articles !== null && articles.length === 0) return null;

  return (
    <section aria-labelledby="rail-actus">
      <div className="flex items-baseline justify-between gap-3 border-b border-gray-200/70 pb-3">
        <h2
          id="rail-actus"
          className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400"
        >
          Les actus
        </h2>
        <Link
          href="/actus"
          className="shrink-0 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 transition-colors hover:text-emerald-700"
        >
          Tout voir
        </Link>
      </div>

      {articles === null ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <ul className="divide-y divide-gray-200/70">
          {articles.slice(0, SHOWN).map((a) => (
            <li key={a.id}>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2 py-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-snug text-gray-900 group-hover:text-emerald-700">
                    {a.title}
                  </span>
                  <span className="mt-1 block truncate text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                    {a.source}
                  </span>
                </span>
                <ExternalLink
                  size={12}
                  className="mt-1 shrink-0 text-gray-300 transition-colors group-hover:text-emerald-700"
                  aria-hidden
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
