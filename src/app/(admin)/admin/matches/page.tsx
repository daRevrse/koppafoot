"use client";

import { useMemo, useState } from "react";
import { useAdminApi } from "@/hooks/useAdminApi";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import RecordActions from "@/components/admin/RecordActions";
import LigneMatch, { libelleStatut } from "@/components/admin/LigneMatch";
import { Carte, Chargement, EnTete, Erreur, Filtres, Recherche, Selecteur, Vide } from "@/components/admin/ui";
import type { MatchAdmin } from "@/lib/admin-types";

// ============================================
// Les matchs : les amicaux ET ceux des compétitions.
//
// La liste ne connaissait que les amicaux — trois matchs de compétition
// joués n'y figuraient pas —, affichait « 2026-09-20 » coupé sur trois lignes
// et ne menait nulle part. Chaque ligne ouvre maintenant la page du match.
//
// « NON CLOS » est un statut d'administration : un amical dont la date est
// passée et qui attend toujours son coup de sifflet final. C'est ce qu'il faut
// aller relancer, et le produit l'affiche encore « à venir ».
// ============================================

type Filtre = "tous" | "direct" | "a_venir" | "non_clos" | "joues" | "contestes" | "annules";

function categorie(m: MatchAdmin): Filtre {
  if (m.statut === "live") return "direct";
  if (m.statut === "cancelled") return "annules";
  if (m.statut === "completed") return "joues";
  if (libelleStatut(m).label === "Non clos") return "non_clos";
  return "a_venir";
}

export default function AdminMatchesPage() {
  const { data, erreur, chargement, recharger } = useAdminApi<{ matchs: MatchAdmin[] }>("/api/admin/matchs");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [genre, setGenre] = useState<"tous" | "amical" | "competition">("tous");
  const [recherche, setRecherche] = useState("");
  const matchs = useMemo(() => data?.matchs ?? [], [data]);

  const comptes = useMemo(() => {
    const n: Record<Filtre, number> = { tous: 0, direct: 0, a_venir: 0, non_clos: 0, joues: 0, contestes: 0, annules: 0 };
    for (const m of matchs) {
      if (genre !== "tous" && m.genre !== genre) continue;
      n.tous += 1;
      n[categorie(m)] += 1;
      if (m.validation === "contested") n.contestes += 1;
    }
    return n;
  }, [matchs, genre]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return matchs.filter((m) => {
      if (genre !== "tous" && m.genre !== genre) return false;
      if (filtre === "contestes" ? m.validation !== "contested" : filtre !== "tous" && categorie(m) !== filtre) return false;
      if (q) {
        return `${m.domicile.nom} ${m.exterieur.nom} ${m.competition?.nom ?? ""} ${m.terrain ?? ""} ${m.ville ?? ""}`
          .toLowerCase().includes(q);
      }
      return true;
    });
  }, [matchs, filtre, genre, recherche]);
  const { page, setPage, pages, tranche, total, parPage } = usePagination(filtres, 30);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EnTete
        titre="Matchs"
        sousTitre={data ? `${matchs.filter((m) => m.genre === "amical").length} amicaux, ${matchs.filter((m) => m.genre === "competition").length} matchs de compétition.` : "Lecture…"}
      />
      <Filtres<Filtre>
        valeur={filtre}
        onChange={setFiltre}
        options={[
          { valeur: "tous", label: "Tous", compte: comptes.tous },
          { valeur: "direct", label: "En direct", compte: comptes.direct },
          { valeur: "a_venir", label: "À venir", compte: comptes.a_venir },
          { valeur: "non_clos", label: "Non clos", compte: comptes.non_clos },
          { valeur: "joues", label: "Joués", compte: comptes.joues },
          { valeur: "contestes", label: "Contestés", compte: comptes.contestes },
          { valeur: "annules", label: "Annulés", compte: comptes.annules },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Recherche valeur={recherche} onChange={setRecherche} placeholder="Équipe, compétition, terrain, ville…" />
        <Selecteur
          label="Type de match"
          valeur={genre}
          onChange={setGenre}
          options={[
            { valeur: "tous", label: "Amicaux et compétitions" },
            { valeur: "amical", label: "Amicaux" },
            { valeur: "competition", label: "Compétitions" },
          ]}
        />
      </div>

      {erreur && <Erreur message={erreur} onReessayer={recharger} />}
      {chargement ? (
        <Chargement />
      ) : filtres.length === 0 ? (
        <Vide titre="Aucun match" />
      ) : (
        <Carte>
          {tranche.map((m) => (
            <LigneMatch
              key={m.cle}
              m={m}
              apres={m.genre === "amical" ? (
                <RecordActions
                  resource="match"
                  id={m.id}
                  label={`${m.domicile.nom} – ${m.exterieur.nom}`}
                  onDone={recharger}
                  // Corriger un score joué change des bilans : le classement
                  // se refait aussitôt, mais les buts d'un match couvert en
                  // direct viennent de sa feuille, pas de ce score.
                  avertissement={m.statut === "completed"
                    ? "Ce match est joué. Corriger le score ou le statut recalcule le bilan des deux équipes et le classement, mais pas les buteurs : ceux d'un match couvert en direct se corrigent sur sa feuille."
                    : undefined}
                  champs={[
                    { cle: "date", label: "Date (AAAA-MM-JJ)" },
                    { cle: "time", label: "Heure (HH:MM)" },
                    { cle: "venue_name", label: "Terrain" },
                    { cle: "venue_city", label: "Ville" },
                    { cle: "score_home", label: "Score domicile", type: "nombre" },
                    { cle: "score_away", label: "Score extérieur", type: "nombre" },
                    { cle: "status", label: "Statut", type: "liste", options: [
                      { valeur: "pending", label: "En attente" },
                      { valeur: "upcoming", label: "À venir" },
                      { valeur: "live", label: "En direct" },
                      { valeur: "completed", label: "Joué" },
                      { valeur: "cancelled", label: "Annulé" },
                    ] },
                  ]}
                  valeurs={{
                    date: m.date ?? "", time: m.heure ?? "",
                    venue_name: m.terrain ?? "", venue_city: m.ville ?? "",
                    score_home: m.scoreDomicile ?? 0, score_away: m.scoreExterieur ?? 0,
                    status: m.statut,
                  }}
                />
              ) : undefined}
            />
          ))}
          <Pagination page={page} pages={pages} total={total} parPage={parPage} onPage={setPage} nom="match" />
        </Carte>
      )}
    </div>
  );
}
