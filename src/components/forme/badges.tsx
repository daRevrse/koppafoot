"use client";

import Link from "next/link";
import {
  Ban, Bandage, CircleHelp, Flame, HeartPulse, Minus, Plane, TrendingDown, TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  JOURS_SANS_MATCH, LIBELLE_CONDITION, LIBELLE_FORME,
  conditionASignaler, conditionEnVigueur, joursDepuis,
  type ConditionJoueur, type FormeJoueur, type MatchDeForme, type NiveauForme,
  type StatutCondition, type Tendance,
} from "@/lib/etat-de-forme";
import { formaterNote, tonNote } from "@/lib/notes";

// ============================================
// Les pastilles de l'état de forme : la condition déclarée, la forme
// calculée, et la frise des notes. Voir lib/etat-de-forme.
//
// DEUX VARIANTES, CLAIRE ET SOMBRE. La feuille de match se compose sur un
// fond sombre que le thème ne touche pas ; partout ailleurs, les couleurs
// sont prises dans la liste que styles/dark.css sait réécrire.
// ============================================

export const ICONE_CONDITION: Record<StatutCondition, LucideIcon> = {
  apte: HeartPulse,
  incertain: CircleHelp,
  blesse: Bandage,
  suspendu: Ban,
  indisponible: Plane,
};

const TON_CONDITION: Record<StatutCondition, { clair: string; sombre: string }> = {
  apte: { clair: "border-emerald-200 bg-emerald-50 text-emerald-700", sombre: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300" },
  incertain: { clair: "border-amber-200 bg-amber-50 text-amber-700", sombre: "border-amber-400/30 bg-amber-500/15 text-amber-300" },
  blesse: { clair: "border-red-200 bg-red-50 text-red-700", sombre: "border-red-400/30 bg-red-500/15 text-red-300" },
  suspendu: { clair: "border-orange-200 bg-orange-50 text-orange-700", sombre: "border-orange-400/30 bg-orange-500/15 text-orange-300" },
  indisponible: { clair: "border-gray-200/70 bg-gray-100 text-gray-600", sombre: "border-white/15 bg-white/10 text-white/60" },
};

const TON_FORME: Record<NiveauForme, { clair: string; sombre: string }> = {
  excellente: { clair: "border-emerald-200 bg-emerald-100 text-emerald-800", sombre: "border-emerald-400/40 bg-emerald-500/25 text-emerald-200" },
  bonne: { clair: "border-emerald-200 bg-emerald-50 text-emerald-700", sombre: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300" },
  moyenne: { clair: "border-gray-200/70 bg-gray-50 text-gray-600", sombre: "border-white/15 bg-white/10 text-white/70" },
  faible: { clair: "border-red-200 bg-red-50 text-red-700", sombre: "border-red-400/30 bg-red-500/15 text-red-300" },
};

/** Même fond que la note de la console (voir TerrainConsole) : une note se lit pareil partout. */
export const FOND_NOTE: Record<ReturnType<typeof tonNote>, string> = {
  absente: "bg-gray-200 text-gray-500",
  faible: "bg-red-500 text-white",
  moyenne: "bg-gray-500 text-white",
  bonne: "bg-emerald-600 text-white",
  excellente: "bg-emerald-500 text-white",
};

export const ICONE_TENDANCE: Record<Tendance, LucideIcon> = {
  hausse: TrendingUp,
  stable: Minus,
  baisse: TrendingDown,
};

export const MOT_TENDANCE: Record<Tendance, string> = {
  hausse: "en progrès",
  stable: "stable",
  baisse: "en baisse",
};

/** « 12 oct. » */
export function jourCourt(jour: string): string {
  try {
    return new Date(`${jour}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return jour;
  }
}

/** Ce que la pastille dit au survol : tout ce qu'elle n'a pas la place d'écrire. */
export function resumeCondition(c: ConditionJoueur): string {
  return [
    LIBELLE_CONDITION[c.statut],
    c.retourPrevu ? `retour prévu le ${jourCourt(c.retourPrevu)}` : null,
    c.note ? `« ${c.note} »` : null,
    c.declareeLe ? `déclaré le ${jourCourt(c.declareeLe.slice(0, 10))}` : null,
  ].filter(Boolean).join(" · ");
}

/**
 * La condition d'un joueur, en pastille.
 *
 * SILENCIEUSE PAR DÉFAUT QUAND TOUT VA BIEN. Dans un effectif, quinze
 * pastilles « Apte » noieraient les deux qui comptent ; `apte` les montre
 * quand c'est précisément ce qu'on veut lire (la fiche du joueur).
 */
export function BadgeCondition({
  condition,
  apte = false,
  sombre = false,
  date = true,
  className = "",
}: {
  condition: ConditionJoueur | null | undefined;
  apte?: boolean;
  sombre?: boolean;
  /** Faux quand la date de retour s'écrit déjà à côté, en toutes lettres. */
  date?: boolean;
  className?: string;
}) {
  const c = apte ? conditionEnVigueur(condition) : conditionASignaler(condition);
  if (!c) return null;
  const Icon = ICONE_CONDITION[c.statut];
  return (
    <span
      title={resumeCondition(c)}
      className={`inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${TON_CONDITION[c.statut][sombre ? "sombre" : "clair"]} ${className}`}
    >
      <Icon size={11} className="shrink-0" />
      {LIBELLE_CONDITION[c.statut]}
      {date && c.retourPrevu && <span className="font-bold normal-case tracking-normal">· {jourCourt(c.retourPrevu)}</span>}
    </span>
  );
}

/**
 * La forme calculée, en pastille : le niveau, l'indice, la pente.
 *
 * Rien quand il n'y a pas de niveau : un joueur sans assez de matchs notés
 * n'est pas « en méforme », il n'a pas de forme connue, et une pastille grise
 * sur chaque nouveau serait du bruit.
 *
 * GRISÉE QUAND ELLE DATE. Une forme d'il y a six semaines se montre encore,
 * mais comme ce qu'elle est : celle d'avant la pause.
 */
export function BadgeForme({
  forme,
  sombre = false,
  court = false,
  pente = true,
  className = "",
}: {
  forme: FormeJoueur | null | undefined;
  sombre?: boolean;
  /** Sans le libellé : l'indice et la pente seulement, pour une ligne serrée. */
  court?: boolean;
  /** Faux quand la pente s'écrit déjà à côté, en toutes lettres. */
  pente?: boolean;
  className?: string;
}) {
  if (!forme?.niveau || forme.indice === null) return null;
  const jours = joursDepuis(forme.dernierMatch);
  const ancienne = jours !== null && jours > JOURS_SANS_MATCH;
  const Pente = pente && forme.tendance ? ICONE_TENDANCE[forme.tendance] : null;
  const titre = [
    `${LIBELLE_FORME[forme.niveau]} : ${formaterNote(forme.indice)} de moyenne sur ${forme.matchs.length} match${forme.matchs.length > 1 ? "s" : ""}`,
    forme.tendance ? MOT_TENDANCE[forme.tendance] : null,
    jours !== null ? `dernier match il y a ${jours} jour${jours > 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <span
      title={titre}
      className={`inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${TON_FORME[forme.niveau][sombre ? "sombre" : "clair"]} ${ancienne ? "opacity-50" : ""} ${className}`}
    >
      {forme.niveau === "excellente" && <Flame size={11} className="shrink-0" />}
      {!court && LIBELLE_FORME[forme.niveau]}
      <span className="tabular-nums">{formaterNote(forme.indice)}</span>
      {Pente && <Pente size={11} className="shrink-0" aria-label={forme.tendance ? MOT_TENDANCE[forme.tendance] : undefined} />}
    </span>
  );
}

/**
 * Les notes de la fenêtre, du plus ancien au plus récent : le sens d'une
 * frise, et celui de la forme des équipes (voir MatchForme). Chaque note mène
 * au match qu'elle résume.
 */
export function FriseDesNotes({ matchs, className = "" }: { matchs: MatchDeForme[]; className?: string }) {
  if (matchs.length === 0) return null;
  const ordre = [...matchs].reverse();
  return (
    <ol className={`flex items-end gap-1 ${className}`}>
      {ordre.map((m, i) => {
        const dernier = i === ordre.length - 1;
        const titre = [
          m.date ? jourCourt(m.date) : null,
          `${m.resultat === "V" ? "Victoire" : m.resultat === "D" ? "Défaite" : "Nul"} ${m.score} contre ${m.adversaire}`,
          m.note === null ? "pas assez joué pour être noté" : `note ${formaterNote(m.note)}`,
          m.minutes > 0 ? `${m.minutes}'` : null,
          m.buts > 0 ? `${m.buts} but${m.buts > 1 ? "s" : ""}` : null,
          m.passes > 0 ? `${m.passes} passe${m.passes > 1 ? "s" : ""} déc.` : null,
        ].filter(Boolean).join(" · ");
        const pastille = (
          <span className="flex flex-col items-center gap-1">
            <span
              className={`flex h-7 w-9 items-center justify-center text-[11px] font-black tabular-nums ${FOND_NOTE[tonNote(m.note)]}`}
            >
              {formaterNote(m.note)}
            </span>
            <span aria-hidden className={`h-0.5 w-9 ${dernier ? "bg-gray-900" : "bg-transparent"}`} />
          </span>
        );
        return (
          <li key={`${m.matchId}-${i}`} title={titre} aria-label={titre}>
            {m.lien ? (
              <Link href={m.lien} className="transition-opacity hover:opacity-80">{pastille}</Link>
            ) : pastille}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Les deux pastilles côte à côte, pour une ligne d'effectif ou de feuille :
 * la condition d'abord — c'est elle qui dit s'il peut jouer —, la forme
 * ensuite. Rien du tout quand aucune des deux n'a quelque chose à dire.
 */
export function PastillesEtatDeForme({
  condition,
  forme,
  sombre = false,
  className = "",
}: {
  condition: ConditionJoueur | null | undefined;
  forme: FormeJoueur | null | undefined;
  sombre?: boolean;
  className?: string;
}) {
  if (!conditionASignaler(condition) && !forme?.niveau) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <BadgeCondition condition={condition} sombre={sombre} />
      <BadgeForme forme={forme} sombre={sombre} />
    </div>
  );
}
