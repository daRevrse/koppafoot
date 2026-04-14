"use client";

import { Flame } from "lucide-react";

interface StreakBadgeProps {
  count: number;
}

export default function StreakBadge({ count }: StreakBadgeProps) {
  if (count <= 0) return null;

  return (
    <div className="flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-600">
      <Flame size={14} className="animate-pulse-soft text-accent-500" />
      <span>{count}</span>
    </div>
  );
}
