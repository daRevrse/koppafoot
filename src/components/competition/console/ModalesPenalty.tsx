"use client";

import { motion } from "motion/react";
import { X } from "lucide-react";
import { ISSUES_PENALTY, LIBELLE_ISSUE_PENALTY, type IssuePenalty } from "@/lib/evenements";
import type { LineupEntry } from "@/types";

/**
 * LE CARTON DU FAUTIF, juste après l'avoir nommé : c'est le moment où l'arbitre
 * le sort. Trois réponses, dont « aucun », qui est la plus fréquente. Un
 * joueur déjà averti voit son jaune annoncé pour ce qu'il est : une exclusion.
 */
export function ModaleCartonPenalty({
  fautif, dejaAverti, isSubmitting, onCarton,
}: {
  fautif: LineupEntry;
  dejaAverti: boolean;
  isSubmitting: boolean;
  onCarton: (carton: "yellow_card" | "red_card" | null) => void;
}) {
  return (
    <div className="fixed inset-0 modal-layer flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => onCarton(null)}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        style={{ maxHeight: "calc(var(--console-h, 100dvh) - 2rem)" }}
        className="relative w-full max-w-md overflow-y-auto bg-white p-4 shadow-2xl sm:p-7"
      >
        <h2 className="text-lg font-black text-gray-900">Carton ?</h2>
        <p className="mb-4 mt-0.5 text-xs font-bold uppercase tracking-tight text-gray-400 italic">
          {`${fautif.name} · faute sur le penalty`}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onCarton(null)}
            className="border border-gray-200/70 bg-gray-50 px-3 py-3 text-sm font-black uppercase tracking-tight text-gray-600 transition-colors hover:bg-gray-100 active:scale-95 disabled:opacity-40"
          >
            Aucun
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onCarton("yellow_card")}
            className="border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-black uppercase tracking-tight text-amber-700 transition-colors hover:bg-amber-100 active:scale-95 disabled:opacity-40"
          >
            🟨 {dejaAverti ? "2e jaune" : "Jaune"}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onCarton("red_card")}
            className="border border-red-200 bg-red-50 px-3 py-3 text-sm font-black uppercase tracking-tight text-red-700 transition-colors hover:bg-red-100 active:scale-95 disabled:opacity-40"
          >
            🟥 Rouge
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * LA QUESTION QU'UN PENALTY POSE, ET QU'IL FAUT BIEN POSER.
 *
 * Elle s'ouvre d'elle-meme des que le penalty est accorde, parce que c'est le
 * seul moment ou le scoreur regarde son telephone : trente secondes plus tard
 * le ballon est sur le point, et il regarde le terrain. Elle se referme sans
 * repondre — il a le droit de regarder, lui aussi — et le penalty passe alors
 * dans le bandeau d'attente, d'ou elle revient d'un appui.
 *
 * QUATRE BOUTONS, PAS UN MENU. Ce sont quatre issues et il n'y en a pas de
 * cinquieme ; un menu deroulant demanderait deux gestes, et un `<select>`
 * natif s'ouvre de travers dans une console couchee — voir `openSubModal`.
 */
export function ModaleIssuePenalty({
  teamName,
  minute,
  varDisponible,
  isSubmitting,
  onIssue,
  onClose,
}: {
  teamName: string;
  /** Déjà écrite : « 45+2' ». */
  minute: string;
  /** La VAR n'existe qu'en competition : ailleurs le penalty est « retiré ». */
  varDisponible: boolean;
  isSubmitting: boolean;
  onIssue: (issue: IssuePenalty) => void;
  onClose: () => void;
}) {
  const EMOJIS: Record<IssuePenalty, string> = {
    // Le retrait porte une interdiction et non un écran de VAR : la salle de
    // vidéo n'existe qu'en compétition, l'annulation existe partout.
    marque: "⚽", rate: "👟", arrete: "🧤", retire: "🚫",
  };
  const TONS: Record<IssuePenalty, string> = {
    marque: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    rate: "border-gray-200/70 bg-gray-50 text-gray-600 hover:bg-gray-100",
    arrete: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
    retire: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  };

  return (
    <div className="fixed inset-0 modal-layer flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        // `var(--console-h)` : la hauteur REELLE de la console, qui n'est pas
        // celle de l'appareil quand elle est couchee. Voir ConsoleCouchee.
        style={{ maxHeight: "calc(var(--console-h, 100dvh) - 2rem)" }}
        className="relative w-full max-w-md overflow-y-auto bg-white p-4 shadow-2xl sm:p-7"
      >
        <button
          onClick={onClose}
          aria-label="Plus tard"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <X size={16} />
        </button>
        <h2 className="text-lg font-black text-gray-900">Penalty</h2>
        <p className="mb-4 mt-0.5 text-xs font-bold uppercase tracking-tight text-gray-400 italic">
          {`${teamName} · ${minute} · Que devient-il ?`}
        </p>

        <div className="grid grid-cols-2 gap-2">
          {ISSUES_PENALTY.map((issue) => (
            <button
              key={issue}
              type="button"
              disabled={isSubmitting}
              onClick={() => onIssue(issue)}
              className={`flex items-center gap-2 border px-3 py-3 text-left transition-colors active:scale-95 disabled:opacity-40 ${TONS[issue]}`}
            >
              <span aria-hidden className="text-lg leading-none">{EMOJIS[issue]}</span>
              <span className="min-w-0 truncate text-sm font-black uppercase tracking-tight">
                {issue === "retire" && varDisponible
                  ? "Retiré (VAR)"
                  : LIBELLE_ISSUE_PENALTY[issue]}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-3 text-[11px] font-medium leading-relaxed text-gray-400">
          Tant que rien n&apos;est dit, le penalty reste en attente et s&apos;affiche
          en haut de la console.
        </p>
      </motion.div>
    </div>
  );
}
