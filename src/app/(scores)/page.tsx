import DirectHomeV2 from "@/components/direct/DirectHomeV2";
import { getDirectFeed } from "@/lib/competition-admin";

// Public home: the live-score "Direct" board, inside the scores shell
// (ScoreShell) rather than the general app shell. Every public competition
// and its fixtures are server-fetched (ISR) for first paint and SEO/shares;
// DirectHomeV2 then attaches a real-time listener per competition client-side.
export const revalidate = 60;

export default async function Home() {
  const feed = await getDirectFeed();
  return <DirectHomeV2 initialFeed={feed} />;
}
