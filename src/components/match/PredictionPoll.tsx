"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModal";
import { castPrediction, fetchCounts, getMyPrediction, EMPTY_COUNTS, type Pick, type PredictionCounts, pourcentages } from "@/lib/predictions";

// ============================================
// « Qui va gagner ? », le pronostic de la fiche match.
//
// Deux états et un seul geste : on voit trois choix tant que le match n'a
// aucun pronostic, et le résultat dès qu'il en a un — celui de tout le monde,
// qu'on ait voté ou non. Voir `showResult` pour le pourquoi de ce choix.
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

  /**
   * UN MATCH QUI A DES VOTES MONTRE SES CHIFFRES, À TOUT LE MONDE.

 * Le résultat ne s'ouvrait qu'à celui qui avait voté, pour ne pas ancrer les
 * suivants sur le premier chiffre affiché. La prudence coûtait plus qu'elle ne
 * protégeait : un visiteur voyait trois barres muettes, donc rien qui donne
 * envie de participer — or c'est le chiffre lui-même qui appelle le vote, on
 * clique pour se situer, pas dans le vide.
 *
 * « Au moins un vote RÉEL » : `total` ne compte pas les voix d'office, qui
 * n'existent que pour amortir les pourcentages des premiers votes (voir
 * lib/predictions). Sans ce garde-fou, un match que personne n'a pronostiqué
 * afficherait un 33/33/33 inventé de toutes pièces.
   */
  const votesReels = counts?.total ?? 0;
  const showResult = mine !== null || closed || votesReels > 0;

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
                    {/* SUR TÉLÉPHONE, L'ÉCUSSON REMPLACE LE NOM. C'était
                        l'inverse : le logo était masqué sous `sm` et le nom
                        seul restait, tronqué à quelques lettres dans un tiers
                        de rangée — « OLYM… » ne nomme pas une équipe mieux que
                        son écusson, et coûte la place du pourcentage.

                        « Nul » n'a pas d'écusson : son mot reste, sinon son
                        tiers serait vide. */}
                    {o.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.logo} alt={o.label} className="relative h-5 w-5 shrink-0 object-contain sm:h-4 sm:w-4" />
                    )}
                    <span
                      className={`relative truncate text-[10px] font-black uppercase tracking-wide sm:text-[11px] ${
                        o.logo ? "hidden sm:inline" : ""
                      } ${isMine ? "text-emerald-300" : "text-white/80"}`}
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
