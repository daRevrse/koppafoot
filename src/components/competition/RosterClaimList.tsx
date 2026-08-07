"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Loader2, UserCheck, Clock3 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { CompPlayer, RosterClaim } from "@/types";

// ============================================
// Public roster, with a superadmin repair action.
//
// Players do NOT claim their line any more: the link is created for them
// when their manager registers the club in a competition, or imports it into
// an existing team. Everyone therefore sees a plain roster — the "Toi" badge
// marks their own line — and only a superadmin gets the attach control, to
// repair rosters an organizer typed by hand.
// ============================================

export default function RosterClaimList({
  cid,
  teamId,
  roster,
}: {
  cid: string;
  teamId: string;
  roster: CompPlayer[];
}) {
  const { user, firebaseUser } = useAuth();
  const [myClaims, setMyClaims] = useState<RosterClaim[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Only the repair path reads claims, so ordinary visitors — the vast
  // majority on a public roster — no longer pay for that request.
  const loadClaims = useCallback(async () => {
    if (!firebaseUser || user?.userType !== "superadmin") return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/roster-claims?mine=1", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { claims: RosterClaim[] };
      setMyClaims(data.claims ?? []);
    } catch {
      // Non-blocking: the roster still renders, just without claim state.
    }
  }, [firebaseUser, user?.userType]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const claim = async (playerId: string) => {
    if (!firebaseUser) return;
    setSubmitting(playerId);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/roster-claims", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ cid, teamId, playerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue");
        return;
      }
      toast.success("Demande envoyée — en attente de validation");
      await loadClaims();
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setSubmitting(null);
    }
  };

  // A player links to one line per team, so once they hold a validated or
  // pending line here, the other rows stop offering the action.
  const linkedHere = roster.some((p) => p.user_id && p.user_id === user?.uid);
  const pendingHere = myClaims.some((c) => c.teamId === teamId && c.status === "pending");

  // Claiming is now an ADMIN repair tool, not a player flow. Links are
  // created automatically when a manager registers their club or imports it
  // into a competition team, so asking players to claim their own line would
  // duplicate a job the system already does — and re-introduce a validation
  // queue for organizers. Superadmins keep it to fix rosters typed by hand.
  const canRepair = user?.userType === "superadmin";

  return (
    <div className="divide-y divide-gray-50 overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-sm">
      {roster.map((player) => {
        const isMe = !!player.user_id && player.user_id === user?.uid;
        const myPending = myClaims.some(
          (c) => c.playerId === player.id && c.teamId === teamId && c.status === "pending",
        );
        const canClaim =
          canRepair && !player.user_id && !linkedHere && !pendingHere;

        return (
          <div key={player.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-xs font-black tabular-nums text-gray-500">
              {player.number || "—"}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">
              {player.name}
              {isMe && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 align-middle text-[10px] font-black uppercase tracking-wide text-emerald-600">
                  <BadgeCheck size={10} /> Toi
                </span>
              )}
            </span>
            {player.position && (
              <span className="hidden shrink-0 rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-400 sm:inline">
                {player.position}
              </span>
            )}
            {myPending ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-600">
                <Clock3 size={10} /> En attente
              </span>
            ) : canClaim ? (
              <button
                type="button"
                onClick={() => claim(player.id)}
                disabled={submitting !== null}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1 text-[11px] font-black text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
              >
                {submitting === player.id ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <UserCheck size={11} />
                )}
                Rattacher
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
