import { Suspense } from "react";
import DirectHome from "@/components/direct/DirectHome";
import { getPublicCompetitions } from "@/lib/competition-admin";

// Public home: the live-score "Direct" page inside the general app shell.
// Competitions are server-fetched (ISR) for first paint and SEO/shares;
// DirectHome then subscribes to real-time updates client-side.
// Suspense is required because DirectHome reads useSearchParams (?c=slug).
export const revalidate = 60;

export default async function Home() {
  const competitions = await getPublicCompetitions();
  return (
    <Suspense fallback={null}>
      <DirectHome initialCompetitions={competitions} />
    </Suspense>
  );
}
