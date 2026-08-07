"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X, Loader2, UserCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { RosterClaim } from "@/types";

// ============================================
// Pending roster claims for one team — players who clicked "C'est moi" on
// the public roster. Validating writes `user_id` on the roster line and
// unlocks that player's personal statistics.
// Renders nothing when there is nothing to decide.
// ============================================

export default function RosterClaimsPanel({
  cid,
  teamId,
  onDecided,
}: {
  cid: string;
  teamId: string;
  onDecided?: () => void;
}) {
  const { firebaseUser } = useAuth();
  const [claims, setClaims] = useState<RosterClaim[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/competitions/roster-claims?cid=${cid}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { claims: RosterClaim[] };
      setClaims((data.claims ?? []).filter((c) => c.teamId === teamId));
    } catch {
      // Non-blocking — the roster below still renders.
    }
  }, [firebaseUser, cid, teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (claim: RosterClaim, action: "accept" | "reject") => {
    if (!firebaseUser) return;
    setBusy(claim.id);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/roster-claims", {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: claim.id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue");
        return;
      }
      toast.success(action === "accept" ? "Rattachement validé" : "Demande refusée");
      await load();
      onDecided?.();
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setBusy(null);
    }
  };

  if (claims.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
        <UserCheck size={15} />
        {claims.length} demande{claims.length !== 1 ? "s" : ""} de rattachement
      </p>
      <p className="mt-0.5 text-xs font-medium text-amber-700">
        Ces joueurs déclarent être sur cette feuille. Valider débloque leurs statistiques.
      </p>
      <div className="mt-3 space-y-2">
        {claims.map((claim) => (
          <div
            key={claim.id}
            className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900">{claim.userName}</p>
              <p className="truncate text-xs text-gray-500">
                déclare être « {claim.playerName} »
              </p>
            </div>
            <button
              type="button"
              onClick={() => decide(claim, "reject")}
              disabled={busy === claim.id}
              className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
            >
              <X size={15} />
            </button>
            <button
              type="button"
              onClick={() => decide(claim, "accept")}
              disabled={busy === claim.id}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
            >
              {busy === claim.id ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              Valider
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
