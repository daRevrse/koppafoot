"use client";

// ============================================
// La barre d'onglets d'une fiche match, partagée par les deux pages.
//
// Le motif visuel est celui que la page compétition avait déjà — un soulignage
// sous l'onglet actif, la rangée défile horizontalement quand il y a plus
// d'onglets que de largeur. Rien n'est redessiné ici, on répare la composition.
//
// CE QUI ÉTAIT CASSÉ, SUR LA FICHE AMICALE :
//
// 1. Les libellés étaient masqués en dessous de `sm` (`hidden sm:block`). Sur
//    un téléphone — le seul écran qui compte pour la plupart des gens ici — on
//    ne voyait que trois icônes grises sans un mot. Une icône seule ne nomme
//    pas un onglet, elle le devine.
//
//    L'ICÔNE A FINI PAR PARTIR TOUT À FAIT. Une fois le libellé rétabli, elle
//    ne disait plus rien qu'il ne disait déjà — « Résumé » à côté d'une
//    horloge, « Classement » à côté d'une liste — et elle prenait la place qui
//    manque à une rangée qui défile. Le mot suffit, et il est plus court à
//    lire qu'un pictogramme à interpréter.
//
// 2. Les deux fiches ne nommaient pas les mêmes choses : « Feuille de match »
//    d'un côté, « Composition » de l'autre, pour le même contenu. Les libellés
//    sont maintenant décidés par l'appelant, mais depuis un vocabulaire commun.
//
// 3. La barre ne collait pas. Sur une timeline longue on perdait la navigation
//    dès le premier écran de défilement. Elle s'épingle sous le header, à
//    `--header-h`, la hauteur réelle publiée par ScoreHeader — pas un offset
//    deviné.
//
// ELLE FAIT PARTIE DU TABLEAU D'AFFICHAGE, désormais sombre (voir MatchHero) :
// même fond, pleine largeur comme lui, et elle s'épingle SOUS SA BARRE, pas
// sous le header. Les deux forment un seul bloc sombre en haut de l'écran
// quand on défile. La hauteur de la barre est publiée par MatchHero, pour la
// même raison que celle du header : elle dépend du terminal.
// ============================================

import { VARIABLE_HAUTEUR_BARRE } from "./MatchHero";

export interface MatchTab {
  id: string;
  label: string;
  /** Pastille d'alerte, à droite du libellé (feuille de match non validée). */
  badge?: React.ReactNode;
}

export default function MatchTabs({
  tabs, active, onChange,
}: {
  tabs: MatchTab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      // Pleine largeur, comme le tableau (`main` porte `p-3 lg:p-5`) : la
      // rangée qui défile doit pouvoir atteindre les bords, sinon le dernier
      // onglet semble coupé par une marge plutôt que par l'écran.
      style={{ top: `calc(var(--header-h, 72px) + var(${VARIABLE_HAUTEUR_BARRE}, 56px))` }}
      className="sticky z-30 -mx-3 border-b border-white/10 bg-gray-950 lg:-mx-5"
    >
      <div
        role="tablist"
        aria-label="Sections du match"
        className="mx-auto flex max-w-4xl gap-6 overflow-x-auto px-4 [scrollbar-width:none] sm:gap-7 sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const on = tab.id === active;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={on}
              onClick={() => onChange(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 py-3.5 text-[11px] font-black uppercase tracking-widest transition-colors ${
                on
                  ? "border-emerald-400 text-white"
                  : "border-transparent text-white/45 hover:text-white"
              }`}
            >
              {tab.label}
              {tab.badge}
            </button>
          );
        })}
      </div>
    </div>
  );
}
