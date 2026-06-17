"use client";

import { useParams } from "next/navigation";
import LiveMatchConsole from "@/components/competition/LiveMatchConsole";

export default function LiveOpsMatchConsole() {
  const { cid, mid } = useParams() as { cid: string; mid: string };
  return (
    <LiveMatchConsole cid={cid} mid={mid} returnHref={`/live-ops/${cid}`} />
  );
}
