import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { nombreFr } from "@/lib/audience";
import { couvertureLisible, parMatchLisible, titreDuRecord, type StatsDeJeu } from "@/lib/stats-competition";

// ============================================
// Les statistiques de jeu d'une compétition (lib/stats-competition) : les
// totaux, puis le match qui détient chaque record.
//
// UN SEUL PANNEAU POUR DEUX ÉCRANS : l'onglet « Le jeu » de l'espace
// organisateur, et l'onglet « Stats » de la page publique quand l'organisateur
// l'a ouvert. Ce que le public voit est donc exactement ce que le staff a vu
// avant de le publier.
//
// LA LIGNE DE COUVERTURE D'ABORD. « 55 fautes » ne veut rien dire tant qu'on
// ne sait pas sur combien de matchs on les a comptées : le score est saisi
// partout, le reste seulement sur les matchs tenus à la console.
// ============================================

export default function PanneauStatsDeJeu({ stats, lienDuMatch }: {
  stats: StatsDeJeu;
  lienDuMatch: (matchId: string) => string;
}) {
  if (stats.joues === 0) {
    return (
      <p className="border border-dashed border-gray-200/70 bg-white px-4 py-8 text-center text-sm text-gray-400">
        Aucun match joué pour l&apos;instant : les totaux et les records apparaîtront au premier coup de sifflet final.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">{couvertureLisible(stats)}</p>

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-gray-900">Les totaux</h2>
        <div className="grid grid-cols-2 gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-4">
          {stats.totaux.map((t) => (
            <div key={t.cle} className="bg-white p-4">
              <p className="text-xs font-semibold text-gray-500">{t.label}</p>
              <p className="mt-1 font-display text-2xl font-black tabular-nums text-gray-900">{nombreFr(t.total)}</p>
              <p className="mt-0.5 text-xs text-gray-400">{parMatchLisible(t.parMatch)} par match</p>
            </div>
          ))}
        </div>
      </section>

      {stats.records.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-900">Les records</h2>
          {/* `grid-cols-1` et non rien : une colonne implicite prend la largeur
              du nom de match le plus long, que `truncate` ne coupe plus. */}
          <div className="grid grid-cols-1 gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-2">
            {stats.records.map((r) => (
              <Link
                key={r.cle}
                href={lienDuMatch(r.matchId)}
                className="flex items-center gap-3 bg-white px-4 py-3 transition-colors hover:bg-gray-50"
              >
                <span className="w-10 shrink-0 text-center font-display text-xl font-black tabular-nums text-primary-600">
                  {r.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-black uppercase tracking-wider text-gray-500">
                    {titreDuRecord(r.label)}
                  </span>
                  <span className="block truncate text-sm font-bold text-gray-900">{r.affiche}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-gray-300" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
