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
// 2. Les deux fiches ne nommaient pas les mêmes choses : « Feuille de match »
//    d'un côté, « Composition » de l'autre, pour le même contenu. Les libellés
//    sont maintenant décidés par l'appelant, mais depuis un vocabulaire commun.
//
// 3. La barre ne collait pas. Sur une timeline longue on perdait la navigation
//    dès le premier écran de défilement. Elle s'épingle sous le header, à
//    `--header-h`, la hauteur réelle publiée par ScoreHeader — pas un offset
//    deviné.
// ============================================

export interface MatchTab {
  id: string;
  label: string;
  Icon?: React.ComponentType<{ size?: number; className?: string }>;
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
      // Pleine largeur sur téléphone (`main` porte `p-3`) : la rangée qui
      // défile doit pouvoir atteindre les bords, sinon le dernier onglet
      // semble coupé par une marge plutôt que par l'écran.
      className="sticky top-[var(--header-h,72px)] z-30 -mx-3 border-b border-gray-200/70 bg-[#F4F6FA] sm:mx-0"
    >
      <div
        role="tablist"
        aria-label="Sections du match"
        className="flex gap-6 overflow-x-auto px-3 [scrollbar-width:none] sm:gap-7 sm:px-0 [&::-webkit-scrollbar]:hidden"
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
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              {tab.Icon && <tab.Icon size={15} className="shrink-0" />}
              {tab.label}
              {tab.badge}
            </button>
          );
        })}
      </div>
    </div>
  );
}
