import DirectHome from "@/components/direct/DirectHome";
import { getPublicCompetitions } from "@/lib/competition-admin";

// Public home: the live-score "Direct" page inside the general app shell.
// Competitions are server-fetched (ISR) for first paint and SEO/shares;
// DirectHome then subscribes to real-time updates client-side.
export const revalidate = 60;

export default async function Home() {
  const competitions = await getPublicCompetitions();
  return <DirectHome initialCompetitions={competitions} />;
}
