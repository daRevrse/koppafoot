import { useEffect, useState } from "react";
import type { Competition, CompMatch, CompTeam } from "@/types";
import { usePremierPlan } from "~/hooks/usePremierPlan";
import { API_URL } from "~/lib/config";
import { ecouterMatchsCompetition } from "~/lib/direct-firestore";
import { ecouterEquipesCompetition, lireCompetition } from "~/lib/fiche-firestore";

export interface EtatDeLaCompetition {
  competition: Competition | null;
  /** `null` tant que le premier relevé des matchs n'est pas arrivé : rien n'est encore « vide ». */
  matchs: CompMatch[] | null;
  equipes: CompTeam[];
  /** Le nombre d'abonnés, compté par le serveur ; `null` tant qu'on ne le sait pas. */
  abonnes: number | null;
  chargement: boolean;
  introuvable: boolean;
}

/**
 * Une compétition, comme sa page sur le site : la compétition se lit une
 * fois, ses matchs et ses équipes s'écoutent (les écouteurs se coupent en
 * arrière-plan, comme ceux du Direct), et le nombre d'abonnés vient après,
 * en ornement.
 */
export function useCompetition(cid: string): EtatDeLaCompetition {
  const actif = usePremierPlan();
  const [competition, setCompetition] = useState<Competition | null | undefined>(undefined);
  const [matchs, setMatchs] = useState<CompMatch[] | null>(null);
  const [equipes, setEquipes] = useState<CompTeam[]>([]);
  const [abonnes, setAbonnes] = useState<number | null>(null);

  useEffect(() => {
    let vivant = true;
    lireCompetition(cid)
      .then((c) => {
        if (vivant) setCompetition(c);
      })
      .catch(() => {
        if (vivant) setCompetition(null);
      });
    fetch(`${API_URL}/api/competitions/${encodeURIComponent(cid)}/followers`)
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d: { count?: number }) => {
        if (vivant) setAbonnes(d.count ?? 0);
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [cid]);

  useEffect(() => {
    if (!actif) return;
    const arrets = [ecouterMatchsCompetition(cid, setMatchs), ecouterEquipesCompetition(cid, setEquipes)];
    return () => arrets.forEach((arret) => arret());
  }, [actif, cid]);

  return {
    competition: competition ?? null,
    matchs,
    equipes,
    abonnes,
    chargement: competition === undefined,
    introuvable: competition === null,
  };
}
