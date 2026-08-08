"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, X, Clock3, BadgeCheck, Receipt, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getTeamsByManager } from "@/lib/firestore";
import type { Competition, CompetitionRegistration, Team } from "@/types";

// ============================================
// Register one club in ONE competition, modal included.
//
// Lives in its own component so the public competition page and the
// manager's own screen open the same modal instead of one of them bouncing
// the user somewhere else to do it.
//
// Renders nothing when the viewer has no club to enter — a spectator has no
// business seeing an entry form.
// ============================================

export default function RegisterTeamButton({
  competition,
  className,
  label = "Inscrire mon équipe",
}: {
  competition: Competition;
  className?: string;
  label?: string;
}) {
  const { user, firebaseUser } = useAuth();
  const [clubs, setClubs] = useState<Team[]>([]);
  const [mine, setMine] = useState<CompetitionRegistration[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [clubId, setClubId] = useState("");
  const [message, setMessage] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasRules = Boolean(competition.rulesText || competition.rulesUrl);
  const hasFee = competition.entryFee != null && competition.entryFee > 0;
  const rulesBlocking = competition.requireRulesAcceptance && !rulesAccepted;

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
    if (!user) {
      setReady(true);
      return;
    }
    let cancelled = false;
    Promise.all([getTeamsByManager(user.uid).catch(() => [] as Team[]), loadMine()]).then(
      ([c]) => {
        if (cancelled) return;
        setClubs(c);
        setClubId(c[0]?.id ?? "");
        setReady(true);
      },
    );
    return () => { cancelled = true; };
  }, [user, loadMine]);

  const submit = async () => {
    if (!firebaseUser || !clubId) return;
    setBusy(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/registrations", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ cid: competition.id, clubId, message, rulesAccepted }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "L'inscription a échoué");
        return;
      }
      toast.success("Demande envoyée — en attente de l'organisateur");
      setOpen(false);
      setMessage("");
      setRulesAccepted(false);
      await loadMine();
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setBusy(false);
    }
  };

  if (!ready || clubs.length === 0) return null;

  // A rejected entry, or one whose team was pulled out of the competition,
  // leaves the manager free to enter again — so neither counts as "here".
  const here = mine.find(
    (r) =>
      r.competitionId === competition.id &&
      r.status !== "rejected" &&
      r.status !== "removed",
  );

  if (here) {
    return here.status === "accepted" ? (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-700">
        <BadgeCheck size={14} /> Inscrite
      </span>
    ) : (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-amber-600">
        <Clock3 size={14} /> En attente
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-600"
        }
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-gray-900">
                  Inscrire une équipe
                </h2>
                <p className="truncate text-xs font-semibold text-gray-400">
                  {competition.name}
                </p>
              </div>
              <button
                onClick={() => !busy && setOpen(false)}
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

            {hasFee && (
              <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
                  <Receipt size={14} />
                  Frais d&apos;inscription : {competition.entryFee?.toLocaleString("fr-FR")}{" "}
                  {competition.entryFeeCurrency}
                </p>
                <p className="mt-0.5 text-xs font-medium text-amber-700">
                  À régler directement auprès de l&apos;organisateur. KoppaFoot
                  n&apos;encaisse rien.
                </p>
              </div>
            )}

            {hasRules && (
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-bold text-gray-600">Règlement</p>
                {competition.rulesText && (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-relaxed whitespace-pre-line text-gray-600">
                    {competition.rulesText}
                  </div>
                )}
                {competition.rulesUrl && (
                  <a
                    href={competition.rulesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                  >
                    <FileText size={13} /> Lire le document complet
                  </a>
                )}
                <label className="mt-3 flex items-start gap-2.5 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={rulesAccepted}
                    onChange={(e) => setRulesAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
                  />
                  <span>
                    J&apos;ai lu et j&apos;accepte le règlement
                    {competition.requireRulesAcceptance && (
                      <span className="text-red-500"> *</span>
                    )}
                  </span>
                </label>
              </div>
            )}

            <p className="mt-3 text-xs font-semibold leading-relaxed text-gray-400">
              Une fois validée par l&apos;organisateur, ton effectif est repris
              automatiquement — tu n&apos;as rien à ressaisir.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                className="rounded-lg px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !clubId || rulesBlocking}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
