import type { WorldScorer } from "@/lib/football-data";
import type { Langue } from "@/i18n/config";
import { textes } from "@/i18n/textes";

const T = textes(
  {
    joueur: "Joueur", club: "Club",
    mj: "MJ", mjTitre: "Matchs joués",
    pd: "PD", pdTitre: "Passes décisives",
    buts: "Buts",
  },
  {
    joueur: "Player", club: "Club",
    mj: "MP", mjTitre: "Matches played",
    pd: "A", pdTitre: "Assists",
    buts: "Goals",
  },
);

// The provider's scoring chart. Server-safe (no client hooks), like the
// standings, this is indexable content and belongs in the initial HTML.
// Assists and appearances are absent on some competitions, so both columns
// fall back to a dash rather than a misleading zero.
export default function WorldScorersTable({
  scorers,
  langue = "fr",
}: {
  scorers: WorldScorer[];
  langue?: Langue;
}) {
  const t = T[langue];
  return (
    <section className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              <th className="px-3 py-3 text-center">#</th>
              <th className="px-3 py-3 text-left">{t.joueur}</th>
              <th className="px-3 py-3 text-left">{t.club}</th>
              <th className="px-2 py-3 text-center" title={t.mjTitre}>{t.mj}</th>
              <th className="px-2 py-3 text-center" title={t.pdTitre}>{t.pd}</th>
              <th className="px-3 py-3 text-center" title={t.buts}>{t.buts}</th>
            </tr>
          </thead>
          <tbody>
            {scorers.map((scorer, index) => (
              <tr key={`${scorer.playerId}-${index}`} className="border-t border-gray-200/70">
                <td className="px-3 py-3 text-center">
                  <span className="flex h-6 w-6 items-center justify-center bg-gray-100 text-xs font-black text-gray-500">
                    {index + 1}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="font-bold text-gray-900">{scorer.playerName}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    {scorer.team.crest ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={scorer.team.crest} alt="" className="h-5 w-5 shrink-0 object-contain" />
                    ) : null}
                    <span className="truncate text-[13px] font-bold text-gray-500">
                      {scorer.team.name}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-3 text-center font-bold text-gray-500">
                  {scorer.playedMatches ?? "–"}
                </td>
                <td className="px-2 py-3 text-center font-bold text-gray-500">
                  {scorer.assists ?? "–"}
                </td>
                <td className="px-3 py-3 text-center text-base font-black text-gray-900">
                  {scorer.goals}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
