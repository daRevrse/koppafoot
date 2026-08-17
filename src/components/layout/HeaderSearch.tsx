"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, MapPin, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { findTeams } from "@/lib/firestore";
import type { Team } from "@/types";

// ============================================
// HeaderSearch
//
// One bar, two destinations. Teams resolve here, in a dropdown that goes
// straight to the club — a team is a single thing you are looking for, not a
// list you browse, so sending it through a directory page was a detour.
// Competitions still go to /competitions?q=, which is a directory worth
// landing on.
//
// Teams are read with the visitor's own credentials (firestore.rules gates the
// collection behind isAuthenticated()), so the dropdown simply never appears
// for guests.
// ============================================

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;
const MAX_HITS = 6;

export default function HeaderSearch() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [hits, setHits] = useState<{ term: string; items: Team[] } | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const trimmed = term.trim();
  const searchable = Boolean(uid) && trimmed.length >= MIN_CHARS;

  // Debounce: the lookup reads the teams collection, so it must not fire on
  // every keystroke. setState happens in the timeout, never in the effect body.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!uid || debounced.length < MIN_CHARS) return;
    let cancelled = false;
    findTeams(debounced, MAX_HITS)
      .then((items) => {
        if (!cancelled) setHits({ term: debounced, items });
      })
      .catch(() => {
        if (!cancelled) setHits({ term: debounced, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [uid, debounced]);

  // Close on any click outside the bar.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Results belong to the term they were fetched for — anything else is stale,
  // which is also how "loading" is derived rather than tracked separately.
  const resolved = hits?.term === trimmed;
  const teams = useMemo(() => (resolved ? (hits?.items ?? []) : []), [resolved, hits]);
  const loading = searchable && !resolved;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    router.push(trimmed ? `/competitions?q=${encodeURIComponent(trimmed)}` : "/competitions");
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <form onSubmit={submit} className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Compétition, équipe, ville…"
          aria-label="Rechercher"
          className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-8 text-xs font-semibold text-gray-700 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-colors"
        />
        {loading && (
          <Loader2
            size={13}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-emerald-500"
          />
        )}
      </form>

      {open && trimmed.length >= MIN_CHARS && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
          {uid && (
            <div className="border-b border-gray-50">
              <p className="px-3 pb-1 pt-2.5 text-[9px] font-black uppercase tracking-wider text-gray-300">
                Équipes
              </p>
              {loading ? (
                <p className="px-3 pb-2.5 text-xs font-bold text-gray-300 italic">Recherche…</p>
              ) : teams.length === 0 ? (
                <p className="px-3 pb-2.5 text-xs font-bold text-gray-300 italic">
                  Aucune équipe de ce nom.
                </p>
              ) : (
                <ul className="pb-1">
                  {teams.map((team) => (
                    <li key={team.id}>
                      <Link
                        href={`/teams/${team.id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-gray-50"
                      >
                        {team.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={team.logoUrl}
                            alt=""
                            className="h-7 w-7 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[10px] font-black text-emerald-600">
                            {team.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-gray-900">
                            {team.name}
                          </span>
                          {team.city && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                              <MapPin size={9} className="shrink-0" />
                              <span className="truncate">{team.city}</span>
                            </span>
                          )}
                        </span>
                        {team.isRecruiting && (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-600">
                            Recrute
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Competitions keep their directory: the whole point of that page is
              to be browsed, so the bar hands the query over rather than
              duplicating the list in a dropdown. */}
          <button
            type="button"
            onClick={submit}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
          >
            <span className="min-w-0 truncate text-xs font-bold text-gray-600">
              Chercher «&nbsp;{trimmed}&nbsp;» dans les compétitions
            </span>
            <ChevronRight size={13} className="shrink-0 text-emerald-500" />
          </button>
        </div>
      )}
    </div>
  );
}
