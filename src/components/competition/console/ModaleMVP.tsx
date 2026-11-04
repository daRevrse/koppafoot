"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Trophy } from "lucide-react";
import type { CandidatMVP } from "@/lib/mvp";

/**
 * Qui a été l'homme du match ?
 *
 * Trois noms proposés, classés par ce que la timeline a retenu, et le motif
 * sous chacun pour que le scoreur voie sur quoi la suggestion repose. IL
 * TRANCHE, la liste ne décide pas : « Un autre joueur » ouvre toute la feuille,
 * et « Terminer sans désigner » existe parce qu'un match sans homme du match
 * est un cas normal — rien ici ne doit retenir un coup de sifflet.
 */
export function ModaleMVP({
  candidats, homeTeamId, homeTeamName, awayTeamName, isSubmitting, onChoisir, onPasser, feminine = false,
}: {
  candidats: CandidatMVP[];
  homeTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  /** Compétition féminine : on élit la joueuse du match (lib/genre). */
  feminine?: boolean;
  isSubmitting: boolean;
  onChoisir: (c: CandidatMVP) => void;
  onPasser: () => void;
}) {
  const [tout, setTout] = useState(false);
  const proposes = candidats.filter((c) => !c.exclu);
  const visibles = tout ? candidats : proposes.slice(0, 3);

  return (
    <div className="fixed inset-0 modal-layer flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        style={{ maxHeight: "calc(var(--console-h, 100dvh) * 0.85)" }}
        className="relative flex w-full max-w-md flex-col bg-white p-5 shadow-2xl sm:p-8"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-amber-400 text-white">
            <Trophy size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-gray-900">{feminine ? "Joueuse du match" : "Homme du match"}</h2>
            <p className="text-xs font-bold uppercase tracking-tight text-gray-400 italic">
              Les deux équipes sont éligibles
            </p>
          </div>
        </div>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {visibles.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold text-gray-400">
              Aucune feuille de match : personne à désigner.
            </p>
          ) : (
            <div className="space-y-2">
              {visibles.map((c) => (
                <button
                  key={`${c.teamId}-${c.playerId}`}
                  onClick={() => onChoisir(c)}
                  disabled={isSubmitting}
                  className={`flex w-full items-center gap-3 border p-3 text-left transition-colors disabled:opacity-50 ${
                    c.exclu ? "border-red-100 bg-red-50/40 hover:border-red-300" : "border-gray-200/70 hover:border-gray-900"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-gray-900">{c.name}</p>
                    <p className="truncate text-[11px] font-semibold text-gray-400">
                      {c.teamId === homeTeamId ? homeTeamName : awayTeamName}
                      {c.motif ? ` · ${c.motif}` : ""}
                      {c.exclu ? " · Expulsé" : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!tout && candidats.length > visibles.length && (
            <button
              onClick={() => setTout(true)}
              className="mt-3 w-full text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 underline transition-colors hover:text-gray-900"
            >
              Un autre joueur
            </button>
          )}
        </div>

        <button
          onClick={onPasser}
          disabled={isSubmitting}
          className="mt-4 w-full border border-gray-200/70 px-4 py-3 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {isSubmitting ? "Fin du match..." : "Terminer sans désigner"}
        </button>
      </motion.div>
    </div>
  );
}
