"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import LiveMatchConsole from "@/components/competition/LiveMatchConsole";
import { piloteCompetition } from "@/lib/console-pilote";

export default function LiveOpsMatchConsole() {
  const { cid, mid } = useParams() as { cid: string; mid: string };
  // Mémoïsé : le pilote est en dépendance des abonnements de la console, un
  // objet neuf à chaque rendu les démonterait en boucle.
  const pilote = useMemo(() => piloteCompetition(cid, mid), [cid, mid]);
  return (
    <LiveMatchConsole pilote={pilote} returnHref={`/live-ops/${cid}`} />
  );
}
