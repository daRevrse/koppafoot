"use client";

import { motion } from "motion/react";
import { X } from "lucide-react";
import { normaliserPoste } from "@/lib/postes";
import { nomCourt } from "@/components/match/TerrainCompo";
import type { LineupEntry } from "@/types";

export function PlayerPickerModal({
  titre,
  sousTitre,
  teamName,
  entries,
  yellowSet,
  isSubmitting,
  onPick,
  onClose,
  ignorer,
  onIgnorer,
}: {
  /** Ce qu'on demande. La modale ne devine plus rien du type d'événement. */
  titre: string;
  sousTitre: string;
  teamName: string;
  entries: LineupEntry[];
  yellowSet: Set<string>;
  isSubmitting: boolean;
  onPick: (entry: LineupEntry) => void;
  onClose: () => void;
  /**
   * Le libellé du bouton qui referme sans répondre. Présent uniquement sur les
   * questions FACULTATIVES — la passe décisive, la victime d'une faute : le
   * fait principal est déjà enregistré, la console ne doit pas retenir le
   * scoreur pour un détail.
   */
  ignorer?: string;
  /**
   * Ce que fait ce bouton, quand refermer n'est pas ce qu'il veut dire.
   *
   * Sur le tireur d'un penalty, « tireur inconnu » est une RÉPONSE : elle pose
   * l'issue sans nom, et sort le penalty de l'attente. Refermer, là, le
   * laisserait en attente pour toujours.
   */
  onIgnorer?: () => void;
}) {

  // Les titulaires d'abord, le GARDIEN EN DERNIER parmi eux : c'est le moins
  // probable des passeurs, et il ouvrait la liste. Les remplaçants ensuite.
  const rang = (e: LineupEntry) =>
    (e.role === "starter" ? 0 : 2) + (normaliserPoste(e.position) === "goalkeeper" ? 1 : 0);
  const ordered = [...entries].sort((a, b) => rang(a) - rang(b));

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
        className="relative w-full max-w-lg bg-white p-4 shadow-2xl sm:p-5"
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <X size={18} />
        </button>
        <h2 className="pr-10 text-lg font-black text-gray-900">
          {titre}
        </h2>
        <p className="mb-3 mt-0.5 pr-10 text-[11px] font-bold uppercase tracking-tight text-gray-400 italic">
          {teamName} · {sousTitre}
        </p>

        <div
              // `vh` designe la hauteur de l'APPAREIL, qui ne tourne pas :
              // couchee, la console fait 393 px de haut quand `vh` en compte
              // 852. Voir ConsoleCouchee et `--console-h`, qui vaut la hauteur
              // reelle de la console — ou celle de la fenetre hors console.
          // UNE GRILLE DE MAILLOTS, et non une liste de fiches. La liste
          // montrait six joueurs sur dix en paysage : pour trouver le 9, il
          // fallait faire défiler pendant que le jeu reprenait. Un numéro et
          // un nom court tiennent dans un quart de largeur — dix joueurs
          // dans trois rangées, sans défiler. Le défilement reste pour un
          // banc très fourni.
          style={{ maxHeight: "calc(var(--console-h, 100dvh) - 11rem)" }}
          className="custom-scrollbar grid grid-cols-3 content-start gap-1.5 overflow-y-auto sm:grid-cols-4"
        >
          {ordered.map((entry) => {
            const remplacant = entry.role !== "starter";
            return (
              <button
                key={entry.playerId}
                disabled={isSubmitting}
                onClick={() => onPick(entry)}
                title={entry.name}
                // Le nom ENTIER pour qui ne voit pas la grille : le nom court
                // est un compromis d'affichage, pas une identité.
                aria-label={`${entry.number ? `${entry.number} ` : ""}${entry.name}`}
                className={`relative flex min-w-0 flex-col items-center gap-0.5 border px-1 py-2 transition-all hover:border-gray-900 active:scale-95 disabled:opacity-50 ${
                  remplacant ? "border-dashed border-gray-300 bg-white" : "border-gray-200/70 bg-gray-50"
                }`}
              >
                <span className="text-lg font-black leading-none tabular-nums text-gray-900">
                  {entry.number || entry.name[0]?.toUpperCase()}
                </span>
                <span className="w-full truncate text-center text-[11px] font-bold text-gray-600">
                  {nomCourt(entry.name)}
                </span>
                {yellowSet.has(entry.playerId) && (
                  <span title="Carton jaune" className="absolute right-1 top-1 h-3 w-2 border border-amber-500/30 bg-amber-400" />
                )}
              </button>
            );
          })}
        </div>

        {ignorer && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onIgnorer ?? onClose}
            className="mt-3 w-full border border-gray-200/70 py-2.5 text-sm font-bold text-gray-400 transition-colors hover:border-gray-200/70 hover:text-gray-600 disabled:opacity-50"
          >
            {ignorer}
          </button>
        )}

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #f1f1f1;
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #e5e5e5;
          }
        `}</style>
      </motion.div>
    </div>
  );
}
