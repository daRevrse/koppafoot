"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, Loader2, MoreHorizontal, Search, X } from "lucide-react";

// ============================================
// Les briques des écrans de l'administration.
//
// L'administration avait sa propre allure — cartes arrondies, ombres, dégradés
// bleus, animations d'entrée — et chaque page la déclinait à sa façon : trois
// styles de candidatures pour trois pages sœurs. On quittait le produit en y
// entrant. Elle en prend ici le vocabulaire : noir et blanc, angles nets,
// étiquettes en capitales, l'émeraude pour ce qui va bien.
//
// Tout ce qui se répète vit ici, pour que la prochaine page ne réinvente pas
// sa version d'un en-tête ou d'un filtre.
// ============================================

export function EnTete({ titre, sousTitre, actions }: {
  titre: string;
  sousTitre?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-black uppercase leading-none tracking-tight text-gray-900 sm:text-3xl">
          {titre}
        </h1>
        {sousTitre && <p className="mt-1.5 text-sm text-gray-500">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Le titre d'une partie de page, en petites capitales, avec son compte. */
export function Titre({ children, compte, action }: {
  children: React.ReactNode;
  compte?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="flex items-baseline gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-gray-500">
        {children}
        {compte !== undefined && <span className="tabular-nums text-gray-300">{compte}</span>}
      </h2>
      {action}
    </div>
  );
}

export function Carte({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`border border-gray-200/70 bg-white ${className}`}>{children}</div>;
}

const TONS = {
  gris: "bg-gray-100 text-gray-600",
  vert: "bg-emerald-50 text-emerald-700",
  ambre: "bg-amber-50 text-amber-700",
  rouge: "bg-red-50 text-red-700",
  bleu: "bg-blue-50 text-blue-700",
  noir: "bg-gray-900 text-white",
} as const;
export type Ton = keyof typeof TONS;

export function Pastille({ ton = "gris", children, title }: { ton?: Ton; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${TONS[ton]}`}
    >
      {children}
    </span>
  );
}

/** Un chiffre et ce qu'il compte ; un lien quand il mène à la liste qui le détaille. */
export function Chiffre({ valeur, libelle, detail, href, ton = "text-gray-900" }: {
  valeur: number | string;
  libelle: string;
  detail?: React.ReactNode;
  href?: string;
  ton?: string;
}) {
  const contenu = (
    <>
      <p className={`font-display text-3xl font-black leading-none tabular-nums ${ton}`}>{valeur}</p>
      <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">{libelle}</p>
      {detail && <p className="mt-1 text-xs font-semibold text-gray-500">{detail}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block bg-white p-4 transition-colors hover:bg-gray-50">{contenu}</Link>
  ) : (
    <div className="bg-white p-4">{contenu}</div>
  );
}

/** Des onglets de filtre, soulignés comme ceux des fiches du produit. */
export function Filtres<T extends string>({ options, valeur, onChange }: {
  options: { valeur: T; label: string; compte?: number }[];
  valeur: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto border-b border-gray-200/70 px-1">
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <button
            key={o.valeur}
            type="button"
            role="tab"
            aria-selected={actif}
            onClick={() => onChange(o.valeur)}
            className={`-mb-px flex shrink-0 items-baseline gap-1.5 border-b-2 px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] transition-colors ${
              actif ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {o.label}
            {o.compte !== undefined && (
              <span className={`tabular-nums ${actif ? "text-gray-500" : "text-gray-300"}`}>{o.compte}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Recherche({ valeur, onChange, placeholder }: {
  valeur: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    // Assez large pour qu'on lise ce qu'on tape : sur téléphone, elle passe
    // seule sur sa ligne plutôt que de s'écraser contre un sélecteur.
    <label className="relative block min-w-60 flex-1">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200/70 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-900"
      />
    </label>
  );
}

export function Selecteur<T extends string>({ valeur, onChange, options, label }: {
  valeur: T;
  onChange: (v: T) => void;
  options: { valeur: T; label: string }[];
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={valeur}
      onChange={(e) => onChange(e.target.value as T)}
      className="border border-gray-200/70 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-gray-900"
    >
      {options.map((o) => <option key={o.valeur} value={o.valeur}>{o.label}</option>)}
    </select>
  );
}

export function Chargement() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 size={24} className="animate-spin text-gray-300" />
    </div>
  );
}

export function Vide({ titre, texte }: { titre: string; texte?: string }) {
  return (
    <div className="border border-dashed border-gray-200/70 bg-white px-6 py-12 text-center">
      <p className="text-sm font-black text-gray-700">{titre}</p>
      {texte && <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">{texte}</p>}
    </div>
  );
}

export function Erreur({ message, onReessayer }: { message: string; onReessayer?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertTriangle size={16} className="shrink-0" />
      <span className="min-w-0 flex-1 font-semibold">{message}</span>
      {onReessayer && (
        <button onClick={onReessayer} className="text-[11px] font-black uppercase tracking-widest underline">
          Réessayer
        </button>
      )}
    </div>
  );
}

/** Une ligne de liste qui mène quelque part : la flèche dit qu'on peut l'ouvrir. */
export function LigneLien({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50">
      <div className="min-w-0 flex-1">{children}</div>
      <ChevronRight size={15} className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export const BOUTON =
  "inline-flex items-center justify-center gap-2 border px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition-colors disabled:opacity-50";
export const BOUTON_PLEIN = `${BOUTON} border-gray-900 bg-gray-900 text-white hover:bg-gray-700`;
export const BOUTON_VERT = `${BOUTON} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`;
export const BOUTON_CONTOUR = `${BOUTON} border-gray-200/70 bg-white text-gray-700 hover:border-gray-900`;
export const BOUTON_DANGER = `${BOUTON} border-red-200 bg-white text-red-600 hover:border-red-600`;

/**
 * Le menu « … » d'une ligne : les gestes rares et ceux qui détruisent.
 *
 * « Désactiver » était un bouton rouge plein sur CHAQUE ligne des comptes,
 * l'action la plus visible de la page. Un geste qui écarte quelqu'un de la
 * plateforme se cherche, il ne s'offre pas au premier clic égaré.
 */
export function MenuActions({ actions, label = "Plus d'actions" }: {
  actions: { label: string; onClick: () => void; danger?: boolean; icone?: React.ReactNode }[];
  label?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [ouvert]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        className="flex h-8 w-8 items-center justify-center text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <MoreHorizontal size={16} />
      </button>
      {ouvert && (
        <div className="absolute right-0 top-9 z-30 min-w-48 border border-gray-200/70 bg-white py-1 shadow-lg">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => { setOuvert(false); a.onClick(); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-gray-50 ${
                a.danger ? "text-red-600" : "text-gray-700"
              }`}
            >
              {a.icone}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Une fenêtre par-dessus la page, pour les gestes qui demandent qu'on s'arrête. */
export function Modale({ titre, onFermer, children, largeur = "max-w-md" }: {
  titre: string;
  onFermer: () => void;
  children: React.ReactNode;
  largeur?: string;
}) {
  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") onFermer(); };
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [onFermer]);
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onFermer}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full ${largeur} overflow-y-auto bg-white p-5 shadow-xl`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-black uppercase leading-tight tracking-tight text-gray-900">{titre}</h3>
          <button onClick={onFermer} className="text-gray-300 hover:text-gray-700" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** « il y a 3 j », ou la date au-delà d'un mois. */
export function ilYA(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 30 * 86400) return `il y a ${Math.floor(s / 86400)} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** La date d'un match, en toutes lettres : « sam. 20 sept. » plutôt que « 2026-09-20 ». */
export function dateDeMatch(date: string | null, heure?: string | null): string {
  if (!date) return "Date à fixer";
  const d = new Date(`${date}T00:00:00`);
  const jour = Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return heure ? `${jour} · ${heure}` : jour;
}
