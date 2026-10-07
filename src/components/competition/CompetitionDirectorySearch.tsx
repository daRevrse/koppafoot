"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Globe2, Search, SearchX, Trophy } from "lucide-react";
import type { Competition } from "@/types";
import type { FootballCompetition } from "@/lib/football-data";
import CompetitionDirectoryCard from "./CompetitionDirectoryCard";
import WorldCompetitionCard from "../world/WorldCompetitionCard";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { LIBELLES_CATEGORIE } from "@/lib/genre";

// Accent- and case-insensitive folding, shared by both filters.
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Three public buckets inside the local tab, rendered in this order. Each maps
// to one or more competition statuses (draft is never public, so it has no
// bucket). « À venir » holds both open and closed registration: the card's
// badge tells which ones still take teams.
type Section = "enCours" | "aVenir" | "terminees";

const SECTIONS: { cle: Section; statuses: Competition["status"][] }[] = [
  { cle: "enCours", statuses: ["group_stage", "knockout"] },
  { cle: "aVenir", statuses: ["registration", "registration_closed"] },
  { cle: "terminees", statuses: ["completed"] },
];

type Tab = "local" | "world";

const T = textes(
  {
    section: (s: Section) => ({ enCours: "En cours", aVenir: "À venir", terminees: "Terminées" })[s],
    locales: "Compétitions locales",
    top: "Top compétitions",
    resultatsPour: (q: string) => `Résultats pour «\u00a0${q}\u00a0»`,
    effacer: "Effacer",
    competitions: (n: number) => `${n} compétition${n > 1 ? "s" : ""}`,
    aucunResultat: "Aucun résultat",
    aucuneLocale: "Aucune compétition locale pour le moment.",
    aucuneDisponible: "Aucune compétition disponible.",
  },
  {
    section: (s: Section) => ({ enCours: "Under way", aVenir: "Upcoming", terminees: "Finished" })[s],
    locales: "Local competitions",
    top: "Top competitions",
    resultatsPour: (q: string) => `Results for “${q}”`,
    effacer: "Clear",
    competitions: (n: number) => `${n} competition${n === 1 ? "" : "s"}`,
    aucunResultat: "No results",
    aucuneLocale: "No local competitions yet.",
    aucuneDisponible: "No competitions available.",
  },
);

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
  const tx = useTextes(T);

  // The chosen tab is remembered against the query it was chosen for. That way
  // an explicit click always wins, but changing the search starts fresh, no
  // effect syncing state to state.
  const [choice, setChoice] = useState<{ query: string; tab: Tab } | null>(null);

  // Case- and accent-insensitive match on name + venueCity ("miabe" must
  // find "Miabé").
  const filteredLocal = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return competitions;
    // La catégorie se cherche aussi : « féminin » ou « women » trouve les
    // compétitions féminines, qui ne le disent pas toujours dans leur nom.
    return competitions.filter((c) =>
      fold(`${c.name} ${c.venueCity ?? ""} ${c.category ? `${LIBELLES_CATEGORIE.fr[c.category]} ${LIBELLES_CATEGORIE.en[c.category]}` : ""}`).includes(q),
    );
  }, [query, competitions]);

  // Same query drives the world game, searching "espagne" or "ligue 1" has to
  // reach it too, so it matches on name + country + code.
  const filteredWorld = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return worldCompetitions;
    return worldCompetitions.filter((c) =>
      fold(`${c.name} ${c.area ?? ""} ${c.areaEn ?? ""} ${c.code}`).includes(q),
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
        title: tx.section(section.cle),
        items: filteredLocal.filter((c) => section.statuses.includes(c.status)),
      })).filter((section) => section.items.length > 0),
    [filteredLocal, tx],
  );

  const TABS: { key: Tab; label: string; count: number; Icon: typeof Trophy }[] = [
    { key: "local", label: tx.locales, count: filteredLocal.length, Icon: Trophy },
    { key: "world", label: tx.top, count: filteredWorld.length, Icon: Globe2 },
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
            {tx.resultatsPour(query.trim())}
          </p>
          <Link
            href="/competitions"
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-600 transition-colors hover:bg-emerald-100"
          >
            {tx.effacer}
          </Link>
        </div>
      )}

      {/* Tabs. Sur une ligne quoi qu'il arrive : sur téléphone, les icônes
          s'effacent pour que les deux libellés tiennent sans se couper. */}
      <div className="flex gap-5 overflow-x-auto border-b border-gray-200/70 [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setChoice({ query, tab: t.key })}
            className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap pb-2.5 text-sm font-bold transition-colors ${
              tab === t.key ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <t.Icon size={14} className={`hidden sm:block ${tab === t.key ? "text-emerald-500" : "text-gray-300"}`} />
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
        <div className="flex flex-col items-center justify-center gap-3 border border-gray-200/70 bg-white px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center bg-gray-50 text-gray-300">
            <SearchX size={28} />
          </div>
          <p className="text-sm font-bold text-gray-400 italic">
            {query.trim()
              ? tx.aucunResultat
              : tab === "local"
                ? tx.aucuneLocale
                : tx.aucuneDisponible}
          </p>
        </div>
      ) : tab === "local" ? (
        <div className="space-y-10">
          {/* Les en-têtes de section sont ceux des Actus : un titre, le
              compte à droite, un filet dessous. */}
          {sections.map((section) => (
            <section key={section.title} className="space-y-4">
              <div className="flex items-baseline justify-between gap-4 border-b border-gray-200/70 pb-3">
                <h2 className="font-display text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
                  {section.title}
                </h2>
                <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                  {tx.competitions(section.items.length)}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {section.items.map((competition) => (
                  <CompetitionDirectoryCard key={competition.id} competition={competition} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {filteredWorld.map((competition) => (
            <WorldCompetitionCard key={competition.code} competition={competition} />
          ))}
        </div>
      )}
    </div>
  );
}
