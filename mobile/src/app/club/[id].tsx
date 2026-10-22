import { useLocalSearchParams } from "expo-router";
import { EcranClub } from "~/components/club/EcranClub";

/** La fiche d'un club. */
export default function PageDuClub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EcranClub id={id} />;
}
