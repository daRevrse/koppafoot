"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Bouton, Champ, classeChamp } from "@/components/ui/socle";
import { cleDuJour, decalerDeJours } from "@/lib/dates";
import {
  AIDE_CONDITION, LIBELLE_CONDITION, NOTE_CONDITION_MAX, STATUTS_CONDITION,
  type ConditionJoueur, type StatutCondition,
} from "@/lib/etat-de-forme";
import { ICONE_CONDITION } from "./badges";

// ============================================
// Déclarer une condition : le joueur pour lui-même, le manager pour un joueur
// sans compte. Voir lib/etat-de-forme.
//
// LA DATE DE RETOUR EST CE QUI REND LA DÉCLARATION HONNÊTE DANS LA DURÉE. Le
// jour venu, la pastille s'efface d'elle-même — le joueur n'a pas à penser à
// revenir dire qu'il est guéri. Elle est facultative : on ne sait pas
// toujours, et une date inventée serait pire qu'aucune.
// ============================================

export interface ConditionSaisie {
  statut: StatutCondition;
  retourPrevu: string | null;
  note: string | null;
}

export default function EditeurCondition({
  initiale,
  onEnregistrer,
  onAnnuler,
  aide,
  pourUnAutre = false,
}: {
  initiale: ConditionJoueur | null | undefined;
  onEnregistrer: (c: ConditionSaisie) => Promise<void>;
  onAnnuler?: () => void;
  /** Une ligne sous le formulaire : qui la verra. */
  aide?: string;
  /** Le manager qui déclare pour un joueur sans compte : on ne le tutoie pas à sa place. */
  pourUnAutre?: boolean;
}) {
  const [statut, setStatut] = useState<StatutCondition>(initiale?.statut ?? "apte");
  const [retour, setRetour] = useState(initiale?.retourPrevu ?? "");
  const [note, setNote] = useState(initiale?.note ?? "");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const demain = decalerDeJours(cleDuJour(new Date()), 1);
  const apte = statut === "apte";

  const enregistrer = async () => {
    // Une date déjà passée effacerait la déclaration à l'instant où on la fait.
    if (!apte && retour && retour < demain) {
      setErreur("Le retour se prévoit à partir de demain.");
      return;
    }
    setErreur(null);
    setEnCours(true);
    try {
      await onEnregistrer({
        statut,
        retourPrevu: apte ? null : retour || null,
        note: note.trim() || null,
      });
    } catch {
      setErreur("Enregistrement impossible. Réessaie dans un instant.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Condition" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {STATUTS_CONDITION.map((s) => {
          const actif = statut === s;
          const Icon = ICONE_CONDITION[s];
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={actif}
              onClick={() => setStatut(s)}
              className={`flex items-center gap-3 border px-3 py-2.5 text-left transition-colors ${
                actif
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200/70 bg-white text-gray-600 hover:border-gray-900"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="min-w-0">
                <span className="block text-[11px] font-black uppercase tracking-[0.12em]">
                  {LIBELLE_CONDITION[s]}
                </span>
                <span className={`block truncate text-[11px] font-semibold ${actif ? "text-white/70" : "text-gray-400"}`}>
                  {AIDE_CONDITION[s]}
                </span>
              </span>
              {actif && <Check size={14} className="ml-auto shrink-0" />}
            </button>
          );
        })}
      </div>

      {!apte && (
        <Champ
          label="Retour prévu"
          optionnel
          htmlFor="condition-retour"
          aide={pourUnAutre
            ? "Ce jour-là, la déclaration s'efface d'elle-même."
            : "Ce jour-là, la déclaration s'efface d'elle-même : pas besoin de revenir dire que tu es rétabli."}
        >
          <input
            id="condition-retour"
            type="date"
            min={demain}
            value={retour}
            onChange={(e) => setRetour(e.target.value)}
            className={classeChamp}
          />
        </Champ>
      )}

      <Champ label={pourUnAutre ? "Un mot" : "Un mot pour le manager"} optionnel htmlFor="condition-note">
        <input
          id="condition-note"
          type="text"
          maxLength={NOTE_CONDITION_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={apte ? "Ex. : dispo tout le mois" : "Ex. : entorse de la cheville"}
          className={classeChamp}
        />
      </Champ>

      {erreur && <p role="alert" className="text-[11px] font-bold text-red-600">{erreur}</p>}
      {aide && <p className="text-[11px] leading-relaxed text-gray-400">{aide}</p>}

      <div className="flex flex-wrap gap-2">
        <Bouton petit occupe={enCours} Icon={Check} onClick={enregistrer}>
          Enregistrer
        </Bouton>
        {onAnnuler && (
          <Bouton petit variante="contour" onClick={onAnnuler} disabled={enCours}>
            Annuler
          </Bouton>
        )}
      </div>
    </div>
  );
}
