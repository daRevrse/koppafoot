"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ============================================
// Le socle visuel du produit.
//
// LA MEME LANGUE POUR TOUTES LES SECTIONS. Ces primitives sont nées dans le
// parcours des terrains, où elles remplaçaient quatre définitions rivales de
// `inputClass` et deux composants de pastilles copiés l'un sur l'autre. Elles
// en sortent parce que l'authentification en avait besoin à son tour : la
// laisser recopier ses propres champs aurait refabriqué, un dossier plus
// loin, exactement le problème qu'on venait de résoudre.
//
// LE PARTI PRIS : le panneau de stade. Capitales serrées de la fonte display,
// filets d'un cheveu, angles francs, et le marquage d'un terrain en filigrane
// sur les surfaces sombres. Rien d'arrondi : un terrain est un rectangle, ses
// lignes sont droites.
//
// LE VOCABULAIRE D'UTILITAIRES EST CONTRAINT. Le thème sombre
// (styles/dark.css) réécrit une liste fermée de classes neutres — bg-white,
// text-gray-500, border-gray-200/70. Une couleur inventée ici, même jolie,
// resterait claire dans le noir.
// ============================================

/**
 * Le marquage d'un terrain, en filigrane.
 *
 * Purement décoratif, et posé UNIQUEMENT sur les surfaces déjà sombres, où
 * le thème sombre ne touche à rien : ce que ces blocs montrent en clair, ils
 * le montrent à l'identique dans le noir.
 */
export function LignesDeTerrain({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 260"
      preserveAspectRatio="xMidYMid slice"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <rect x="8" y="8" width="384" height="244" />
      <line x1="200" y1="8" x2="200" y2="252" />
      <circle cx="200" cy="130" r="46" />
      <circle cx="200" cy="130" r="2.5" fill="currentColor" stroke="none" />
      <rect x="8" y="62" width="62" height="136" />
      <rect x="330" y="62" width="62" height="136" />
      <rect x="8" y="98" width="24" height="64" />
      <rect x="368" y="98" width="24" height="64" />
      <path d="M70 96a46 46 0 0 0 0 68" />
      <path d="M330 96a46 46 0 0 1 0 68" />
    </svg>
  );
}


/** Le fil d'Ariane, identique sur les huit écrans. */
export function FilAriane({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav
      aria-label="Fil d'ariane"
      className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
    >
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-gray-300">›</span>}
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-emerald-700">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-600">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}


/** La petite capitale qui nomme un champ ou une colonne. */
export function Etiquette({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 ${className}`}>
      {children}
    </p>
  );
}

export const classeChamp =
  "w-full border border-gray-200/70 bg-white px-4 py-3 text-sm font-semibold text-gray-900 " +
  "placeholder:font-medium placeholder:text-gray-300 focus:border-gray-900 focus:outline-none transition-colors";

/** Un champ étiqueté, avec sa mention « optionnel » et son erreur éventuelle. */
export function Champ({
  label,
  optionnel,
  aide,
  erreur,
  htmlFor,
  children,
}: {
  label: string;
  optionnel?: boolean;
  aide?: string;
  erreur?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400"
      >
        {label}
        {optionnel && <span className="font-bold normal-case text-gray-300"> (optionnel)</span>}
      </label>
      {children}
      {erreur ? (
        <p role="alert" className="mt-1.5 text-[11px] font-bold text-red-600">
          {erreur}
        </p>
      ) : aide ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">{aide}</p>
      ) : null}
    </div>
  );
}

/** Un choix unique parmi quelques valeurs. */
export function Pastilles({
  options,
  value,
  onChange,
  nom,
}: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  /** Nom du groupe, lu par les lecteurs d'écran. */
  nom: string;
}) {
  return (
    <div role="radiogroup" aria-label={nom} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const actif = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={actif}
            onClick={() => onChange(o.value)}
            className={`border px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
              actif
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}


export type Ton = "attente" | "ok" | "refus" | "neutre";

const TONS: Record<Ton, string> = {
  attente: "border-amber-200 bg-amber-50 text-amber-700",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  refus: "border-red-200 bg-red-50 text-red-700",
  neutre: "border-gray-200/70 bg-gray-50 text-gray-500",
};

/** Le badge d'état : en attente, confirmé, refusé. */
export function Fanion({ ton, children }: { ton: Ton; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${TONS[ton]}`}
    >
      {children}
    </span>
  );
}

type VarianteBouton = "plein" | "contour" | "danger";

const BOUTONS: Record<VarianteBouton, string> = {
  plein: "border border-gray-900 bg-gray-900 text-white hover:border-emerald-700 hover:bg-emerald-700",
  contour: "border border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900",
  danger: "border border-gray-200/70 text-gray-500 hover:border-red-500 hover:text-red-500",
};

/**
 * Le bouton du parcours.
 *
 * Le plein devient vert dans le thème sombre (voir styles/dark.css, qui vise
 * `button.bg-gray-900`), c'est pour ça qu'il reste un `button` et non un
 * `div` cliquable.
 */
export function Bouton({
  variante = "plein",
  Icon,
  occupe,
  petit,
  className = "",
  children,
  ...rest
}: {
  variante?: VarianteBouton;
  Icon?: LucideIcon;
  occupe?: boolean;
  petit?: boolean;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const taille = petit ? "px-4 py-2.5 text-[10px]" : "px-6 py-4 text-[11px]";
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || occupe}
      className={`inline-flex items-center justify-center gap-2 font-black uppercase tracking-[0.15em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${taille} ${BOUTONS[variante]} ${className}`}
    >
      {occupe ? (
        <Loader2 size={petit ? 13 : 15} className="animate-spin" />
      ) : Icon ? (
        <Icon size={petit ? 13 : 15} />
      ) : null}
      {children}
    </button>
  );
}

/** Le même geste, mais qui navigue. */
export function LienBouton({
  href,
  variante = "plein",
  Icon,
  petit,
  className = "",
  children,
}: {
  href: string;
  variante?: VarianteBouton;
  Icon?: LucideIcon;
  petit?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const taille = petit ? "px-4 py-2.5 text-[10px]" : "px-6 py-4 text-[11px]";
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 font-black uppercase tracking-[0.15em] transition-colors ${taille} ${BOUTONS[variante]} ${className}`}
    >
      {Icon && <Icon size={petit ? 13 : 15} />}
      {children}
    </Link>
  );
}

/** Ce qu'on montre quand il n'y a rien à montrer, avec la sortie qui va avec. */
export function EtatVide({
  Icon,
  titre,
  children,
  action,
}: {
  Icon: LucideIcon;
  titre: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200/70 bg-white px-6 py-16 text-center">
      <Icon size={30} className="mx-auto text-gray-300" strokeWidth={1.5} />
      <p className="mt-4 font-display text-lg font-black uppercase tracking-tight text-gray-900">
        {titre}
      </p>
      {children && (
        <div className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">{children}</div>
      )}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Le chargement, partout le même. */
export function EnCours({ hauteur = "py-16" }: { hauteur?: string }) {
  return (
    <div className={`flex justify-center ${hauteur}`}>
      <Loader2 className="h-7 w-7 animate-spin text-gray-300" aria-label="Chargement" />
    </div>
  );
}


// ============================================
// La confirmation
//
// window.confirm() était le seul endroit du parcours à sortir du produit :
// une boîte grise du navigateur, en anglais sur certains systèmes, qui ne
// sait pas dire lequel des deux gestes est le dangereux et qu'aucun thème ne
// touche. Elle bloque aussi le fil d'exécution, ce qui interdit d'afficher
// quoi que ce soit pendant la suppression.
//
// L'API reste celle qu'on remplace — `await demander(...)` rend un booléen —
// pour que les appels gardent leur forme.
// ============================================

export interface DemandeConfirmation {
  titre: string;
  corps?: React.ReactNode;
  /** Le libellé du bouton qui engage. « Retirer », « Annuler la demande ». */
  action: string;
  /** Rouge quand le geste est irréversible. */
  danger?: boolean;
}

export function useConfirmation() {
  const [demande, setDemande] = useState<DemandeConfirmation | null>(null);
  const resolveur = useRef<((ok: boolean) => void) | null>(null);
  const boutonRef = useRef<HTMLButtonElement>(null);
  const declencheur = useRef<Element | null>(null);

  const demander = useCallback((d: DemandeConfirmation) => {
    declencheur.current = document.activeElement;
    setDemande(d);
    return new Promise<boolean>((resolve) => {
      resolveur.current = resolve;
    });
  }, []);

  const repondre = useCallback((ok: boolean) => {
    resolveur.current?.(ok);
    resolveur.current = null;
    setDemande(null);
    // Rendre le focus d'où il venait : sans ça, fermer la boîte renvoie le
    // curseur en haut de page et la navigation au clavier repart de zéro.
    if (declencheur.current instanceof HTMLElement) declencheur.current.focus();
  }, []);

  useEffect(() => {
    if (!demande) return;
    boutonRef.current?.focus();
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") repondre(false);
    };
    document.addEventListener("keydown", auClavier);
    // La page derrière ne défile pas pendant qu'une question est posée.
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", auClavier);
      document.body.style.overflow = avant;
    };
  }, [demande, repondre]);

  const Dialogue = useCallback(() => {
    if (!demande) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => repondre(false)}
          className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px]"
        />
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirmation-titre"
          className="relative w-full max-w-md border border-gray-200/70 bg-white p-6 sm:p-8"
        >
          <h2
            id="confirmation-titre"
            className="font-display text-xl font-black uppercase leading-tight tracking-tight text-gray-900"
          >
            {demande.titre}
          </h2>
          {demande.corps && (
            <div className="mt-3 text-sm leading-relaxed text-gray-500">{demande.corps}</div>
          )}
          <div className="mt-7 flex flex-wrap gap-2">
            <button
              ref={boutonRef}
              type="button"
              onClick={() => repondre(true)}
              className={`inline-flex items-center justify-center gap-2 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                demande.danger
                  ? "border border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700"
                  : BOUTONS.plein
              }`}
            >
              {demande.action}
            </button>
            <button
              type="button"
              onClick={() => repondre(false)}
              className={`inline-flex items-center justify-center gap-2 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${BOUTONS.contour}`}
            >
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }, [demande, repondre]);

  return { demander, Dialogue };
}
