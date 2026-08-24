"use client";

import { useState } from "react";
import { Pencil, Trash2, Loader2, AlertTriangle, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  modifierEnregistrement, supprimerEnregistrement,
  ObstaclesError, type RessourceAdmin,
} from "@/lib/admin-records";

// ============================================
// Corriger ou effacer un enregistrement, depuis l'administration.
//
// UN SEUL COMPOSANT POUR LES TROIS ÉCRANS. Équipes, comptes et matchs ne
// diffèrent que par la liste de champs qu'on leur passe : trois formulaires
// jumeaux auraient divergé au premier champ ajouté, et c'est le genre de
// divergence qu'on ne remarque que le jour où l'un des trois efface mal.
//
// LE MOT À TAPER n'est pas une politesse. Ces suppressions sont définitives et
// se font sur les données de QUELQU'UN D'AUTRE : la confirmation à un clic
// n'existe pas ici. C'est la même règle que pour la suppression de son propre
// compte, pour la même raison.
//
// LES OBSTACLES S'AFFICHENT AVANT DE POUVOIR PASSER OUTRE. Un compte qui gère
// une équipe laisse, une fois effacé, une équipe sans manager. On peut vouloir
// le faire quand même — un compte de test n'a personne à qui confier son
// équipe — mais en le sachant, pas par surprise.
// ============================================

export interface ChampAdmin {
  cle: string;
  label: string;
  type?: "texte" | "nombre" | "liste" | "booleen";
  options?: { valeur: string; label: string }[];
}

export default function RecordActions({
  resource, id, label, champs, valeurs, onDone,
}: {
  resource: RessourceAdmin;
  id: string;
  /** Ce qu'on montre dans la confirmation : le nom de l'équipe, du compte… */
  label: string;
  champs: ChampAdmin[];
  valeurs: Record<string, unknown>;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"ferme" | "edition" | "suppression">("ferme");
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [mot, setMot] = useState("");
  const [obstacles, setObstacles] = useState<string[]>([]);
  const [occupe, setOccupe] = useState(false);

  const ouvrirEdition = () => {
    setForm(Object.fromEntries(champs.map((c) => [c.cle, valeurs[c.cle] ?? ""])));
    setMode("edition");
  };

  const fermer = () => {
    setMode("ferme");
    setMot("");
    setObstacles([]);
  };

  const enregistrer = async () => {
    setOccupe(true);
    try {
      await modifierEnregistrement(resource, id, form);
      toast.success("Enregistré");
      fermer();
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setOccupe(false);
    }
  };

  const supprimer = async (force: boolean) => {
    setOccupe(true);
    try {
      await supprimerEnregistrement(resource, id, force);
      toast.success("Supprimé");
      fermer();
      onDone();
    } catch (e) {
      if (e instanceof ObstaclesError) {
        setObstacles(e.obstacles);
      } else {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    } finally {
      setOccupe(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={ouvrirEdition}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label={`Modifier ${label}`}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={() => setMode("suppression")}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
          aria-label={`Supprimer ${label}`}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {mode !== "ferme" && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-gray-900">
                {mode === "edition" ? "Modifier" : "Supprimer"} — {label}
              </h3>
              <button onClick={fermer} className="text-gray-300 hover:text-gray-600" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            {mode === "edition" ? (
              <>
                <div className="space-y-3">
                  {champs.map((c) => (
                    <div key={c.cle}>
                      <label className="mb-1 block text-xs font-semibold text-gray-500">{c.label}</label>
                      {c.type === "liste" ? (
                        <select
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                          value={String(form[c.cle] ?? "")}
                          onChange={(e) => setForm({ ...form, [c.cle]: e.target.value })}
                        >
                          {(c.options ?? []).map((o) => (
                            <option key={o.valeur} value={o.valeur}>{o.label}</option>
                          ))}
                        </select>
                      ) : c.type === "booleen" ? (
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={!!form[c.cle]}
                            onChange={(e) => setForm({ ...form, [c.cle]: e.target.checked })}
                          />
                          {c.label}
                        </label>
                      ) : (
                        <input
                          type={c.type === "nombre" ? "number" : "text"}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                          value={String(form[c.cle] ?? "")}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              [c.cle]: c.type === "nombre" ? Number(e.target.value) : e.target.value,
                            })
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={enregistrer}
                  disabled={occupe}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {occupe && <Loader2 size={14} className="animate-spin" />}
                  Enregistrer
                </button>
              </>
            ) : (
              <>
                <div className="flex gap-3 rounded-lg bg-red-50 p-3">
                  <AlertTriangle size={18} className="shrink-0 text-red-500" />
                  <p className="text-xs leading-relaxed text-red-800">
                    Définitif. Ce qui décrit cet enregistrement disparaît ; les feuilles
                    de match déjà jouées, elles, restent — elles racontent ce qui s&apos;est
                    passé, y compris pour les autres.
                  </p>
                </div>

                {obstacles.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-bold text-amber-900">
                      Ce compte tient encore quelque chose :
                    </p>
                    <ul className="list-disc space-y-1 pl-4 text-xs text-amber-800">
                      {obstacles.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                    <button
                      onClick={() => supprimer(true)}
                      disabled={occupe}
                      className="mt-1 text-[11px] font-black uppercase tracking-widest text-amber-900 underline disabled:opacity-50"
                    >
                      Supprimer quand même
                    </button>
                  </div>
                )}

                <label className="mt-4 block text-xs font-semibold text-gray-500">
                  Tapez SUPPRIMER pour confirmer
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  value={mot}
                  onChange={(e) => setMot(e.target.value)}
                  placeholder="SUPPRIMER"
                />
                <button
                  onClick={() => supprimer(false)}
                  disabled={occupe || mot.trim().toUpperCase() !== "SUPPRIMER"}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  {occupe ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Supprimer définitivement
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
