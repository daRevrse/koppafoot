"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, AlertTriangle, ClipboardList, Shirt, Pencil } from "lucide-react";
import { numeroModifiable, numerosEnDouble } from "@/lib/numeros-du-jour";
import type { CompPlayer } from "@/types";
import type { Side, SheetRole } from "./types";

export function LineupBuilder({
  teamName,
  accent,
  roster,
  sheet,
  startersMax,
  ready,
  saving,
  onToggle,
  numeroDe,
  onNumero,
  onValidate,
  depuisLaCompoType,
  onDossards,
  avecGardien,
  gardienId,
  onGardien,
}: {
  side: Side;
  teamName: string;
  accent: "primary" | "amber";
  roster: CompPlayer[];
  sheet: Record<string, SheetRole>;
  /** Titulaires autorisés, le NvN de la compétition. */
  startersMax: number;
  ready: boolean;
  saving: boolean;
  onToggle: (playerId: string) => void;
  /** Le numéro que ce joueur porte sur la feuille de ce match (lib/numeros-du-jour). */
  numeroDe: (p: CompPlayer) => string;
  /** Changer ce numéro pour ce match. Rend `false` quand la saisie est refusée. */
  onNumero: (playerId: string, brut: string) => boolean;
  onValidate: () => void;
  /** La feuille affichee vient de la composition type du club, pas du match. */
  depuisLaCompoType: boolean;
  /**
   * Tirer la feuille de secours au dossard (voir lib/dossards). Absent quand
   * il n'y a plus de numéro libre, ou hors compétition.
   */
  onDossards?: () => void;
  /** La feuille doit désigner un gardien : le match en a, et le camp est sur la plateforme. */
  avecGardien: boolean;
  /** Le titulaire désigné, ou proposé par l'effectif ; `null` sans gardien. */
  gardienId: string | null;
  /** Le 🧤 d'une ligne titulaire : désigner ce joueur, ou retirer la désignation. */
  onGardien: (playerId: string) => void;
}) {
  const accentText = accent === "primary" ? "text-emerald-700" : "text-amber-500";
  const validateCls =
    accent === "primary"
      ? "bg-gray-900 hover:bg-emerald-700"
      : "bg-amber-500 hover:bg-amber-600 shadow-amber-200";

  const starters = roster.filter((p) => sheet[p.id] === "starter").length;
  const subs = roster.filter((p) => sheet[p.id] === "substitute").length;
  // Deux joueurs de la feuille sous le même numéro : signalé, pas bloqué.
  const doubles = numerosEnDouble(roster.filter((p) => (sheet[p.id] ?? "out") !== "out").map(numeroDe));

  return (
    <div className="relative overflow-hidden border border-gray-200/70 bg-white p-4 shadow-gray-200/40 sm:p-7">
      {/* Side label and team name are already in the mobile tab above, so
          they only appear from md up where both sheets show at once. */}
      <div className="mb-1 hidden items-center justify-between md:flex">
        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
          {accent === "primary" ? "Domicile" : "Extérieur"}
        </h3>
        {ready && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-tighter text-emerald-600">
            <CheckCircle2 size={12} /> Validée
          </span>
        )}
      </div>
      <h2 className="mb-1 hidden max-w-full truncate text-lg font-black tracking-tight text-gray-900 md:block">
        {teamName}
      </h2>

      {/* D'OÙ VIENT CE QUI EST DÉJÀ COCHÉ.

          Une feuille pré-remplie sans explication est pire qu'une feuille
          vide : le scoreur la valide en croyant que les managers l'ont faite,
          et onze noms entrent au match sans que personne les ait confirmés ce
          jour-là. La ligne dit donc ce que c'est — la composition habituelle
          du club — et, implicitement, ce qu'il reste à faire : vérifier qui
          est là. */}
      {depuisLaCompoType && (
        <p className="mb-3 flex items-start gap-1.5 border border-sky-200 bg-sky-50/70 px-3 py-2 text-[11px] font-bold leading-snug text-sky-800">
          <ClipboardList size={13} className="mt-px shrink-0 text-sky-500" />
          <span>
            Composition habituelle du club, proposée. Vérifie qui est présent
            avant de valider.
          </span>
        </p>
      )}

      {roster.length === 0 ? (
        <div className="mt-4 border border-dashed border-gray-200/70 px-4 py-8 text-center">
          <p className="text-xs font-bold leading-relaxed text-gray-400">
            Effectif vide : personne n&apos;a saisi les joueurs de cette équipe.
          </p>
          {onDossards && (
            <>
              <button
                type="button"
                onClick={onDossards}
                className="mt-4 inline-flex items-center justify-center gap-2 bg-gray-900 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-black active:scale-95"
              >
                <Shirt size={15} />
                Feuille de secours au dossard
              </button>
              <p className="mx-auto mt-2 max-w-xs text-[11px] font-semibold leading-snug text-gray-400">
                Coche les numéros que tu vois sur les maillots. L&apos;équipe donnera leurs
                noms après le match.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Titulaires{" "}
            <span className={starters > startersMax ? "text-red-500" : accentText}>
              {starters}/{startersMax}
            </span>{" "}
            · <span className={accentText}>{subs}</span> remplaçant{subs > 1 ? "s" : ""}
          </p>
          {/* Le gardien, qu'une feuille ne se valide pas sans (voir lib/gardiens). */}
          {avecGardien && (
            <p className={`-mt-1 mb-3 text-[11px] font-bold ${gardienId ? "text-gray-500" : "text-amber-600"}`}>
              {gardienId
                ? `🧤 Gardien : ${roster.find((p) => p.id === gardienId)?.name ?? ""}`
                : "Touche 🧤 sur un titulaire pour désigner le gardien."}
            </p>
          )}
          <p className="-mt-1 mb-3 text-[11px] font-bold text-gray-400">
            Touche un numéro pour changer le dossard, pour ce match seulement.
          </p>
          {doubles.size > 0 && (
            <p className="-mt-2 mb-3 flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
              <AlertTriangle size={12} className="shrink-0" />
              {[...doubles].map((n) => `n°${n}`).join(", ")} porté{doubles.size > 1 ? "s" : ""} par deux joueurs sur cette feuille.
            </p>
          )}
          {/* The roster is the only thing that scrolls. On mobile it takes
              the viewport minus header, tabs and the pinned kickoff bar. */}
          <div
            style={{ maxHeight: "min(calc(var(--console-h, 100dvh) * 0.5), 320px)" }}
            className="custom-scrollbar mb-4 space-y-2 overflow-y-auto pr-1"
          >
            {roster.map((p) => {
              const role = sheet[p.id] ?? "out";
              const estGardien = avecGardien && gardienId === p.id;
              return (
                // La ligne change le rôle ; le 🧤, À CÔTÉ et non dedans (un
                // bouton n'en contient pas un autre), désigne le gardien.
                <div
                  key={p.id}
                  className={`flex w-full items-stretch border transition-all ${
                    role === "out"
                      ? "border-gray-200/70 bg-gray-50/50 hover:border-gray-200/70"
                      : role === "starter"
                        ? "border-emerald-500/30 bg-emerald-50/60"
                        : "border-sky-500/30 bg-sky-50/60"
                  }`}
                >
                  {/* Le numéro, À CÔTÉ du bouton de rôle et non dedans,
                      comme le 🧤 : le toucher change le dossard du jour. */}
                  <div className="flex shrink-0 items-center py-3 pl-4">
                    <CaseNumero
                      numero={numeroDe(p)}
                      initiale={p.name[0]?.toUpperCase() ?? ""}
                      nom={p.name}
                      modifiable={numeroModifiable(p.id)}
                      modifie={numeroDe(p) !== (p.number ?? "")}
                      enDouble={role !== "out" && doubles.has(numeroDe(p))}
                      onValider={(brut) => onNumero(p.id, brut)}
                    />
                  </div>
                  <button
                    onClick={() => onToggle(p.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 pr-4 text-left active:scale-[0.99]"
                  >
                    <span className="flex-1 truncate text-sm font-bold text-gray-900">{p.name}</span>
                    <RoleBadge role={role} />
                  </button>
                  {avecGardien && role === "starter" && (
                    <button
                      type="button"
                      onClick={() => onGardien(p.id)}
                      aria-label="Désigner gardien"
                      aria-pressed={estGardien}
                      className={`flex w-12 shrink-0 items-center justify-center border-l border-emerald-500/20 text-lg transition-opacity ${
                        estGardien ? "bg-emerald-100 opacity-100" : "opacity-30 hover:opacity-70"
                      }`}
                    >
                      🧤
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {onDossards && (
            <button
              type="button"
              onClick={onDossards}
              className="mb-3 flex w-full items-center justify-center gap-1.5 py-1 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 underline transition-colors hover:text-gray-900"
            >
              <Shirt size={13} />
              Compléter au dossard
            </button>
          )}
          <button
            onClick={onValidate}
            disabled={saving}
            className={`flex w-full items-center justify-center gap-2 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 ${validateCls}`}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : ready ? "Mettre à jour la feuille" : "Valider la feuille"}
          </button>
        </>
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
    </div>
  );
}

/**
 * LA CASE DU NUMÉRO d'une ligne de feuille, qu'on touche pour changer le
 * dossard du jour (lib/numeros-du-jour). Le clavier numérique s'ouvre ; Entrée
 * ou un appui ailleurs valide, Échap annule. Un numéro qui diffère de
 * l'effectif est cerclé d'ambre, un numéro porté deux fois de rouge.
 *
 * Une ligne dont le numéro est l'identité (un dossard de secours, un « Joueur
 * 9 ») le garde : la case n'est alors qu'un affichage, comme avant.
 */
function CaseNumero({
  numero, initiale, nom, modifiable, modifie, enDouble, onValider,
}: {
  numero: string;
  initiale: string;
  nom: string;
  modifiable: boolean;
  modifie: boolean;
  enDouble: boolean;
  onValider: (brut: string) => boolean;
}) {
  const [edition, setEdition] = useState(false);
  const [saisie, setSaisie] = useState(numero);
  const base = "flex h-9 w-9 shrink-0 items-center justify-center bg-white text-sm font-black";

  if (!modifiable) return <span className={`${base} text-gray-900`}>{numero || initiale}</span>;

  if (edition) {
    const valider = () => { if (onValider(saisie)) setEdition(false); };
    return (
      <input
        autoFocus
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        maxLength={2}
        value={saisie}
        onChange={(e) => setSaisie(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={valider}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); valider(); }
          if (e.key === "Escape") setEdition(false);
        }}
        onFocus={(e) => e.target.select()}
        aria-label={`Dossard de ${nom} pour ce match`}
        className={`${base} border-2 border-gray-900 text-center text-gray-900 outline-none`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setSaisie(numero); setEdition(true); }}
      aria-label={`Changer le dossard de ${nom}${numero ? `, n°${numero}` : ""}`}
      title="Changer le dossard pour ce match"
      className={`${base} relative border border-dashed transition-colors hover:border-gray-900 ${
        enDouble
          ? "border-red-400 text-red-600"
          : modifie
            ? "border-amber-400 text-amber-700"
            : "border-gray-300 text-gray-900"
      }`}
    >
      {numero || <span className="text-gray-300">{initiale}</span>}
      <Pencil size={8} aria-hidden className="absolute bottom-0.5 right-0.5 text-gray-300" />
    </button>
  );
}

function RoleBadge({ role }: { role: SheetRole }) {
  if (role === "starter") {
    return (
      <span className="shrink-0 rounded-full bg-emerald-500 px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter text-white">
        Titulaire
      </span>
    );
  }
  if (role === "substitute") {
    return (
      <span className="shrink-0 rounded-full bg-sky-500 px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter text-white">
        Remplaçant
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-gray-200/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter text-gray-400">
      Hors feuille
    </span>
  );
}
