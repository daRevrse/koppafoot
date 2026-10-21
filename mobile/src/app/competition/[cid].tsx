import { useLocalSearchParams } from "expo-router";
import { EcranCompetition } from "~/components/competition/EcranCompetition";

/** La page d'une compétition. */
export default function PageDeCompetition() {
  const { cid } = useLocalSearchParams<{ cid: string }>();
  return <EcranCompetition cid={cid} />;
}
