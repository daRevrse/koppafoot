"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { poserJournees } from "@/lib/competition-firestore";
import { proposerJournees } from "@/lib/journees";
import type { CompMatch } from "@/types";

// ============================================
// « Numéroter les journées » : la proposition pour les matchs de poule qui
// n'ont pas encore de journée (voir lib/journees, `proposerJournees`).
//
// RIEN NE S'ÉCRIT AVANT « APPLIQUER ». Une journée fausse affichée au public
// est l'erreur que la conception refuse : l'organisateur voit chaque match et
// sa journée, poule par poule, avant d'accepter. Les journées déjà posées ne
// bougent jamais, à la main ou par la génération.
// ============================================

export default function NumeroterJournees({ cid, matchs, onFini }: {
  cid: string;
  matchs: CompMatch[];
  onFini: () => void;
}) {
  const [envoi, setEnvoi] = useState(false);
  const { journees, depassement } = useMemo(() => proposerJournees(matchs), [matchs]);

  // Poule par poule, dans l'ordre des journées proposées.
  const poules = useMemo(() => {
    const parPoule = new Map<string, { match: CompMatch; journee: number }[]>();
    for (const m of matchs) {
      const j = journees.get(m.id);
      if (j == null) continue;
      const cle = m.group ?? "–";
      parPoule.set(cle, [...(parPoule.get(cle) ?? []), { match: m, journee: j }]);
    }
    return [...parPoule.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([poule, lignes]) => ({ poule, lignes: lignes.sort((a, b) => a.journee - b.journee) }));
  }, [matchs, journees]);

  const appliquer = async () => {
    setEnvoi(true);
    try {
      await poserJournees(cid, journees);
      toast.success(`${journees.size} match${journees.size > 1 ? "s" : ""} numéroté${journees.size > 1 ? "s" : ""}`);
      onFini();
    } catch {
      toast.error("Les journées n'ont pas pu être enregistrées");
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 modal-layer flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col modal-sheet rounded-t-3xl bg-white p-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-gray-900">Numéroter les journées</h2>
          <button type="button" onClick={() => !envoi && onFini()} aria-label="Fermer" className="p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Une journée, c&apos;est le tour où chaque équipe joue une fois, même s&apos;il s&apos;étale sur plusieurs dates.
          Voici la numérotation proposée, dans l&apos;ordre des dates. Les journées déjà posées ne changent pas.
        </p>
        {depassement && (
          <p className="mt-3 flex items-start gap-2 bg-amber-50 px-3 py-2 text-xs font-semibold leading-snug text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Une poule demande plus de journées qu&apos;elle ne devrait : l&apos;ordre des dates ne suit pas les tours.
            Applique, puis corrige à la main les matchs mal placés.
          </p>
        )}

        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
          {poules.map(({ poule, lignes }) => (
            <div key={poule}>
              <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-gray-500">Poule {poule}</p>
              <ul className="divide-y divide-gray-100 border border-gray-200/70">
                {lignes.map(({ match, journee }) => (
                  <li key={match.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-gray-900">
                      {match.homeTeamName} – {match.awayTeamName}
                      {match.date && <span className="ml-2 text-xs text-gray-400">{match.date}</span>}
                    </span>
                    <span className="shrink-0 text-xs font-black text-primary-700">Journée {journee}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onFini} disabled={envoi}
            className="border border-gray-200/70 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button type="button" onClick={() => void appliquer()} disabled={envoi || journees.size === 0}
            className="flex items-center gap-2 bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {envoi && <Loader2 size={14} className="animate-spin" />}
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
