"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { onCompetition, onCompMatches } from "@/lib/competition-firestore";
import type { Competition, CompMatch } from "@/types";

export default function LiveOpsCompetition() {
  const { cid } = useParams() as { cid: string };
  const { user } = useAuth();
  const router = useRouter();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cid) return;
    const unsub = onCompetition(cid, (c) => { setCompetition(c); setLoading(false); });
    const unsubMatches = onCompMatches(cid, setMatches);
    return () => { unsub(); unsubMatches(); };
  }, [cid]);

  // Membership guard: only an organizer or moderator of THIS competition may
  // operate its matches (Firestore rules also enforce this on writes).
  useEffect(() => {
    if (!user || !competition) return;
    const member =
      competition.organizerIds.includes(user.uid) || competition.moderatorIds.includes(user.uid);
    if (!member) router.replace("/live-ops");
  }, [user, competition, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!competition) {
    return <div className="py-20 text-center text-sm font-bold text-gray-500 italic">Compétition introuvable</div>;
  }

  return (
    <div className="space-y-5">
      <Link href="/live-ops" className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900">
        <ChevronLeft size={16} /> Mes compétitions
      </Link>
      <h1 className="font-display text-2xl font-extrabold text-gray-900">{competition.name}</h1>

      <div className="grid gap-2">
        {matches.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
            Aucun match pour cette compétition.
          </p>
        ) : (
          matches.map((m) => {
            const live = m.status === "live";
            return (
              <Link
                key={m.id}
                href={`/live-ops/${cid}/matches/${m.id}/live`}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">
                    {m.homeTeamName} <span className="text-gray-300">vs</span> {m.awayTeamName}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {m.date ?? "Date à définir"}{m.time ? ` · ${m.time}` : ""}
                  </p>
                </div>
                {live ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">
                    <Radio size={12} /> EN DIRECT
                  </span>
                ) : m.status === "completed" ? (
                  <span className="text-sm font-bold text-gray-900">{m.scoreHome ?? 0}–{m.scoreAway ?? 0}</span>
                ) : (
                  <ChevronRight size={18} className="text-gray-300" />
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
