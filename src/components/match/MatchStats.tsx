"use client";

// ============================================
// Les compteurs d'un match, une ligne par mesure.
//
// Le rendu vivait en dur dans la fiche d'un match de compétition. Il en sort
// pour trois raisons, dans cet ordre d'importance :
//
// 1. LA FICHE D'UN AMICAL N'EN AVAIT PAS. Le même scoreur, la même console,
//    les mêmes événements en base — et rien à lire au bout. Depuis que la
//    console est une, ses deux sorties publiques doivent l'être aussi.
//
// 2. La console doit montrer au scoreur ce qu'il vient de compter, sous le
//    même nom et dans le même ordre que le public. C'est sa seule façon de
//    vérifier qu'il saisit bien ce qu'il croit saisir.
//
// 3. La possession n'est pas un nombre mais un pourcentage, et elle n'a pas
//    de total à partager : sa barre se lit directement, sans division.
//
// Le calcul, lui, est ailleurs : voir lib/stats-match.
// ============================================

import type { LigneStat } from "@/lib/stats-match";

export default function MatchStats({
  lignes, homeTeamName, awayTeamName, compact = false, sombre = false, couleurs,
}: {
  lignes: LigneStat[];
  homeTeamName: string;
  awayTeamName: string;
  /** Serré, pour la colonne de la console. Aéré sur une fiche publique. */
  compact?: boolean;
  /**
   * Sur le fond sombre de la console, qui ne suit pas le thème : les mêmes
   * lignes, dans les tons du reste de l'écran.
   */
  sombre?: boolean;
  /**
   * La couleur de chaque équipe (voir `couleursDesBarres`). Sans elle, le
   * vert et le gris d'avant — ceux de la console, qui ne connaît pas de
   * fond où les poser autrement.
   */
  couleurs?: { home: string; away: string } | null;
}) {
  if (lignes.length === 0) return null;
  const chiffre = sombre ? "text-white" : "text-gray-900";
  const libelle = sombre ? "text-white/45" : "text-gray-400";
  const legende = sombre ? "text-white/55" : "text-gray-500";
  const piste = sombre ? "bg-white/10" : "bg-gray-100";
  const visiteur = sombre ? "bg-white/35" : "bg-gray-300";
  // Une classe quand on n'a pas de couleur, un style quand on en a une : la
  // couleur d'une équipe n'est pas une classe que Tailwind connaît d'avance.
  const peinture = (camp: "home" | "away") =>
    couleurs
      ? { className: "", style: { backgroundColor: couleurs[camp] } }
      : { className: camp === "home" ? "bg-emerald-500" : visiteur, style: undefined };
  const dom = peinture("home");
  const ext = peinture("away");

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      {lignes.map((row) => {
        const total = row.home + row.away;
        // Une ligne à 0 – 0 n'a pas de part à montrer : la barre reste vide
        // plutôt que de couper l'écran en deux moitiés égales, qui se lisent
        // comme une égalité mesurée.
        const homePct = total === 0 ? 0 : (row.home / total) * 100;
        const awayPct = total === 0 ? 0 : 100 - homePct;
        const valeur = (n: number) => (row.pourcent ? `${n} %` : String(n));

        return (
          <div key={row.cle}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className={`text-left font-black tabular-nums ${chiffre} ${compact ? "w-10 text-sm" : "w-12 text-base"}`}>
                {valeur(row.home)}
              </span>
              <span className={`truncate text-[11px] font-black uppercase tracking-wide ${libelle}`}>
                {row.label}
              </span>
              <span className={`text-right font-black tabular-nums ${chiffre} ${compact ? "w-10 text-sm" : "w-12 text-base"}`}>
                {valeur(row.away)}
              </span>
            </div>
            <div className={`flex h-1.5 overflow-hidden rounded-full ${piste}`}>
              <div className={`${dom.className} transition-all`} style={{ ...dom.style, width: `${homePct}%` }} />
              <div className={`${ext.className} transition-all`} style={{ ...ext.style, width: `${awayPct}%` }} />
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-3 pt-1 text-[10px] font-black uppercase tracking-wide">
        <span className={`flex min-w-0 items-center gap-1.5 ${legende}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${dom.className}`} style={dom.style} />
          <span className="truncate">{homeTeamName}</span>
        </span>
        <span className={`flex min-w-0 items-center gap-1.5 ${legende}`}>
          <span className="truncate">{awayTeamName}</span>
          <span className={`h-2 w-2 shrink-0 rounded-full ${ext.className}`} style={ext.style} />
        </span>
      </div>
    </div>
  );
}
