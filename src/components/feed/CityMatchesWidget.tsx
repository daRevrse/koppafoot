"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin, Calendar, ChevronRight } from "lucide-react";
import { getMatchesByCity } from "@/lib/firestore";
import type { Match } from "@/types";

interface CityMatchesWidgetProps {
  city: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function MatchCard({ match, group }: { match: Match; group: "ongoing" | "upcoming" | "past" }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-1 text-xs font-semibold text-gray-800">
        <span className="truncate max-w-[70px]">{match.homeTeamName}</span>
        {group === "past" && match.scoreHome !== null ? (
          <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-xs font-bold text-gray-900 shadow-sm">
            {match.scoreHome} - {match.scoreAway}
          </span>
        ) : (
          <span className="shrink-0 text-gray-400 text-[10px]">vs</span>
        )}
        <span className="truncate max-w-[70px] text-right">{match.awayTeamName}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400">
        <Calendar size={10} />
        <span>{formatDate(match.date)}{match.time ? ` · ${match.time}` : ""}</span>
        {match.venueName && (
          <>
            <span>·</span>
            <span className="truncate">{match.venueName}</span>
          </>
        )}
      </div>
    </div>
  );
}

function GroupHeader({ label, color }: { label: string; color: string }) {
  return (
    <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${color}`}>
      {label}
    </div>
  );
}

function MatchSkeleton() {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-2">
      <div className="flex gap-2">
        <div className="h-3 flex-1 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-6 animate-pulse rounded bg-gray-200" />
        <div className="h-3 flex-1 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="h-2 w-24 animate-pulse rounded bg-gray-200" />
    </div>
  );
}

export function CityMatchesWidget({ city }: CityMatchesWidgetProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!city) { setLoading(false); return; }
    getMatchesByCity(city, 15)
      .then(setMatches)
      .finally(() => setLoading(false));
  }, [city]);

  if (!city) return null;

  const today = new Date().toISOString().split("T")[0];
  const ongoing = matches.filter((m) => m.status === "upcoming" && m.date === today);
  const upcoming = matches.filter((m) => m.status === "upcoming" && m.date > today);
  const past = matches.filter((m) => m.status === "completed").slice(0, 3);

  const hasAny = ongoing.length + upcoming.length + past.length > 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5 mb-3">
        <MapPin size={14} className="text-primary-600" />
        <h3 className="text-sm font-bold text-gray-900">Matchs — {city}</h3>
      </div>

      {loading ? (
        <div className="space-y-2">
          <MatchSkeleton />
          <MatchSkeleton />
          <MatchSkeleton />
        </div>
      ) : !hasAny ? (
        <p className="text-xs text-gray-400 text-center py-4">
          Aucun match à {city} pour le moment.
        </p>
      ) : (
        <div className="space-y-3">
          {ongoing.length > 0 && (
            <div className="space-y-1.5">
              <GroupHeader label="⚽ En cours" color="bg-green-100 text-green-700" />
              {ongoing.map((m) => <MatchCard key={m.id} match={m} group="ongoing" />)}
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="space-y-1.5">
              <GroupHeader label="📅 À venir" color="bg-blue-100 text-blue-700" />
              {upcoming.slice(0, 4).map((m) => <MatchCard key={m.id} match={m} group="upcoming" />)}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-1.5">
              <GroupHeader label="🏁 Passés" color="bg-gray-100 text-gray-600" />
              {past.map((m) => <MatchCard key={m.id} match={m} group="past" />)}
            </div>
          )}
        </div>
      )}

      <Link
        href="/matches"
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        Voir tous les matchs <ChevronRight size={12} />
      </Link>
    </div>
  );
}
