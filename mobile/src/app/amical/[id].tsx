import { useLocalSearchParams } from "expo-router";
import { EcranFiche } from "~/components/fiche/EcranFiche";
import { EtatFiche } from "~/components/fiche/EtatFiche";
import { useFicheAmical } from "~/hooks/useFiche";

/** La fiche d'un amical. */
export default function FicheAmicale() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { fiche, introuvable } = useFicheAmical(id);
  return fiche ? <EcranFiche fiche={fiche} /> : <EtatFiche introuvable={introuvable} />;
}
