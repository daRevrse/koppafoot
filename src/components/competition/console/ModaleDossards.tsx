"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, X, Shirt } from "lucide-react";
import { lireNumero, numeroModifiable, numerosDeLaFeuille, numerosEnDouble } from "@/lib/numeros-du-jour";
import type { LineupEntry } from "@/types";
import type { Side } from "./types";

/**
 * LES DOSSARDS DU JOUR, PENDANT LE DIRECT (lib/numeros-du-jour).
 *
 * Les deux feuilles telles qu'elles se jouent, titulaires puis remplaçants,
 * chaque numéro modifiable. Rien ne part avant « Enregistrer », et seuls les
 * camps qui changent s'écrivent. Le terrain, le choix du buteur et la fiche
 * publique du match lisent tous la feuille : ils suivent d'eux-mêmes.
 */
export function ModaleDossards({
  homeTeamName, awayTeamName, homeLineup, awayLineup, onFermer, onEnregistrer,
}: {
  homeTeamName: string;
  awayTeamName: string;
  homeLineup: LineupEntry[];
  awayLineup: LineupEntry[];
  onFermer: () => void;
  onEnregistrer: (numeros: { home: Record<string, string>; away: Record<string, string> }) => void;
}) {
  // Sur un écran étroit, une équipe à la fois ; sur la console couchée, les
  // deux côte à côte, comme sur le terrain.
  const [cote, setCote] = useState<Side>("home");
  const [brouillon, setBrouillon] = useState(() => ({
    home: numerosDeLaFeuille(homeLineup),
    away: numerosDeLaFeuille(awayLineup),
  }));
  const camps = [
    { side: "home" as Side, nom: homeTeamName, feuille: homeLineup },
    { side: "away" as Side, nom: awayTeamName, feuille: awayLineup },
  ];

  return (
    <div className="fixed inset-0 modal-layer flex items-center justify-center p-3">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFermer}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-dossards"
        style={{ maxHeight: "calc(var(--console-h, 100dvh) * 0.94)" }}
        className="relative flex w-full max-w-md flex-col bg-white p-4 shadow-2xl sm:max-w-2xl sm:p-5"
      >
        <div className="mb-3 flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-gray-900 text-white">
            <Shirt size={16} />
          </div>
          <h2 id="titre-dossards" className="min-w-0 flex-1 truncate text-base font-black text-gray-900">
            Dossards{" "}
            <span className="text-[11px] font-bold uppercase tracking-tight text-gray-400 italic">
              · pour ce match seulement
            </span>
          </h2>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="shrink-0 text-gray-300 hover:text-gray-900">
            <X size={20} />
          </button>
        </div>

        <div className="mb-3 flex shrink-0 gap-1 bg-gray-100 p-1 sm:hidden">
          {camps.map((c) => (
            <button
              key={c.side}
              type="button"
              onClick={() => setCote(c.side)}
              aria-pressed={cote === c.side}
              className={`min-w-0 flex-1 truncate px-2 py-2 text-xs font-black transition-colors ${
                cote === c.side ? "bg-gray-900 text-white" : "text-gray-500"
              }`}
            >
              {c.nom}
            </button>
          ))}
        </div>

        <div className="-mx-1 grid min-h-0 flex-1 content-start gap-x-5 overflow-y-auto px-1 sm:grid-cols-2">
          {camps.map(({ side, nom, feuille }) => {
            const numeros = brouillon[side];
            const valeurDe = (e: LineupEntry) => numeros[e.playerId] ?? e.number ?? "";
            const doubles = numerosEnDouble(feuille.map(valeurDe));
            const groupes = [
              { titre: "Titulaires", lignes: feuille.filter((e) => e.role === "starter") },
              { titre: "Remplaçants", lignes: feuille.filter((e) => e.role === "substitute") },
            ].filter((g) => g.lignes.length > 0);
            return (
              <section key={side} aria-label={nom} className={cote === side ? "" : "hidden sm:block"}>
                <h3 className="mb-2 hidden truncate text-sm font-black text-gray-900 sm:block">{nom}</h3>
                {doubles.size > 0 && (
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
                    <AlertTriangle size={12} className="shrink-0" />
                    {[...doubles].map((n) => `n°${n}`).join(", ")} porté{doubles.size > 1 ? "s" : ""} par deux joueurs.
                  </p>
                )}
                {feuille.length === 0 ? (
                  <p className="py-4 text-sm font-semibold text-gray-400">Pas de feuille pour cette équipe.</p>
                ) : (
                  groupes.map((g) => (
                    <div key={g.titre} className="mb-3">
                      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{g.titre}</p>
                      <div className="space-y-1">
                        {g.lignes.map((e) => {
                          const valeur = valeurDe(e);
                          const id = `dossard-${side}-${e.playerId}`;
                          return (
                            <label key={e.playerId} htmlFor={id} className="flex items-center gap-3 border border-gray-200/70 px-2.5 py-1.5">
                              <input
                                id={id}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={2}
                                disabled={!numeroModifiable(e.playerId)}
                                value={valeur}
                                onChange={(ev) => {
                                  const n = ev.target.value.replace(/\D/g, "").slice(0, 2);
                                  setBrouillon((b) => ({ ...b, [side]: { ...b[side], [e.playerId]: n } }));
                                }}
                                onFocus={(ev) => ev.target.select()}
                                aria-label={`Dossard de ${e.name}`}
                                className={`h-9 w-11 shrink-0 border text-center text-sm font-black outline-none focus:border-gray-900 disabled:bg-gray-50 disabled:text-gray-400 ${
                                  doubles.has(valeur)
                                    ? "border-red-400 text-red-600"
                                    : valeur !== (e.number ?? "")
                                      ? "border-amber-400 text-amber-700"
                                      : "border-gray-200 text-gray-900"
                                }`}
                              />
                              <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">{e.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </section>
            );
          })}
        </div>

        <div className="mt-3 flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onFermer}
            className="flex-1 border border-gray-200/70 px-4 py-2.5 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              // Une case vidée retire le numéro ; « 07 » devient « 7 ».
              const relu = (m: Record<string, string>) =>
                Object.fromEntries(Object.entries(m).map(([k, v]) => [k, lireNumero(v) ?? v]));
              onEnregistrer({ home: relu(brouillon.home), away: relu(brouillon.away) });
            }}
            className="flex-1 bg-gray-900 px-4 py-2.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-black"
          >
            Enregistrer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
