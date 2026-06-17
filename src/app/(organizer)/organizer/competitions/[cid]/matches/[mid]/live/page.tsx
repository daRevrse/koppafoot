"use client";

import { useParams } from "next/navigation";
import LiveMatchConsole from "@/components/competition/LiveMatchConsole";

export default function OrganizerLiveMatchPage() {
  const { cid, mid } = useParams() as { cid: string; mid: string };
  return (
    <LiveMatchConsole
      cid={cid}
      mid={mid}
      returnHref={`/organizer/competitions/${cid}/schedule`}
    />
  );
}
