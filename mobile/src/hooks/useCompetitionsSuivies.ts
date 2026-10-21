import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import type { Competition } from "@/types";
import { lireCompetitions } from "~/lib/direct-firestore";

/**
 * Les compétitions suivies, relues à chaque arrivée sur l'onglet.
 *
 * UNE COMPÉTITION QU'ON VIENT D'ARRÊTER DE SUIVRE RESTE AFFICHÉE, étoile
 * vide, jusqu'à ce qu'on quitte l'onglet : un appui raté se rattrape d'un
 * second appui. `garder` la retient ; la sortie de l'onglet l'oublie. Comme
 * elle reste dans la liste lue, l'arrêt du suivi ne déclenche aucune relecture.
 */
export function useCompetitionsSuivies(suivies: readonly string[]) {
  const [gardees, setGardees] = useState<ReadonlySet<string>>(() => new Set());
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [erreur, setErreur] = useState(false);

  // Une chaîne : `suivies` change d'identité à chaque rendu, la liste non.
  const cle = useMemo(() => [...new Set([...suivies, ...gardees])].sort().join(","), [suivies, gardees]);

  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      lireCompetitions(cle ? cle.split(",") : [])
        .then((lues) => {
          if (!vivant) return;
          setCompetitions(lues);
          setErreur(false);
        })
        .catch(() => {
          if (vivant) setErreur(true);
        });
      return () => {
        vivant = false;
      };
    }, [cle]),
  );

  // La sortie de l'onglet oublie les compétitions gardées.
  useFocusEffect(useCallback(() => () => setGardees(new Set()), []));

  const garder = useCallback((cid: string) => setGardees((g) => new Set(g).add(cid)), []);

  return { competitions, erreur, garder };
}
