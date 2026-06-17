"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import type { Competition } from "@/types";
import CompetitionDirectoryCard from "./CompetitionDirectoryCard";

// Three public buckets, rendered in this order. Each maps to one or more
// competition statuses (draft is never public, so it has no bucket).
const SECTIONS: { title: string; statuses: Competition["status"][] }[] = [
  { title: "En cours", statuses: ["group_stage", "knockout"] },
  { title: "À venir", statuses: ["registration"] },
  { title: "Terminées", statuses: ["completed"] },
];

// Client search island. Receives already-fetched competitions as props so the
// firebase-admin lib (competition-admin) stays out of the client bundle.
export default function CompetitionDirectorySearch({
  competitions,
}: {
  competitions: Competition[];
}) {
  const [query, setQuery] = useState("");

  // Case-insensitive, trimmed match on name + venueCity.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return competitions;
    return competitions.filter((c) => {
      const haystack = `${c.name} ${c.venueCity ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, competitions]);

  // Group the filtered list into the ordered sections, dropping empties.
  const sections = useMemo(
    () =>
      SECTIONS.map((section) => ({
        title: section.title,
        items: filtered.filter((c) => section.statuses.includes(c.status)),
      })).filter((section) => section.items.length > 0),
    [filtered],
  );

  return (
    <div className="space-y-8">
      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une compétition ou une ville…"
          aria-label="Rechercher une compétition"
          className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-11 pr-4 text-sm font-bold text-gray-900 shadow-sm outline-none transition-colors placeholder:font-medium placeholder:text-gray-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[2rem] border border-gray-100 bg-white py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gray-50 text-gray-300">
            <SearchX size={28} />
          </div>
          <p className="text-sm font-bold text-gray-400 italic">Aucun résultat</p>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <h2 className="font-display text-sm font-black uppercase tracking-tight text-gray-900">
                {section.title}
              </h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black tabular-nums text-gray-500">
                {section.items.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((competition) => (
                <CompetitionDirectoryCard key={competition.id} competition={competition} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
