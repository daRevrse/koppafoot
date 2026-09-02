"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import LiveMatchConsole from "@/components/competition/LiveMatchConsole";
import { piloteCompetition } from "@/lib/console-pilote";

export default function OrganizerLiveMatchPage() {
  const { cid, mid } = useParams() as { cid: string; mid: string };
  // Voir la note du même écran côté live-ops : le pilote doit être stable.
  const pilote = useMemo(() => piloteCompetition(cid, mid), [cid, mid]);
  return (
    <LiveMatchConsole
      pilote={pilote}
      returnHref={`/organizer/competitions/${cid}/schedule`}
    />
  );
}
