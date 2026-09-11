"use client";

import Link from "next/link";
import MiniEcusson from "@/components/match/MiniEcusson";
import { MOT_RESULTAT, type Resultat, type ResultatDeForme } from "@/lib/forme";

// ============================================
// Les derniers résultats des deux équipes, dans l'onglet Infos.
//
// L'ÉCUSSON DE L'ADVERSAIRE AU-DESSUS DE CHAQUE RÉSULTAT : il donne son poids
// au résultat. Perdre contre le premier de la poule ne dit pas la même chose
// que perdre contre le dernier, et une lettre seule ne sait pas le dire.
//
// CHAQUE COLONNE NOMME SON ÉQUIPE. Le modèle dont on s'inspire ne le faisait
// pas — seule la position, gauche ou droite, disait de qui il s'agissait.
//
// Le plus récent est à droite, souligné de sa couleur, et la rangée s'aligne
// à droite : avec deux résultats seulement, le dernier reste à sa place au
// lieu de flotter au milieu.
//
// Chaque pastille mène au match qu'elle résume.
// ============================================

const PASTILLE: Record<Resultat, string> = {
  V: "bg-emerald-600 text-white",
  N: "bg-gray-200 text-gray-600",
  D: "bg-red-500 text-white",
};

const SOULIGNE: Record<Resultat, string> = {
  V: "bg-emerald-600",
  N: "bg-gray-400",
  D: "bg-red-500",
};

interface Equipe {
  nom: string;
  resultats: ResultatDeForme[];
}

function Colonne({ equipe, lien, className }: {
  equipe: Equipe;
  lien: (matchId: string) => string;
  className: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">{equipe.nom}</p>
      {equipe.resultats.length === 0 ? (
        <p className="mt-3 text-[11px] font-bold text-gray-400">Aucun match joué</p>
      ) : (
        <ol className="mt-3 flex justify-end gap-1">
          {equipe.resultats.map((r, i) => {
            const dernier = i === equipe.resultats.length - 1;
            return (
              <li key={r.matchId}>
                <Link
                  href={lien(r.matchId)}
                  title={`${MOT_RESULTAT[r.resultat]} ${r.score} contre ${r.adversaire.nom}`}
                  aria-label={`${MOT_RESULTAT[r.resultat]} ${r.score} contre ${r.adversaire.nom}${dernier ? ", le plus récent" : ""}`}
                  className="flex flex-col items-center gap-1.5 text-gray-400 transition-opacity hover:opacity-80"
                >
                  <MiniEcusson nom={r.adversaire.nom} logo={r.adversaire.logo} taille={20} className="sm:h-6! sm:w-6!" />
                  <span
                    className={`flex h-5 w-5 items-center justify-center text-[10px] font-black sm:h-6 sm:w-6 sm:text-[11px] ${PASTILLE[r.resultat]}`}
                  >
                    {r.resultat}
                  </span>
                  <span aria-hidden className={`h-0.5 w-5 sm:w-6 ${dernier ? SOULIGNE[r.resultat] : "bg-transparent"}`} />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function MatchForme({ home, away, lien }: {
  home: Equipe;
  away: Equipe;
  /** L'adresse d'un match de la compétition. */
  lien: (matchId: string) => string;
}) {
  // Avant la première journée, il n'y a rien à montrer : la carte disparaît.
  if (home.resultats.length === 0 && away.resultats.length === 0) return null;

  return (
    <section className="border border-gray-200/70 bg-white p-4 sm:p-5">
      <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Derniers résultats</h2>
      <div className="mt-3 grid grid-cols-2 divide-x divide-gray-200/70">
        <Colonne equipe={home} lien={lien} className="pr-3 sm:pr-5" />
        <Colonne equipe={away} lien={lien} className="pl-3 sm:pl-5" />
      </div>
    </section>
  );
}
