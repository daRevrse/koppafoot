"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAdminApi } from "@/hooks/useAdminApi";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import RecordActions from "@/components/admin/RecordActions";
import MiniEcusson from "@/components/match/MiniEcusson";
import {
  Carte, Chargement, EnTete, Erreur, Filtres, Pastille, Recherche, Vide,
} from "@/components/admin/ui";
import type { EquipeAdmin } from "@/lib/admin-types";

// ============================================
// Les équipes.
//
// LE BILAN DE LA FICHE PUBLIQUE, PAS CELUI DU DOCUMENT. La liste lisait les
// compteurs `wins`/`losses` de l'équipe, que rien ne tient à jour et qui
// ignorent les compétitions : « 2 V, 100 % » ici pour « 4 joués, 3 G, 1 N »
// sur la fiche du club. Et « 4 joueurs » pour un effectif de quatorze : elle
// ne comptait que les comptes, pas les joueurs sans compte. Les deux viennent
// maintenant du serveur, calculés comme la fiche les calcule.
// ============================================

const NIVEAUX: Record<string, string> = {
  beginner: "Débutant", amateur: "Amateur", intermediate: "Intermédiaire", advanced: "Avancé",
};

type Filtre = "toutes" | "recrutent" | "sans_match" | "sans_manager";

export default function AdminTeamsPage() {
  const { data, erreur, chargement, recharger } = useAdminApi<{ equipes: EquipeAdmin[] }>("/api/admin/equipes");
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const equipes = useMemo(() => data?.equipes ?? [], [data]);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return equipes.filter((e) => {
      if (filtre === "recrutent" && !e.recrute) return false;
      if (filtre === "sans_match" && e.bilan.joues > 0) return false;
      if (filtre === "sans_manager" && e.manager && e.manager.nom !== "Compte supprimé") return false;
      if (q) return `${e.nom} ${e.ville} ${e.manager?.nom ?? ""}`.toLowerCase().includes(q);
      return true;
    });
  }, [equipes, recherche, filtre]);
  const { page, setPage, pages, tranche, total, parPage } = usePagination(filtrees, 30);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EnTete
        titre="Équipes"
        sousTitre={data ? `${equipes.length} clubs, ${equipes.filter((e) => e.recrute).length} qui recrutent.` : "Lecture…"}
      />
      <Filtres<Filtre>
        valeur={filtre}
        onChange={setFiltre}
        options={[
          { valeur: "toutes", label: "Toutes", compte: equipes.length },
          { valeur: "recrutent", label: "Recrutent", compte: equipes.filter((e) => e.recrute).length },
          { valeur: "sans_match", label: "Jamais joué", compte: equipes.filter((e) => e.bilan.joues === 0).length },
          { valeur: "sans_manager", label: "Sans manager", compte: equipes.filter((e) => !e.manager || e.manager.nom === "Compte supprimé").length },
        ]}
      />
      <Recherche valeur={recherche} onChange={setRecherche} placeholder="Nom du club, ville, manager…" />

      {erreur && <Erreur message={erreur} onReessayer={recharger} />}
      {chargement ? (
        <Chargement />
      ) : filtrees.length === 0 ? (
        <Vide titre="Aucune équipe" />
      ) : (
        <Carte>
          <ul className="divide-y divide-gray-200/70">
            {tranche.map((e) => (
              <li key={e.id} className="flex items-center gap-2 pr-2">
                <Link href={`/admin/teams/${e.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-gray-50 sm:flex-nowrap">
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <MiniEcusson nom={e.nom} logo={e.logo} taille={32} className="text-gray-400" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-black text-gray-900">{e.nom}</span>
                        {e.recrute && <Pastille ton="vert">Recrute</Pastille>}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {[e.ville, NIVEAUX[e.niveau], e.manager ? `Manager : ${e.manager.nom}` : "Sans manager"].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-4 text-xs text-gray-500">
                    <span><strong className="font-display text-base font-black tabular-nums text-gray-900">{e.effectif}</strong> joueurs</span>
                    <span className="tabular-nums">
                      <strong className="font-display text-base font-black text-gray-900">{e.bilan.joues}</strong> joués
                      {e.bilan.joues > 0 && <span className="ml-1.5">{e.bilan.gagnes}G {e.bilan.nuls}N {e.bilan.perdus}P</span>}
                    </span>
                  </span>
                </Link>
                <RecordActions
                  resource="team"
                  id={e.id}
                  label={e.nom}
                  onDone={recharger}
                  champs={[
                    { cle: "name", label: "Nom" },
                    { cle: "city", label: "Ville" },
                    { cle: "slogan", label: "Slogan" },
                    { cle: "description", label: "Description" },
                    { cle: "max_members", label: "Effectif maximum", type: "nombre" },
                    { cle: "level", label: "Niveau", type: "liste", options: Object.entries(NIVEAUX).map(([valeur, label]) => ({ valeur, label })) },
                    { cle: "is_recruiting", label: "En recrutement", type: "booleen" },
                  ]}
                  valeurs={{
                    name: e.nom, city: e.ville, slogan: e.slogan, description: e.description,
                    max_members: e.maxMembres, level: e.niveau, is_recruiting: e.recrute,
                  }}
                />
              </li>
            ))}
          </ul>
          <Pagination page={page} pages={pages} total={total} parPage={parPage} onPage={setPage} nom="équipe" />
        </Carte>
      )}
    </div>
  );
}
