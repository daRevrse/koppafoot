"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Clock3, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { listPublicCompetitions } from "@/lib/competition-firestore";
import RegisterTeamButton from "@/components/competition/RegisterTeamButton";
import type { Competition, CompetitionRegistration, Team } from "@/types";

// ============================================
// "Inscrire mon équipe" — the manager-initiated way into a competition.
//
// Only competitions at the `registration` stage are offered: once fixtures
// are generated, adding a team would break the schedule. Accepting creates
// the competition team from the club and imports its squad, so a manager who
// already runs a roster never types it twice.
// ============================================

export default function CompetitionRegistrationPanel({ clubs }: { clubs: Team[] }) {
  const { firebaseUser } = useAuth();
  const [open, setOpen] = useState<Competition[]>([]);
  const [mine, setMine] = useState<CompetitionRegistration[]>([]);
  const [loading, setLoading] = useState(true);
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
  // offered again — the API would reject it anyway. Rejected and removed
  // entries do not block: both leave the club free to enter again.
  const claimed = new Set(
    mine
      .filter((r) => r.status !== "rejected" && r.status !== "removed")
      .map((r) => r.competitionId),
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
                {/* Same component as the public competition page, so the
                    modal and its rules live in one place. */}
                <RegisterTeamButton competition={c} label="S'inscrire" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
