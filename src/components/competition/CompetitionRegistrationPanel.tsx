"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Loader2, Send, Clock3, X, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { listPublicCompetitions } from "@/lib/competition-firestore";
import type { Competition, CompetitionRegistration, Team } from "@/types";

// ============================================
// "Inscrire mon équipe" — the manager-initiated way into a competition.
//
// Only competitions at the `registration` stage are offered: once fixtures
// are generated, adding a team would break the schedule. Accepting creates
// the competition team from the club and imports its squad, so a manager who
// already runs a roster never types it twice.
// ============================================

export default function CompetitionRegistrationPanel({
  clubs,
  onAccepted,
}: {
  clubs: Team[];
  onAccepted?: () => void;
}) {
  const { firebaseUser } = useAuth();
  const [open, setOpen] = useState<Competition[]>([]);
  const [mine, setMine] = useState<CompetitionRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Competition | null>(null);
  const [clubId, setClubId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadMine = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/registrations?mine=1", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { registrations: CompetitionRegistration[] };
      setMine(data.registrations ?? []);
    } catch {
      // Non-blocking.
    }
  }, [firebaseUser]);

  useEffect(() => {
    let cancelled = false;
    listPublicCompetitions()
      .then((all) => {
        if (!cancelled) setOpen(all.filter((c) => c.status === "registration"));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  const startApply = (competition: Competition) => {
    setTarget(competition);
    setClubId(clubs[0]?.id ?? "");
    setMessage("");
  };

  const submit = async () => {
    if (!firebaseUser || !target || !clubId) return;
    setBusy(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/registrations", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ cid: target.id, clubId, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "L'inscription a échoué");
        return;
      }
      toast.success("Demande envoyée — en attente de l'organisateur");
      setTarget(null);
      await loadMine();
      onAccepted?.();
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (reg: CompetitionRegistration) => {
    if (!firebaseUser) return;
    setBusy(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/registrations", {
        method: "DELETE",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: reg.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Impossible d'annuler");
        return;
      }
      toast.success("Demande annulée");
      await loadMine();
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setBusy(false);
    }
  };

  const pending = mine.filter((r) => r.status === "pending");
  // A competition already applied to (pending or accepted) must not be
  // offered again — the API would reject it anyway.
  const claimed = new Set(
    mine.filter((r) => r.status !== "rejected").map((r) => r.competitionId),
  );
  const available = open.filter((c) => !claimed.has(c.id));

  if (loading) {
    return <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />;
  }

  if (clubs.length === 0) return null;

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-amber-800">
            Demandes en attente
          </p>
          <div className="mt-2 space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                <Clock3 size={15} className="shrink-0 text-amber-500" />
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">
                  {r.clubName}
                  <span className="font-semibold text-gray-400"> → {r.competitionName}</span>
                </p>
                <button
                  type="button"
                  onClick={() => withdraw(r)}
                  disabled={busy}
                  className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-900">Inscrire mon équipe</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-500">
            Ces compétitions acceptent les inscriptions. Une fois validée, ton effectif
            est repris automatiquement.
          </p>
          <div className="mt-3 space-y-2">
            {available.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-amber-50">
                  {c.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Trophy size={16} className="text-amber-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{c.name}</p>
                  {c.venueCity && (
                    <p className="flex items-center gap-1 text-xs font-semibold text-gray-400">
                      <MapPin size={11} /> {c.venueCity}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => startApply(c)}
                  className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-600"
                >
                  S&apos;inscrire
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Apply modal */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-gray-900">
                  Inscrire une équipe
                </h2>
                <p className="truncate text-xs font-semibold text-gray-400">{target.name}</p>
              </div>
              <button
                onClick={() => !busy && setTarget(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mb-1.5 block text-xs font-bold text-gray-600">Équipe</label>
            <select
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 focus:border-emerald-400 focus:bg-white focus:outline-none"
            >
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <label className="mb-1.5 mt-4 block text-xs font-bold text-gray-600">
              Message <span className="font-semibold text-gray-300">(optionnel)</span>
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Un mot pour l'organisateur…"
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !busy && setTarget(null)}
                className="rounded-lg px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !clubId}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
