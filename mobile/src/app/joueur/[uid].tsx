import { useLocalSearchParams } from "expo-router";
import { EcranJoueur } from "~/components/joueur/EcranJoueur";

/** La fiche d'un joueur. */
export default function PageDuJoueur() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return <EcranJoueur uid={uid} />;
}
