"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Search, X, Loader2, Trophy, User, Shield, MapPin, Flag } from "lucide-react";
import type { SearchHit, SearchPayload } from "@/app/api/search/route";

// ============================================
// SearchModal — one search surface for the whole app.
//
// Two things changed the shape of this file.
//
// Searching no longer asks for an account. It used to resolve competitions
// for everyone and hand guests a locked box where teams and players should
// be, because those collections are gated in firestore.rules. Every kind now
// comes from /api/search, read server-side, so the same search works signed
// out. Deciding whether the product is worth an account is exactly what a
// visitor uses search for.
//
// And an empty box now offers something. Instead of "type at least two
// letters" it shows what is popular — most-followed competitions, clubs with
// people in them, players with a following. A search field that answers
// before you type teaches what is in here.
// ============================================

type Filter = "all" | "competitions" | "teams" | "players" | "terrains" | "arbitres";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "competitions", label: "Compétitions" },
  { key: "teams", label: "Équipes" },
  { key: "players", label: "Joueurs" },
  { key: "terrains", label: "Terrains" },
  { key: "arbitres", label: "Arbitres" },
];

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

const EMPTY: SearchPayload = {
  competitions: [], teams: [], players: [], terrains: [], arbitres: [], suggestions: true,
};

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<SearchPayload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = term.trim();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape closes, wherever the focus sits.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced: one request per pause, not per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [trimmed]);

  // A query shorter than MIN_CHARS is treated as no query at all, which is
  // what brings the suggestions back when the box is cleared.
  useEffect(() => {
    const q = debounced.length >= MIN_CHARS ? debounced : "";
    let cancelled = false;
    setLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((d: SearchPayload) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setData(EMPTY); setLoading(false); } });

    return () => { cancelled = true; };
  }, [debounced]);

  const show = (kind: Filter) => filter === "all" || filter === kind;

  const total = useMemo(
    () =>
      (show("competitions") ? data.competitions.length : 0) +
      (show("teams") ? data.teams.length : 0) +
      (show("players") ? data.players.length : 0) +
      (show("terrains") ? data.terrains.length : 0) +
      (show("arbitres") ? data.arbitres.length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, filter],
  );

  const suggesting = data.suggestions && trimmed.length < MIN_CHARS;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Fermer la recherche"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <div className="relative mt-2 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden border border-gray-200/70 bg-white shadow-xl sm:mt-10">
        {/* ---- Query ---- */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          <Search size={18} className="shrink-0 text-gray-300" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Compétition, équipe, joueur, terrain, arbitre…"
            aria-label="Rechercher"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-gray-900 placeholder:text-gray-300 focus:outline-none"
          />
          {loading && <Loader2 size={16} className="shrink-0 animate-spin text-emerald-500" />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* ---- Filters ---- */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] transition-colors ${
                filter === f.key
                  ? "bg-gray-900 text-white"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ---- Results ---- */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {show("competitions") && (
            <Section title={suggesting ? "Compétitions populaires" : "Compétitions"} count={data.competitions.length}>
              {data.competitions.map((h) => (
                <Row key={h.id} hit={h} onNavigate={onClose} fallback={<Trophy size={15} className="text-amber-500" />} tone="bg-amber-50" rounded="rounded-lg" />
              ))}
            </Section>
          )}

          {show("teams") && (
            <Section title={suggesting ? "Équipes en vue" : "Équipes"} count={data.teams.length}>
              {data.teams.map((h) => (
                <Row key={h.id} hit={h} onNavigate={onClose} fallback={<Shield size={15} className="text-emerald-500" />} tone="bg-emerald-50" rounded="rounded-lg" />
              ))}
            </Section>
          )}

          {show("players") && (
            <Section title={suggesting ? "Joueurs suivis" : "Joueurs"} count={data.players.length}>
              {data.players.map((h) => (
                <Row key={h.id} hit={h} onNavigate={onClose} fallback={<User size={15} className="text-gray-400" />} tone="bg-gray-100" rounded="rounded-full" />
              ))}
            </Section>
          )}

          {show("terrains") && (
            <Section title="Terrains" count={data.terrains.length}>
              {data.terrains.map((h) => (
                <Row key={h.id} hit={h} onNavigate={onClose} fallback={<MapPin size={15} className="text-sky-500" />} tone="bg-sky-50" rounded="rounded-lg" />
              ))}
            </Section>
          )}

          {show("arbitres") && (
            <Section title="Arbitres" count={data.arbitres.length}>
              {data.arbitres.map((h) => (
                <Row key={h.id} hit={h} onNavigate={onClose} fallback={<Flag size={15} className="text-violet-500" />} tone="bg-violet-50" rounded="rounded-full" />
              ))}
            </Section>
          )}

          {!loading && total === 0 && (
            <p className="px-4 py-12 text-center text-sm font-bold text-gray-300">
              {trimmed.length >= MIN_CHARS
                ? <>Rien pour «&nbsp;{trimmed}&nbsp;».</>
                : "Rien à suggérer pour l'instant."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Pieces
// ============================================

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <p className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({
  hit,
  onNavigate,
  fallback,
  tone,
  rounded,
}: {
  hit: SearchHit;
  onNavigate: () => void;
  fallback: React.ReactNode;
  tone: string;
  rounded: string;
}) {
  return (
    <Link
      href={hit.href}
      onClick={onNavigate}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50"
    >
      {hit.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hit.image} alt="" className={`h-8 w-8 shrink-0 object-cover ${rounded}`} />
      ) : (
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${rounded} ${tone}`}>
          {fallback}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-gray-900">{hit.title}</span>
        <span className="block truncate text-xs font-bold text-gray-400">{hit.subtitle}</span>
      </span>

      {hit.badge && (
        <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-gray-500">
          {hit.badge}
        </span>
      )}
    </Link>
  );
}
