"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Globe2, Search, SearchX, Trophy } from "lucide-react";
import type { Competition } from "@/types";
import type { FootballCompetition } from "@/lib/football-data";
import CompetitionDirectoryCard from "./CompetitionDirectoryCard";
import WorldCompetitionCard from "../world/WorldCompetitionCard";

// Accent- and case-insensitive folding, shared by both filters.
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Three public buckets inside the local tab, rendered in this order. Each maps
// to one or more competition statuses (draft is never public, so it has no
// bucket).
const SECTIONS: { title: string; statuses: Competition["status"][] }[] = [
  { title: "En cours", statuses: ["group_stage", "knockout"] },
  { title: "À venir", statuses: ["registration"] },
  { title: "Terminées", statuses: ["completed"] },
];

type Tab = "local" | "world";

// Client directory island. Receives already-fetched competitions as props so the
// firebase-admin lib (competition-admin) stays out of the client bundle, and,
// for the world game, so does the server-only football-data lib (the
// FootballCompetition import here is a type, erased at compile time).
//
// The two families live in two tabs rather than stacked sections: they answer
// different questions ("what can I join?" vs "what's on tonight?"), and stacking
// them buried the world game under however many local competitions existed.
//
// There is no search field here, and no teams either: the header owns the one
// search bar, resolves teams in its own dropdown, and hands competition queries
// to this page through ?q=.
export default function CompetitionDirectorySearch({
  competitions,
  worldCompetitions = [],
}: {
  competitions: Competition[];
  worldCompetitions?: FootballCompetition[];
}) {
  // The header search bar navigates to /competitions?q=…, this page follows
  // that param (the header can push a new q while the page is already mounted).
  // Requires a <Suspense> boundary upstream.
  const query = useSearchParams().get("q") ?? "";

  // The chosen tab is remembered against the query it was chosen for. That way
  // an explicit click always wins, but changing the search starts fresh, no
  // effect syncing state to state.
  const [choice, setChoice] = useState<{ query: string; tab: Tab } | null>(null);

  // Case- and accent-insensitive match on name + venueCity ("miabe" must
  // find "Miabé").
  const filteredLocal = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return competitions;
    return competitions.filter((c) => fold(`${c.name} ${c.venueCity ?? ""}`).includes(q));
  }, [query, competitions]);

  // Same query drives the world game, searching "espagne" or "ligue 1" has to
  // reach it too, so it matches on name + country + code.
  const filteredWorld = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return worldCompetitions;
    return worldCompetitions.filter((c) =>
      fold(`${c.name} ${c.area ?? ""} ${c.code}`).includes(q),
    );
  }, [query, worldCompetitions]);

  // A search that only matches the other tab must not read as "no results", so
  // with no explicit choice the view follows the hits.
  const tab: Tab =
    choice?.query === query
      ? choice.tab
      : filteredLocal.length === 0 && filteredWorld.length > 0
        ? "world"
        : "local";

  // Group the filtered local list into the ordered sections, dropping empties.
  const sections = useMemo(
    () =>
      SECTIONS.map((section) => ({
        title: section.title,
        items: filteredLocal.filter((c) => section.statuses.includes(c.status)),
      })).filter((section) => section.items.length > 0),
    [filteredLocal],
  );

  const TABS: { key: Tab; label: string; count: number; Icon: typeof Trophy }[] = [
    { key: "local", label: "Compétitions locales", count: filteredLocal.length, Icon: Trophy },
    { key: "world", label: "Top compétitions", count: filteredWorld.length, Icon: Globe2 },
  ];

  const activeCount = tab === "local" ? filteredLocal.length : filteredWorld.length;

  return (
    <div className="space-y-6">
      {/* An active search comes from the header and is otherwise invisible on
          this page, say what is being filtered, and offer the way out. */}
      {query.trim() && (
        <div className="flex items-center gap-2 border border-emerald-100 bg-emerald-50/60 px-4 py-2.5">
          <Search size={14} className="shrink-0 text-emerald-500" />
          <p className="min-w-0 flex-1 truncate text-xs font-bold text-emerald-800">
            Résultats pour «&nbsp;{query.trim()}&nbsp;»
          </p>
          <Link
            href="/competitions"
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-600 transition-colors hover:bg-emerald-100"
          >
            Effacer
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-5 border-b border-gray-200/70">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setChoice({ query, tab: t.key })}
            className={`relative flex items-center gap-1.5 pb-2.5 text-sm font-bold transition-colors ${
              tab === t.key ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <t.Icon size={14} className={tab === t.key ? "text-emerald-500" : "text-gray-300"} />
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
                tab === t.key ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"
              }`}
            >
              {t.count}
            </span>
            {tab === t.key && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-500" />
            )}
          </button>
        ))}
      </div>

      {activeCount === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 border border-gray-200/70 bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center bg-gray-50 text-gray-300">
            <SearchX size={28} />
          </div>
          <p className="text-sm font-bold text-gray-400 italic">
            {query.trim()
              ? "Aucun résultat"
              : tab === "local"
                ? "Aucune compétition locale pour le moment."
                : "Aucune compétition disponible."}
          </p>
        </div>
      ) : tab === "local" ? (
        <div className="space-y-8">
          {sections.map((section) => (
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
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWorld.map((competition) => (
            <WorldCompetitionCard key={competition.code} competition={competition} />
          ))}
        </div>
      )}
    </div>
  );
}
