"use client";

import { Trophy, ListOrdered, LayoutGrid, GitBranch, Check } from "lucide-react";
import { COMPETITION_TYPES } from "@/lib/competition-format";
import type { CompetitionType } from "@/types";

// ============================================
// Type picker, four cards, one per competition shape. Shown at creation and
// (read-only, with a warning) once fixtures exist.
// ============================================

const ICONS: Record<CompetitionType, typeof Trophy> = {
  cup: GitBranch,
  league: ListOrdered,
  groups_knockout: LayoutGrid,
  league_playoffs: Trophy,
};

export default function CompetitionTypePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: CompetitionType;
  onChange: (type: CompetitionType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {COMPETITION_TYPES.map(({ type, label, tagline, details }) => {
        const Icon = ICONS[type];
        const selected = value === type;
        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onChange(type)}
            className={` border-2 p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
              selected
                ? "border-primary-500 bg-primary-50/40"
                : "border-gray-200/70 bg-white hover:border-primary-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center ${
                  selected ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                <Icon size={18} />
              </div>
              {selected && (
                <span className="flex items-center gap-1 rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  <Check size={10} /> Choisi
                </span>
              )}
            </div>
            <p className="mt-3 text-sm font-bold text-gray-900">{label}</p>
            <p className="text-xs font-medium text-gray-400">{tagline}</p>
            <ul className="mt-3 space-y-1">
              {details.map((d) => (
                <li key={d} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-500">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-300" />
                  {d}
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
