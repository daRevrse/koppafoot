import DirectHome from "@/components/direct/DirectHome";
import { getDirectFeed } from "@/lib/competition-admin";

// Public home: the live-score "Direct" page inside the general app shell.
// Every public competition and its fixtures are server-fetched (ISR) for
// first paint and SEO/shares; DirectHome then attaches a real-time listener
// per competition client-side.
export const revalidate = 60;

export default async function Home() {
  const feed = await getDirectFeed();
  return <DirectHome initialFeed={feed} />;
}
