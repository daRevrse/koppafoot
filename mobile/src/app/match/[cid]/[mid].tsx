import { useLocalSearchParams } from "expo-router";
import { EcranFiche } from "~/components/fiche/EcranFiche";
import { EtatFiche } from "~/components/fiche/EtatFiche";
import { useFicheCompetition } from "~/hooks/useFiche";

/** La fiche d'une rencontre de compétition. */
export default function FicheDeCompetition() {
  const { cid, mid } = useLocalSearchParams<{ cid: string; mid: string }>();
  const { fiche, introuvable } = useFicheCompetition(cid, mid);
  return fiche ? <EcranFiche fiche={fiche} /> : <EtatFiche introuvable={introuvable} />;
}
