"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ChevronLeft, ChevronRight, Radio, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { onCompetition, onCompMatches } from "@/lib/competition-firestore";
import { getStaffGrant } from "@/lib/staff-access";
import { describeStaffScope, grantCoversMatch, isGrantActive } from "@/lib/staff-scope";
import type { Competition, CompMatch, StaffGrant } from "@/types";

export default function LiveOpsCompetition() {
  const { cid } = useParams() as { cid: string };
  const { user } = useAuth();
  const router = useRouter();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [loading, setLoading] = useState(true);
  // Access-code holders reach this screen too, with a grant that may cover
  // one poule or one match, which is what filters the list below.
  const [grant, setGrant] = useState<StaffGrant | null>(null);
  const [grantChecked, setGrantChecked] = useState(false);

  useEffect(() => {
    if (!cid) return;
    const unsub = onCompetition(cid, (c) => { setCompetition(c); setLoading(false); });
    const unsubMatches = onCompMatches(cid, setMatches);
    return () => { unsub(); unsubMatches(); };
  }, [cid]);

  useEffect(() => {
    if (!cid || !user) return;
    let cancelled = false;
    getStaffGrant(cid, user.uid)
      .then((g) => {
        if (cancelled) return;
        setGrant(g && isGrantActive(g) ? g : null);
        setGrantChecked(true);
      })
      .catch(() => { if (!cancelled) setGrantChecked(true); });
    return () => { cancelled = true; };
  }, [cid, user]);

  // Membership guard: an organizer, a moderator, or a live access-code holder
  // of THIS competition (Firestore rules also enforce this on writes).
  useEffect(() => {
    if (!user || !competition || !grantChecked) return;
    const member =
      competition.organizerIds.includes(user.uid) ||
      competition.moderatorIds.includes(user.uid) ||
      grant != null;
    if (!member) router.replace("/live-ops");
  }, [user, competition, grant, grantChecked, router]);

  // A scoped holder is shown only the matches they may actually write to,
  // opening a console that refuses every save would be a trap.
  const visibleMatches =
    grant && competition && !competition.organizerIds.includes(user?.uid ?? "")
      && !competition.moderatorIds.includes(user?.uid ?? "")
      ? matches.filter((m) => grantCoversMatch(grant, m))
      : matches;

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

      {grant && (
        <div className="flex items-start gap-2.5 border border-emerald-200 bg-emerald-50 px-4 py-3">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          <p className="text-xs text-emerald-800">
            <span className="font-bold">Accès staff : {describeStaffScope(grant.scope)}.</span>{" "}
            Seuls les matchs concernés apparaissent ici.
          </p>
        </div>
      )}

      <div className="grid gap-2">
        {visibleMatches.length === 0 ? (
          <p className=" border border-dashed border-gray-200/70 bg-white py-12 text-center text-sm text-gray-500">
            Aucun match pour cette compétition.
          </p>
        ) : (
          visibleMatches.map((m) => {
            const live = m.status === "live";
            return (
              <Link
                key={m.id}
                href={`/live-ops/${cid}/matches/${m.id}/live`}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-3 border border-gray-200/70 bg-white p-4 transition-all hover:border-emerald-200"
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
