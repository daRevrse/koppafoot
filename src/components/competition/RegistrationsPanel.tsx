"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check, X, Loader2, ClipboardList, MapPin, Receipt, FileCheck, Circle,
} from "lucide-react";
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
      const res = await fetch(`/api/competitions/registrations?cid=${cid}&status=all`, {
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

  const act = async (
    reg: CompetitionRegistration,
    action: "accept" | "reject" | "mark_paid" | "mark_unpaid",
  ) => {
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
      const messages = {
        accept: `${reg.clubName} inscrite — ${data.added ?? 0} joueur(s) repris`,
        reject: "Inscription refusée",
        mark_paid: `${reg.clubName} — frais encaissés`,
        mark_unpaid: `${reg.clubName} — repassée en impayé`,
      };
      toast.success(messages[action]);
      await load();
      if (action === "accept" || action === "reject") onDecided?.();
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setBusy(null);
    }
  };

  const pending = registrations.filter((r) => r.status === "pending");
  // Fee tracking only concerns entries that are actually in, and only when
  // the organizer set a fee in the first place.
  const billable = registrations.filter(
    (r) => r.status === "accepted" && r.feeAmount != null && r.feeAmount > 0,
  );

  if (pending.length === 0 && billable.length === 0) return null;

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <ClipboardList size={15} />
            {pending.length} inscription{pending.length !== 1 ? "s" : ""} en attente
          </p>
          <p className="mt-0.5 text-xs font-medium text-amber-700">
            Accepter crée l&apos;équipe et reprend automatiquement l&apos;effectif du club.
          </p>
          <div className="mt-3 space-y-2">
            {pending.map((reg) => (
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
                    onClick={() => act(reg,"reject")}
                    disabled={busy === reg.id}
                    className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    <X size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => act(reg,"accept")}
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
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {reg.rulesAcceptedAt && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <FileCheck size={11} /> Règlement accepté
                    </span>
                  )}
                  {reg.feeAmount != null && reg.feeAmount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400">
                      <Receipt size={11} /> {reg.feeAmount.toLocaleString("fr-FR")} {reg.feeCurrency}{" "}
                      à encaisser
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {billable.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Receipt size={15} />
            Frais d&apos;inscription
          </p>
          <p className="mt-0.5 text-xs font-medium text-gray-400">
            {billable.filter((r) => r.feeStatus === "paid").length}/{billable.length} équipe
            {billable.length !== 1 ? "s" : ""} à jour · suivi manuel, KoppaFoot n&apos;encaisse
            rien.
          </p>
          <div className="mt-3 space-y-1.5">
            {billable.map((reg) => {
              const paid = reg.feeStatus === "paid";
              return (
                <div
                  key={reg.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{reg.clubName}</p>
                    <p className="text-xs font-semibold text-gray-400">
                      {reg.feeAmount?.toLocaleString("fr-FR")} {reg.feeCurrency}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => act(reg, paid ? "mark_unpaid" : "mark_paid")}
                    disabled={busy === reg.id}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                      paid
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {busy === reg.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : paid ? (
                      <Check size={13} />
                    ) : (
                      <Circle size={13} />
                    )}
                    {paid ? "Payé" : "Non payé"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
