"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Loader2, MapPin, Search, Trophy, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { findTeams } from "@/lib/firestore";
import { listPublicCompetitions } from "@/lib/competition-firestore";
import type { Competition, Team } from "@/types";

// ============================================
// MobileSearchOverlay
//
// The phone counterpart of HeaderSearch. The desktop bar is `lg:` only, so
// without this there is no way to search anything on a phone at all.
//
// A dropdown makes no sense under a 40px-wide icon, so this takes the whole
// screen — which buys enough room to resolve competitions here too, rather than
// bouncing to the directory the way the narrow desktop dropdown has to. Only
// Koppafoot competitions are matched live: the world game is server-only
// (football-data), so the last row hands the query to /competitions, where both
// families live.
// ============================================

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;
const MAX_TEAMS = 8;
const MAX_COMPS = 8;

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function MobileSearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [teamHits, setTeamHits] = useState<{ term: string; items: Team[] } | null>(null);
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = term.trim();
  const searching = trimmed.length >= MIN_CHARS;

  // Focus the field as the screen appears — the icon was the intent to type.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Freeze the page underneath so the overlay does not scroll it away.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Competitions are a short, public list — fetched once when the screen opens,
  // then filtered in memory rather than re-queried per keystroke.
  useEffect(() => {
    let cancelled = false;
    listPublicCompetitions()
      .then((list) => {
        if (!cancelled) setCompetitions(list);
      })
      .catch(() => {
        if (!cancelled) setCompetitions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  // Teams need a round-trip, so they follow the debounced term.
  useEffect(() => {
    if (!uid || debounced.length < MIN_CHARS) return;
    let cancelled = false;
    findTeams(debounced, MAX_TEAMS)
      .then((items) => {
        if (!cancelled) setTeamHits({ term: debounced, items });
      })
      .catch(() => {
        if (!cancelled) setTeamHits({ term: debounced, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [uid, debounced]);

  const teamsResolved = teamHits?.term === trimmed;
  const teams = useMemo(
    () => (teamsResolved ? (teamHits?.items ?? []) : []),
    [teamsResolved, teamHits],
  );
  const teamsLoading = Boolean(uid) && searching && !teamsResolved;

  const matchedComps = useMemo(() => {
    if (!searching || !competitions) return [];
    const q = fold(trimmed);
    return competitions
      .filter((c) => fold(`${c.name} ${c.venueCity ?? ""}`).includes(q))
      .slice(0, MAX_COMPS);
  }, [searching, competitions, trimmed]);

  const goToDirectory = () => {
    onClose();
    router.push(trimmed ? `/competitions?q=${encodeURIComponent(trimmed)}` : "/competitions");
  };

  const nothing = searching && !teamsLoading && teams.length === 0 && matchedComps.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recherche"
      className="fixed inset-0 z-[60] flex flex-col bg-white lg:hidden"
    >
      {/* Search bar */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 pt-safe">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la recherche"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                goToDirectory();
              }
            }}
            placeholder="Équipe, compétition, ville…"
            aria-label="Rechercher"
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-9 text-sm font-semibold text-gray-800 placeholder:font-medium placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200"
          />
          {term && (
            <button
              type="button"
              onClick={() => {
                setTerm("");
                inputRef.current?.focus();
              }}
              aria-label="Effacer"
              className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-safe">
        {!searching ? (
          <div className="flex flex-col items-center justify-center gap-3 px-8 pt-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gray-50 text-gray-300">
              <Search size={26} />
            </div>
            <p className="text-sm font-bold text-gray-400 italic">
              Cherche une équipe, une compétition ou une ville.
            </p>
          </div>
        ) : nothing ? (
          // Not "aucun résultat": the world competitions are not searched here,
          // so a query like "ligue" does have a match — one row below. Saying
          // otherwise would send the reader away convinced there was nothing.
          <div className="flex flex-col items-center justify-center gap-3 px-8 pt-24 text-center">
            <p className="text-sm font-bold text-gray-400 italic">
              Aucune équipe ni compétition Koppafoot pour «&nbsp;{trimmed}&nbsp;».
            </p>
            <p className="text-xs font-bold text-gray-300">
              Le foot mondial se cherche dans les compétitions, ci-dessous.
            </p>
          </div>
        ) : (
          <>
            {uid && (teamsLoading || teams.length > 0) && (
              <section>
                <SectionTitle>Équipes</SectionTitle>
                {teamsLoading ? (
                  <p className="flex items-center gap-2 px-4 pb-3 text-xs font-bold text-gray-300 italic">
                    <Loader2 size={13} className="animate-spin text-emerald-500" />
                    Recherche…
                  </p>
                ) : (
                  <ul>
                    {teams.map((team) => (
                      <li key={team.id}>
                        <Link
                          href={`/teams/${team.id}`}
                          onClick={onClose}
                          className="flex items-center gap-3 px-4 py-2.5 transition-colors active:bg-gray-50"
                        >
                          {team.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={team.logoUrl}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-xl object-cover"
                            />
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-black text-emerald-600">
                              {team.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-gray-900">
                              {team.name}
                            </span>
                            {team.city && (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-gray-400">
                                <MapPin size={10} className="shrink-0" />
                                <span className="truncate">{team.city}</span>
                              </span>
                            )}
                          </span>
                          {team.isRecruiting && (
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-600">
                              Recrute
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {matchedComps.length > 0 && (
              <section>
                <SectionTitle>Compétitions</SectionTitle>
                <ul>
                  {matchedComps.map((competition) => (
                    <li key={competition.id}>
                      <Link
                        href={`/c/${competition.slug}`}
                        onClick={onClose}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors active:bg-gray-50"
                      >
                        {competition.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={competition.logoUrl}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                            <Trophy size={16} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-gray-900">
                            {competition.name}
                          </span>
                          {competition.venueCity && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-gray-400">
                              <MapPin size={10} className="shrink-0" />
                              <span className="truncate">{competition.venueCity}</span>
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Always offered while searching: the directory carries the world
            competitions, which are server-side only and cannot be matched here. */}
        {searching && (
          <button
            type="button"
            onClick={goToDirectory}
            className="flex w-full items-center justify-between gap-2 border-t border-gray-100 px-4 py-3.5 text-left transition-colors active:bg-gray-50"
          >
            <span className="min-w-0 truncate text-xs font-bold text-gray-600">
              Voir «&nbsp;{trimmed}&nbsp;» dans toutes les compétitions
            </span>
            <ChevronRight size={14} className="shrink-0 text-emerald-500" />
          </button>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-wider text-gray-300">
      {children}
    </p>
  );
}
