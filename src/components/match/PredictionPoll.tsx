"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModal";
import { castPrediction, fetchCounts, getMyPrediction, EMPTY_COUNTS, type Pick, type PredictionCounts, pourcentages } from "@/lib/predictions";

// ============================================
// « Qui va gagner ? », le pronostic de la fiche match.
//
// Deux états et un seul geste : tant qu'on n'a pas voté on voit trois choix,
// une fois voté on voit le résultat. Les totaux restent cachés avant le vote,
// sinon le premier chiffre affiché décide pour tout le monde.
//
// Un compte est nécessaire pour voter, sans quoi le sondage se remplit de
// rechargements de page, mais le RÉSULTAT est visible de tous, y compris
// sans compte : c'est une information publique, comme le score.
//
// IL A CHANGÉ DE MAISON, ET DE TAILLE. C'était une carte blanche dans la
// colonne de droite, c'est-à-dire, sur un téléphone, un bloc tout en bas de
// page que personne n'atteignait. Il vit désormais DANS le tableau d'affichage
// (MatchHero), juste sous l'affiche : d'où le fond sombre.
//
// ET IL TIENT SUR UNE SEULE LIGNE. Il en occupait trois — la question, les
// trois choix, le décompte — soit une centaine de pixels d'un écran qui doit
// tenir l'affiche, le score et les onglets. La question devient une étiquette
// à gauche, et le résultat du vote ne prend plus de place du tout : le
// pourcentage REMPLIT le segment de chaque issue. Voter ne change donc plus la
// hauteur du bloc, seulement sa couleur.
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

  // Le résultat s'ouvre une fois qu'on a voté, ou quand il n'y a plus rien à
  // pronostiquer, le match ayant commencé.
  const showResult = mine !== null || closed;

  // Une voix d'office par issue : sans elle, le premier votant envoie son
  // camp a 100% et les deux autres a 0%. Voir lib/predictions.
  const parts = pourcentages(counts ?? EMPTY_COUNTS);

  const OPTIONS: { key: Pick; label: string; logo: string | null; pct: number }[] = [
    { key: "home", label: home.label, logo: home.logo, pct: parts.home },
    { key: "draw", label: "Match nul", logo: null, pct: parts.draw },
    { key: "away", label: away.label, logo: away.logo, pct: parts.away },
  ];


  return (
    <section aria-labelledby="pronostic" className="flex items-center gap-2 sm:gap-4">
      <h2
        id="pronostic"
        className="shrink-0 text-[10px] font-black uppercase leading-tight tracking-[0.12em] text-white/40 sm:text-[11px]"
      >
        {closed ? "Pronostics" : "Qui gagne ?"}
      </h2>

      {counts === null ? (
        <div className="flex flex-1 justify-center py-2">
          <Loader2 size={16} className="animate-spin text-white/30" />
        </div>
      ) : (
        <div className="grid min-w-0 flex-1 grid-cols-3 divide-x divide-white/10 border border-white/15 bg-white/5">
          {OPTIONS.map((o) => {
            const isMine = mine === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => vote(o.key)}
                disabled={showResult || sending !== null}
                aria-label={o.key === "draw" ? "Match nul" : `Victoire de ${o.label}`}
                className={`relative flex min-w-0 items-center justify-center gap-1.5 overflow-hidden px-1.5 py-2 transition-colors disabled:cursor-default ${
                  showResult ? "" : "hover:bg-white/10"
                } ${sending !== null && !showResult ? "opacity-40" : ""}`}
              >
                {showResult && (
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 transition-all ${isMine ? "bg-emerald-500/35" : "bg-white/10"}`}
                    style={{ width: `${o.pct}%` }}
                  />
                )}
                {sending === o.key ? (
                  <Loader2 size={14} className="relative animate-spin text-white/60" />
                ) : (
                  <>
                    {o.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.logo} alt="" className="relative hidden h-4 w-4 shrink-0 object-contain sm:block" />
                    )}
                    <span
                      className={`relative truncate text-[10px] font-black uppercase tracking-wide sm:text-[11px] ${
                        isMine ? "text-emerald-300" : "text-white/80"
                      }`}
                    >
                      {o.key === "draw" ? "Nul" : o.label}
                    </span>
                    {showResult && (
                      <span className="relative shrink-0 text-[10px] font-black tabular-nums text-white sm:text-[11px]">
                        {o.pct}%
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* PAS DE DÉCOMPTE. Il tenait la droite de la ligne, et il ne disait
          rien de bon : sur un amical entre deux clubs de quartier, « 3 »
          annonce surtout que personne ne regarde. Les pourcentages portent
          déjà le résultat, qui est ce qu'on vient lire. */}
    </section>
  );
}
