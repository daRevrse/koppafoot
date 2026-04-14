"use client";

import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  value: string | number;
  label: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: string; // tailwind bg color class
  delay?: number;
}

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

const TREND_COLORS = {
  up: "text-emerald-500",
  down: "text-red-500",
  neutral: "text-gray-400",
};

export default function StatCard({ icon: Icon, value, label, trend, trendValue, color = "bg-primary-50", delay = 0 }: StatCardProps) {
  const TrendIcon = trend ? TREND_ICONS[trend] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon size={20} className="text-primary-600" />
        </div>
        {trend && TrendIcon && (
          <div className={`flex items-center gap-1 text-xs font-medium ${TREND_COLORS[trend]}`}>
            <TrendIcon size={14} />
            {trendValue}
          </div>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900 font-display">{value}</p>
      <p className="mt-0.5 text-sm text-gray-500">{label}</p>
    </motion.div>
  );
}
