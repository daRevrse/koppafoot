"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModal";
import {
  castPrediction, fetchCounts, getMyPrediction,
  EMPTY_COUNTS, type Pick, type PredictionCounts,
} from "@/lib/predictions";

// ============================================
// « Qui va gagner ? » — le pronostic du rail.
//
// Deux états et un seul geste : tant qu'on n'a pas voté on voit trois choix,
// une fois voté on voit le résultat. Les totaux restent cachés avant le vote,
// sinon le premier chiffre affiché décide pour tout le monde.
//
// Un compte est nécessaire pour voter — sans quoi le sondage se remplit de
// rechargements de page — mais le RÉSULTAT est visible de tous, y compris
// sans compte : c'est une information publique, comme le score.
// ============================================

interface Side {
  label: string;
  logo: string | null;
}

export default function PredictionPoll({
  matchId, home, away, closed = false,
}: {
  matchId: string;
  home: Side;
  away: Side;
  /** Le coup d'envoi est passé : on ne pronostique plus, on regarde. */
  closed?: boolean;
}) {
  const { user } = useAuth();
  const { open } = useAuthModal();

  const [counts, setCounts] = useState<PredictionCounts | null>(null);
  const [mine, setMine] = useState<Pick | null>(null);
  const [sending, setSending] = useState<Pick | null>(null);

  const reload = useCallback(async () => {
    setCounts(await fetchCounts(matchId));
  }, [matchId]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    let alive = true;
    if (!user) { setMine(null); return; }
    getMyPrediction(matchId, user.uid).then((p) => { if (alive) setMine(p); });
    return () => { alive = false; };
  }, [matchId, user]);

  const vote = async (pick: Pick) => {
    if (closed || sending) return;
    if (!user) {
      open("Crée ton compte pour donner ton pronostic.");
      return;
    }
    setSending(pick);
    try {
      await castPrediction(matchId, user.uid, pick);
      setMine(pick);
      await reload();
    } finally {
      setSending(null);
    }
  };

  const total = counts?.total ?? 0;
  // Le résultat s'ouvre une fois qu'on a voté — ou quand il n'y a plus rien à
  // pronostiquer, le match ayant commencé.
  const showResult = mine !== null || closed;

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const OPTIONS: { key: Pick; label: string; logo: string | null; value: number }[] = [
    { key: "home", label: home.label, logo: home.logo, value: counts?.home ?? 0 },
    { key: "draw", label: "Match nul", logo: null, value: counts?.draw ?? 0 },
    { key: "away", label: away.label, logo: away.logo, value: counts?.away ?? 0 },
  ];

  return (
    <section aria-labelledby="rail-pronostic" className="border border-gray-200/70 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="rail-pronostic" className="font-display text-lg font-black tracking-tight text-gray-900">
            Qui va gagner ?
          </h2>
          <p className="mt-0.5 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
            {closed ? "Pronostics fermés" : mine ? "Ton pronostic est enregistré" : "Donne ton pronostic"}
          </p>
        </div>
        <Trophy size={20} strokeWidth={1.5} className="shrink-0 text-gray-300" />
      </div>

      {counts === null ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      ) : showResult ? (
        <ul className="mt-5 space-y-3">
          {OPTIONS.map((o) => {
            const p = pct(o.value);
            const isMine = mine === o.key;
            return (
              <li key={o.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm font-bold ${isMine ? "text-emerald-700" : "text-gray-700"}`}>
                    {o.label}
                    {isMine && <span className="ml-1.5 text-[10px] font-black uppercase tracking-[0.12em]">ton choix</span>}
                  </span>
                  <span className="shrink-0 font-display text-sm font-black tabular-nums text-gray-900">{p}%</span>
                </div>
                {/* La barre porte le chiffre, elle ne le remplace pas. */}
                <div className="mt-1.5 h-1.5 bg-gray-100">
                  <div
                    className={`h-full transition-all ${isMine ? "bg-emerald-700" : "bg-gray-900"}`}
                    style={{ width: `${p}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => vote(o.key)}
              disabled={sending !== null}
              aria-label={o.key === "draw" ? "Match nul" : `Victoire de ${o.label}`}
              className="flex h-16 items-center justify-center border border-gray-200/70 transition-colors hover:border-gray-900 disabled:opacity-40"
            >
              {sending === o.key ? (
                <Loader2 size={18} className="animate-spin text-gray-400" />
              ) : o.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.logo} alt="" className="h-9 w-9 object-contain" />
              ) : (
                <span className="font-display text-xl font-black text-gray-400">
                  {o.key === "draw" ? "X" : o.label.slice(0, 3).toUpperCase()}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
        {total === 0 ? "Aucun pronostic" : `${total} pronostic${total > 1 ? "s" : ""}`}
      </p>
    </section>
  );
}
