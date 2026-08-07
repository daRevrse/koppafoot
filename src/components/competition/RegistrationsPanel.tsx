"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X, Loader2, ClipboardList, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { CompetitionRegistration } from "@/types";

// ============================================
// Pending competition entries, for the organizer. Accepting creates the
// competition team from the manager's club AND imports its squad, so the
// team lands ready to play. Renders nothing when there is nothing to decide.
// ============================================

export default function RegistrationsPanel({
  cid,
  onDecided,
}: {
  cid: string;
  onDecided?: () => void;
}) {
  const { firebaseUser } = useAuth();
  const [registrations, setRegistrations] = useState<CompetitionRegistration[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/competitions/registrations?cid=${cid}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { registrations: CompetitionRegistration[] };
      setRegistrations(data.registrations ?? []);
    } catch {
      // Non-blocking — the team list below still renders.
    }
  }, [firebaseUser, cid]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (reg: CompetitionRegistration, action: "accept" | "reject") => {
    if (!firebaseUser) return;
    setBusy(reg.id);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/registrations", {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: reg.id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue");
        return;
      }
      toast.success(
        action === "accept"
          ? `${reg.clubName} inscrite — ${data.added ?? 0} joueur(s) repris`
          : "Inscription refusée",
      );
      await load();
      onDecided?.();
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setBusy(null);
    }
  };

  if (registrations.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
        <ClipboardList size={15} />
        {registrations.length} inscription{registrations.length !== 1 ? "s" : ""} en attente
      </p>
      <p className="mt-0.5 text-xs font-medium text-amber-700">
        Accepter crée l&apos;équipe et reprend automatiquement l&apos;effectif du club.
      </p>
      <div className="mt-3 space-y-2">
        {registrations.map((reg) => (
          <div key={reg.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                {reg.clubLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={reg.clubLogo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-black text-gray-400">
                    {reg.clubName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-gray-900">{reg.clubName}</p>
                <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-gray-400">
                  {reg.clubCity && (
                    <>
                      <MapPin size={10} /> {reg.clubCity} ·
                    </>
                  )}
                  {reg.managerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => decide(reg, "reject")}
                disabled={busy === reg.id}
                className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
              >
                <X size={15} />
              </button>
              <button
                type="button"
                onClick={() => decide(reg, "accept")}
                disabled={busy === reg.id}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {busy === reg.id ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Check size={15} />
                )}
                Accepter
              </button>
            </div>
            {reg.message && (
              <p className="mt-2 border-l-2 border-gray-100 pl-3 text-xs italic leading-relaxed text-gray-500">
                {reg.message}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
