import Link from "next/link";
import { ChevronRight } from "lucide-react";
import MiniEcusson from "@/components/match/MiniEcusson";
import { Pastille, dateDeMatch, type Ton } from "@/components/admin/ui";
import type { MatchAdmin } from "@/lib/admin-types";

// ============================================
// Un match dans une liste de l'administration : qui, quand, où il en est.
//
// La liste affichait « Avenir d'Adakpamé vs Espoir de Nyékonakpoè », une date
// « 2026-09-20 » coupée sur trois lignes, et ne menait nulle part. Ici le
// match se lit comme ailleurs dans le produit (écussons, score au milieu), sa
// date en toutes lettres, et la ligne ouvre sa page.
// ============================================

export const STATUTS_MATCH: Record<string, { label: string; ton: Ton }> = {
  challenge: { label: "Défi envoyé", ton: "ambre" },
  pending: { label: "En attente", ton: "ambre" },
  draft: { label: "Brouillon", ton: "gris" },
  upcoming: { label: "À venir", ton: "bleu" },
  scheduled: { label: "À venir", ton: "bleu" },
  delayed: { label: "Non clos", ton: "ambre" },
  live: { label: "En direct", ton: "rouge" },
  completed: { label: "Joué", ton: "vert" },
  cancelled: { label: "Annulé", ton: "gris" },
};

const VALIDATIONS: Record<string, { label: string; ton: Ton } | null> = {
  contested: { label: "Contesté", ton: "rouge" },
  pending: { label: "À valider", ton: "ambre" },
  validated: null,
  unverified: null,
};

export function libelleStatut(m: Pick<MatchAdmin, "statut" | "date">): { label: string; ton: Ton } {
  // Un amical « à venir » dont la date est passée n'a pas été clos : c'est
  // ce que l'administration a besoin de voir, pas « À venir ».
  if (m.statut === "upcoming" && m.date && m.date < new Date().toISOString().slice(0, 10)) {
    return STATUTS_MATCH.delayed;
  }
  return STATUTS_MATCH[m.statut] ?? { label: m.statut || "?", ton: "gris" };
}

export default function LigneMatch({ m, apres }: { m: MatchAdmin; apres?: React.ReactNode }) {
  const statut = libelleStatut(m);
  const validation = m.validation ? VALIDATIONS[m.validation] : null;
  const joue = m.statut === "completed" || m.statut === "live";
  const contexte = [
    m.competition ? m.competition.nom : "Amical",
    m.etape,
    m.renseigne ? "Renseigné après coup" : null,
    m.terrain,
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex items-center gap-2 border-b border-gray-200/70 bg-white last:border-b-0">
      <Link href={m.lien} className="group flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-gray-50 sm:flex-nowrap">
        <span className="w-24 shrink-0 text-[11px] font-black uppercase leading-tight tracking-wide text-gray-500">
          {dateDeMatch(m.date)}
          {m.heure && <span className="block tabular-nums text-gray-400">{m.heure}</span>}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-gray-900">
            <MiniEcusson nom={m.domicile.nom} logo={m.domicile.logo} taille={20} className="text-gray-400" />
            <span className="min-w-0 truncate">{m.domicile.nom}</span>
            <span className="shrink-0 font-display text-base font-black tabular-nums text-gray-900">
              {joue && m.scoreDomicile != null ? `${m.scoreDomicile}–${m.scoreExterieur ?? 0}` : "–"}
            </span>
            <span className="min-w-0 truncate">{m.exterieur.nom}</span>
            <MiniEcusson nom={m.exterieur.nom} logo={m.exterieur.logo} taille={20} className="text-gray-400" />
          </span>
          <span className="truncate text-[11px] font-semibold text-gray-400">{contexte}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {validation && <Pastille ton={validation.ton}>{validation.label}</Pastille>}
          <Pastille ton={statut.ton}>{statut.label}</Pastille>
        </span>
        <ChevronRight size={15} className="hidden shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 sm:block" />
      </Link>
      {apres && <div className="shrink-0 pr-2">{apres}</div>}
    </div>
  );
}
