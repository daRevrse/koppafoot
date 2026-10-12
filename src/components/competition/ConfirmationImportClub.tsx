"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Check, Loader2, X } from "lucide-react";
import type { ApercuImport, Correspondances, LigneChiffree } from "@/lib/fusion-import";

// ============================================
// Avant d'importer un club dans une équipe de compétition : qui occupe
// quelle ligne.
//
// L'organisateur avait souvent tapé l'effectif à la main, et ces lignes ont
// joué. Un joueur du club qui arrive comme une ligne de plus laisserait ses
// buts sur l'ancienne. Le manager dit donc, joueur par joueur, s'il reprend
// une ligne déjà là — avec ce qu'elle a joué — ou s'il en ouvre une nouvelle.
//
// LE CODE PROPOSE, LE MANAGER CONFIRME. Le rapprochement par le nom est
// présélectionné, jamais appliqué tout seul : deux « Koffi » dans un club, ça
// existe, et rien n'est écrit avant le bouton du bas. Une ligne ne peut être
// reprise que par un seul joueur, d'où les options qui disparaissent des
// autres listes dès qu'elles sont prises.
//
// UN JOUEUR DÉLIÉ RETROUVE SA LIGNE ICI, et seulement s'il le demande : le
// manager l'a délié exprès, une synchronisation ne le rattache pas d'office.
// Sans ce choix, il ne restait qu'à supprimer la ligne pour la recréer, et
// ce qu'elle avait joué partait avec elle.
// ============================================

const s = (n: number) => (n > 1 ? "s" : "");

const libelle = (l: LigneChiffree) =>
  `« ${l.numero ? `${l.numero}. ` : ""}${l.nom} » (${l.matchs} match${s(l.matchs)}, ${l.buts} but${s(l.buts)})`;

export default function ConfirmationImportClub({
  apercu,
  clubName,
  busy,
  onConfirm,
  onCancel,
}: {
  apercu: ApercuImport;
  clubName: string;
  busy: boolean;
  onConfirm: (correspondances: Correspondances) => void;
  onCancel: () => void;
}) {
  // "" : une nouvelle ligne — ou ne rien changer, pour un doublon ou un délié.
  const [choix, setChoix] = useState<Record<string, string>>(() =>
    Object.fromEntries(apercu.propositions.map((p) => [
      p.cle,
      // Sa ligne déliée se propose sans se présélectionner (voir plus haut).
      p.etat === "delie" ? "" : p.suggestion ?? "",
    ])),
  );

  // Ceux à qui une ligne est proposée d'abord : c'est là qu'il y a à lire.
  const propositions = useMemo(
    () => [...apercu.propositions].sort((a, b) => Number(!!b.suggestion) - Number(!!a.suggestion)),
    [apercu],
  );

  const prises = new Set(Object.values(choix).filter(Boolean));
  const choisis = (etat: "delie" | "autre") =>
    propositions.filter((p) => (p.etat === "delie") === (etat === "delie") && choix[p.cle]).length;
  const reprises = choisis("autre");
  const rattaches = choisis("delie");
  const nouveaux = propositions.filter((p) => p.etat === "nouveau" && !choix[p.cle]).length;

  const confirmer = () =>
    onConfirm(Object.fromEntries(propositions.map((p) => [p.cle, choix[p.cle] || null])));

  return (
    <div className="border border-emerald-200 bg-white">
      <div className="space-y-1 border-b border-emerald-100 bg-emerald-50/60 p-4">
        <p className="text-sm font-black text-emerald-900">Importer {clubName} : qui est qui ?</p>
        {apercu.libres.length > 0 && (
          <p className="text-xs font-semibold leading-relaxed text-emerald-800">
            Des joueurs figurent déjà dans cet effectif, saisis à la main par l&apos;organisateur.
            Un joueur de ton club qui reprend une de ces lignes garde ses matchs, ses buts et ses
            cartons. Sinon, il arrive comme une nouvelle ligne.
          </p>
        )}
        {apercu.deliees.length > 0 && (
          <p className="text-xs font-semibold leading-relaxed text-emerald-800">
            Un joueur dont tu avais délié le compte peut retrouver sa ligne, avec ce qu&apos;elle a
            joué. Rien ne change pour lui si tu ne le demandes pas.
          </p>
        )}
      </div>

      <ul className="divide-y divide-gray-100">
        {propositions.map((p) => {
          const choisie = choix[p.cle] ?? "";
          const sienne = p.etat === "delie" ? apercu.deliees.find((l) => l.id === p.suggestion) : undefined;
          return (
            <li key={p.cle} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900">
                  {p.joueur.nom}
                  {p.joueur.numero && (
                    <span className="ml-2 text-xs tabular-nums text-gray-400">#{p.joueur.numero}</span>
                  )}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] font-black uppercase tracking-wide">
                  {p.joueur.genre === "compte" ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <BadgeCheck size={10} /> Compte KoppaFoot
                    </span>
                  ) : (
                    <span className="text-gray-400">Sans compte</span>
                  )}
                  {p.etat === "doublon" && <span className="text-amber-600">Déjà importé, en double</span>}
                  {p.etat === "delie" && <span className="text-amber-600">Compte délié</span>}
                </p>
              </div>
              <select
                value={choisie}
                onChange={(e) => setChoix((c) => ({ ...c, [p.cle]: e.target.value }))}
                disabled={busy}
                aria-label={`Ligne de ${p.joueur.nom}`}
                className={`w-full border px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none ${
                  choisie ? "border-emerald-300 bg-emerald-50/50 font-bold text-emerald-900" : "border-gray-200/70 text-gray-700"
                }`}
              >
                <option value="">
                  {p.etat === "delie" ? "Laisser délié" : p.etat === "doublon" ? "Laisser les deux lignes" : "Nouvelle ligne"}
                </option>
                {p.etat === "delie"
                  ? sienne && <option value={sienne.id}>Rattacher à nouveau {libelle(sienne)}</option>
                  : apercu.libres
                      .filter((l) => l.id === choisie || !prises.has(l.id))
                      .map((l) => <option key={l.id} value={l.id}>Reprend {libelle(l)}</option>)}
              </select>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 p-4">
        <p className="min-w-0 flex-1 text-xs font-semibold text-gray-500">
          {[
            `${reprises} ligne${s(reprises)} reprise${s(reprises)}`,
            `${nouveaux} nouvelle${s(nouveaux)} ligne${s(nouveaux)}`,
            rattaches > 0 ? `${rattaches} joueur${s(rattaches)} rattaché${s(rattaches)}` : null,
            apercu.aJour > 0 ? `${apercu.aJour} joueur${s(apercu.aJour)} déjà à jour` : null,
          ].filter(Boolean).join(", ")}.
        </p>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          <X size={15} /> Annuler
        </button>
        <button
          type="button"
          onClick={confirmer}
          disabled={busy}
          className="flex items-center gap-2 bg-emerald-500 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Confirmer l&apos;import
        </button>
      </div>
    </div>
  );
}
