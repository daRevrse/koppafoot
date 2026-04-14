"use client";

import { motion } from "motion/react";

interface XPProgressBarProps {
  currentXP: number;
  requiredXP: number;
  level: number;
}

export default function XPProgressBar({ currentXP, requiredXP, level }: XPProgressBarProps) {
  const percentage = Math.min((currentXP / requiredXP) * 100, 100);

  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white font-display">
        {level}
      </span>
      <div className="flex-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-700">{currentXP} XP</span>
          <span className="text-gray-400">{requiredXP} XP</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full bg-accent-500"
          />
        </div>
      </div>
    </div>
  );
}
