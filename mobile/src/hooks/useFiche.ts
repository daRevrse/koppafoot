import { useEffect, useMemo, useState } from "react";
import type { Competition, CompMatch, CompTeam, Match } from "@/types";
import { usePremierPlan } from "~/hooks/usePremierPlan";
import { ecouterAmical, ecouterEquipesCompetition, ecouterMatchCompetition, lireCompetition } from "~/lib/fiche-firestore";
import { ficheDepuisAmical, ficheDepuisCompetition, type Fiche } from "~/lib/fiche-match";

export interface EtatDeLaFiche {
  fiche: Fiche | null;
  /** Rien n'est encore arrivé. */
  chargement: boolean;
  /** Le match n'existe pas (ou plus). */
  introuvable: boolean;
}

/**
 * Une rencontre de compétition, en temps réel.
 *
 * La compétition se lit une fois ; le match et les équipes s'écoutent, et les
 * écouteurs se coupent en arrière-plan, comme ceux du Direct (voir useDirect).
 */
export function useFicheCompetition(cid: string, mid: string): EtatDeLaFiche {
  const actif = usePremierPlan();
  const [competition, setCompetition] = useState<Competition | null | undefined>(undefined);
  const [match, setMatch] = useState<CompMatch | null | undefined>(undefined);
  const [equipes, setEquipes] = useState<CompTeam[]>([]);

  useEffect(() => {
    let vivant = true;
    lireCompetition(cid)
      .then((c) => {
        if (vivant) setCompetition(c);
      })
      .catch(() => {
        if (vivant) setCompetition(null);
      });
    return () => {
      vivant = false;
    };
  }, [cid]);

  useEffect(() => {
    if (!actif) return;
    const arrets = [ecouterMatchCompetition(cid, mid, setMatch), ecouterEquipesCompetition(cid, setEquipes)];
    return () => arrets.forEach((arret) => arret());
  }, [actif, cid, mid]);

  const fiche = useMemo(
    () => (match && competition ? ficheDepuisCompetition(match, competition, equipes) : null),
    [match, competition, equipes],
  );
  return {
    fiche,
    chargement: match === undefined || competition === undefined,
    introuvable: match === null || competition === null,
  };
}

/** Un amical, en temps réel. */
export function useFicheAmical(id: string): EtatDeLaFiche {
  const actif = usePremierPlan();
  const [match, setMatch] = useState<Match | null | undefined>(undefined);

  useEffect(() => {
    if (!actif) return;
    return ecouterAmical(id, setMatch);
  }, [actif, id]);

  const fiche = useMemo(() => (match ? ficheDepuisAmical(match) : null), [match]);
  return { fiche, chargement: match === undefined, introuvable: match === null };
}

/** L'heure, qui avance d'une seconde tant que `actif` : le chrono du tableau. */
export function useMaintenant(actif: boolean): number {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    if (!actif) return;
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, [actif]);
  return maintenant;
}
