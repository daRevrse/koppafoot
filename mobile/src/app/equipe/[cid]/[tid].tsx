import { useLocalSearchParams } from "expo-router";
import { EcranEquipe } from "~/components/equipe/EcranEquipe";

/** La page d'une équipe dans sa compétition. */
export default function PageDEquipe() {
  const { cid, tid } = useLocalSearchParams<{ cid: string; tid: string }>();
  return <EcranEquipe cid={cid} tid={tid} />;
}
