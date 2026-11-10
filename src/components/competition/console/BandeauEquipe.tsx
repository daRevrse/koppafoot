"use client";

import { EMOJI_EVENEMENT, EVENEMENTS_EQUIPE, LIBELLE_EVENEMENT, type TypeEvenementEquipe } from "@/lib/evenements";

/**
 * Ce qui n'appartient a personne : corner, coup franc, touche, penalty.
 *
 * Il porte sur le camp REGARDE, celui dont le terrain est affiche — pas de
 * selecteur a lui. Un selecteur de plus obligerait a choisir deux fois pour un
 * corner, alors que le scoreur vient justement de basculer sur le camp qui
 * attaque.
 */
/**
 * Les quatre actions qui n'appartiennent a personne, pour UN camp.
 *
 * ELLE A PERDU SON EN-TETE « Pour <equipe> ». Il existait parce que la barre
 * servait le camp affiche par l'onglet, et qu'il fallait donc dire lequel.
 * Couchee, la console en rend une PAR CAMP, sous le nom de son equipe : le
 * repeter serait l'ecrire deux fois a trente pixels d'intervalle.
 *
 * Ce que l'en-tete portait aussi, et qu'on garde : la raison du verrou apres
 * un but. Elle passe sur les boutons eux-memes, qui sont ce qu'elle concerne.
 */
export function BandeauEquipe({
  isSubmitting, desactive, onEvenement,
}: {
  isSubmitting: boolean;
  /** La raison du verrou, ou `null`. Voir `SECONDES_JEU_MORT`. */
  desactive: string | null;
  onEvenement: (type: TypeEvenementEquipe) => void;
}) {
  return (
    <div className="relative grid grid-cols-4 border-b border-white/10">
      {EVENEMENTS_EQUIPE.map((type) => (
        <button
          key={type}
          type="button"
          // Les quatre sont des actions de jeu : après un but, aucune ne peut
          // se produire tant que le ballon n'est pas revenu au rond central.
          disabled={isSubmitting || !!desactive}
          onClick={() => onEvenement(type)}
          className="flex min-h-[30px] items-center justify-center gap-1 border-r border-white/[0.07] px-1 py-1 text-white/70 transition-colors last:border-r-0 hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-30"
        >
          <span aria-hidden className="shrink-0 text-[11px] leading-none">{EMOJI_EVENEMENT[type]}</span>
          <span className="min-w-0 truncate text-[8px] font-black uppercase tracking-tight">
            {/* « Penalty obtenu » ne tient pas dans un quart d'ecran. */}
            {type === "penalty" ? "Penalty" : LIBELLE_EVENEMENT[type]}
          </span>
        </button>
      ))}
      {desactive && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0b1512]/75 text-[9px] font-black uppercase tracking-wider text-amber-400">
          {desactive}
        </span>
      )}
    </div>
  );
}
