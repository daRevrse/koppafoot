"use client";

import type { ReactNode } from "react";

// ============================================
// Une répartition en segments, dont LA LARGEUR EST LA PART.
//
// La barre est son propre graphique : pas de jauge sous les chiffres, pas de
// légende. Chaque segment porte une petite ligne — ce qu'il désigne — et un
// grand chiffre. L'issue dominante est remplie en vert.
//
// Deux usages : le pronostic, où le grand chiffre est le pourcentage, et le
// face-à-face, où c'est le nombre de rencontres.
//
// UN PLANCHER DE LARGEUR. Une issue à 2 % ferait sept pixels sur un
// téléphone, et son étiquette n'y tiendrait pas : chaque segment garde de
// quoi se lire, les autres se partagent le reste au prorata. La largeur est
// donc proportionnelle au-dessus du plancher, pas en dessous — le chiffre,
// lui, reste exact.
// ============================================

export interface SegmentRepartition {
  cle: string;
  /** La part, en pour cent. Elle décide de la largeur. */
  pct: number;
  /** La petite ligne : ce que le segment désigne. */
  haut: ReactNode;
  /** Le grand chiffre. */
  bas: ReactNode;
  /** Ce qu'un lecteur d'écran annonce pour ce segment. */
  libelle: string;
}

export default function BarreRepartition({
  segments, libelle, enAvant = null, choisi = null, onChoisir, occupe = false, largeursEgales = false,
}: {
  segments: SegmentRepartition[];
  /** Ce que la barre représente, pour un lecteur d'écran. */
  libelle: string;
  /** Le segment rempli en vert. `null` quand aucune issue ne domine. */
  enAvant?: string | null;
  /** Le choix de celui qui regarde, s'il en a fait un. */
  choisi?: string | null;
  /** Rend chaque segment cliquable. Sans lui, la barre ne fait que montrer. */
  onChoisir?: (cle: string) => void;
  occupe?: boolean;
  /**
   * Des segments égaux, quelle que soit la part : tant qu'aucun chiffre n'est
   * publié, une largeur au prorata serait aussi inventée que le chiffre.
   */
  largeursEgales?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={libelle}
      className="flex divide-x divide-gray-200/70 overflow-hidden border border-gray-200/70"
    >
      {segments.map((s) => {
        const vert = enAvant === s.cle;
        const classes = `flex min-w-[4.75rem] flex-col justify-between gap-3 px-3 py-2.5 text-left transition-[flex-grow,background-color] duration-500 ${
          vert ? "bg-emerald-500 text-gray-950" : "bg-white text-gray-900"
        }`;
        // `flex-basis: 0` : chaque segment part de rien et reçoit sa part de
        // la largeur, plancher déduit. Une part nulle garde le plancher.
        const style = { flexGrow: largeursEgales ? 1 : Math.max(s.pct, 0), flexBasis: 0 };
        // Un bouton se nomme par son aria-label ; un segment qui ne fait que
        // montrer porte son libellé en texte masqué, et cache le reste.
        const contenu = (cache: boolean) => (
          <>
            <span aria-hidden={cache} className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold leading-none">
              {s.haut}
            </span>
            <span
              aria-hidden={cache}
              className="flex h-6 items-end font-display text-lg font-black leading-none tabular-nums sm:text-xl"
            >
              {s.bas}
            </span>
          </>
        );

        if (onChoisir) {
          return (
            <button
              key={s.cle}
              type="button"
              onClick={() => onChoisir(s.cle)}
              disabled={occupe}
              aria-pressed={choisi === s.cle}
              aria-label={s.libelle}
              style={style}
              className={`${classes} ${vert ? "hover:bg-emerald-400" : "hover:bg-gray-50"} disabled:cursor-wait`}
            >
              {contenu(false)}
            </button>
          );
        }
        return (
          <div key={s.cle} style={style} className={classes}>
            <span className="sr-only">{s.libelle}</span>
            {contenu(true)}
          </div>
        );
      })}
    </div>
  );
}
