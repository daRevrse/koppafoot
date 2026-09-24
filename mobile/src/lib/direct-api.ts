import type { CompetitionFeed } from "@/lib/direct-shared";
import { API_URL } from "~/lib/config";

/** GET /api/direct : le tableau tel que la page d'accueil du site l'affiche. */
export async function chargerDirect(): Promise<CompetitionFeed[]> {
  const reponse = await fetch(`${API_URL}/api/direct`);
  if (!reponse.ok) throw new Error(`/api/direct : ${reponse.status}`);
  const json = (await reponse.json()) as { board?: CompetitionFeed[] };
  return json.board ?? [];
}
