"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import MiniEcusson from "@/components/match/MiniEcusson";
import { libelleDuJour } from "@/lib/dates";
import { rangerLesMatchs, resultatDuMatch, type MatchDuClub } from "@/lib/fiche-club";
import { RESULTATS } from "@/lib/forme";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { FOOT } from "@/i18n/foot";

const T = textes(
  {
    amical: "Amical",
    domicile: "Domicile",
    exterieur: "Extérieur",
    dateAVenir: "Date à venir",
    aucun: "Aucun match pour l'instant.",
    aVenir: "À venir",
    joues: "Joués",
  },
  {
    amical: "Friendly",
    domicile: "Home",
    exterieur: "Away",
    dateAVenir: "Date to be set",
    aucun: "No matches yet.",
    aVenir: "Upcoming",
    joues: "Played",
  },
);

// ============================================
// Les matchs d'un club, vus DU CLUB : l'adversaire, le score et le résultat.
//
// La fiche posait l'affiche entière sur chaque carte — le nom du club, tronqué
// en « AVENIR D'ADAK… », répété de match en match sur sa propre page. Ce
// qu'on vient lire ici, c'est contre qui, et comment ça s'est fini.
//
// LES AMICAUX ET LES COMPÉTITIONS ENSEMBLE. L'onglet ne montrait que les
// amicaux, quand le bilan juste au-dessus comptait aussi les compétitions :
// deux matchs listés pour quatre joués.
// ============================================

const PASTILLE: Record<"V" | "N" | "D", string> = {
  V: "bg-emerald-600 text-white",
  N: "bg-gray-200 text-gray-600",
  D: "bg-red-500 text-white",
};

function Ligne({ m, presence, avecCompetition }: {
  m: MatchDuClub;
  presence?: React.ReactNode;
  avecCompetition: boolean;
}) {
  const { langue } = useLangue();
  const t = useTextes(T);
  const f = useTextes(FOOT);
  const resultat = resultatDuMatch(m);
  // L'étape dans la langue du lecteur quand la donnée est là, sinon le
  // libellé français que le serveur a posé.
  const etape = m.tour ? f.tour(m.tour) : m.groupe ? f.groupe(m.groupe) : m.etape;
  const contexte = [
    avecCompetition ? (m.competition ? m.competition.nom : t.amical) : null,
    etape,
    m.domicile ? t.domicile : t.exterieur,
  ].filter(Boolean).join(" · ");

  return (
    <li>
      <Link
        href={m.lien}
        className={`group flex items-center gap-3 border-l-2 bg-white px-3 py-3 transition-colors hover:bg-gray-50 sm:px-4 ${
          m.statut === "en_direct" ? "border-l-red-500"
          : resultat === "V" ? "border-l-emerald-500"
          : resultat === "D" ? "border-l-red-300"
          : resultat === "N" ? "border-l-gray-300"
          : "border-l-transparent"
        }`}
      >
        <span className="w-[4.75rem] shrink-0 text-[10px] font-black uppercase leading-tight tracking-wide text-gray-400">
          {m.date ? libelleDuJour(m.date, langue) : t.dateAVenir}
          {m.heure && m.statut === "a_venir" && <span className="block tabular-nums text-gray-500">{m.heure}</span>}
        </span>
        <MiniEcusson nom={m.adversaire.nom} logo={m.adversaire.logo} taille={24} className="text-gray-400" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-gray-900">{m.adversaire.nom}</span>
          <span className="block truncate text-[11px] font-semibold text-gray-400">{contexte}</span>
        </span>
        {m.statut === "en_direct" ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-red-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            {m.pour ?? 0}–{m.contre ?? 0}
          </span>
        ) : resultat ? (
          <span className="flex shrink-0 items-center gap-2">
            <span className="font-display text-base font-black tabular-nums text-gray-900">
              {m.pour}<span className="mx-0.5 text-gray-300">–</span>{m.contre}
            </span>
            <span className={`flex h-5 w-5 items-center justify-center text-[10px] font-black ${PASTILLE[resultat]}`}>
              {RESULTATS[langue].lettre[resultat]}
            </span>
          </span>
        ) : (
          presence ?? null
        )}
        <ChevronRight size={15} className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

export default function MatchsDuClub({ matchs, presence, avecCompetition = true }: {
  matchs: MatchDuClub[];
  /** Ce que les membres voient en plus sur un match à venir : qui a confirmé. */
  presence?: Record<string, React.ReactNode>;
  /**
   * Nommer la compétition de chaque match. Faux sur la fiche d'une équipe
   * EN compétition : elle y est partout, et ne dirait rien.
   */
  avecCompetition?: boolean;
}) {
  const t = useTextes(T);
  const { aVenir, joues } = rangerLesMatchs(matchs);
  if (aVenir.length === 0 && joues.length === 0) {
    return (
      <p className="border border-gray-200/70 bg-white px-5 py-10 text-center text-sm font-bold text-gray-400">
        {t.aucun}
      </p>
    );
  }
  return (
    <div className="space-y-5">
      {[
        { titre: t.aVenir, liste: aVenir },
        { titre: t.joues, liste: joues },
      ].filter((b) => b.liste.length > 0).map((b) => (
        <section key={b.titre}>
          <h3 className="mb-1.5 flex items-baseline gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
            {b.titre}
            <span className="tabular-nums text-gray-300">{b.liste.length}</span>
          </h3>
          <ul className="divide-y divide-gray-200/70 border border-gray-200/70">
            {b.liste.map((m) => (
              <Ligne key={m.lien} m={m} presence={presence?.[m.id]} avecCompetition={avecCompetition} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
