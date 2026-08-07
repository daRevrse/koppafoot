"use client";

import { hasGroupStage, hasKnockout, isSingleGroup } from "@/lib/competition-format";
import type { CompetitionFormat, CompetitionType } from "@/types";

// ============================================
// Format fields — the inputs that make sense for the picked type. Shared by
// the creation page and the organizer's format editor so the two can never
// drift apart.
// ============================================

const numberClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none";

function NumberField({
  label,
  hint,
  min,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="number"
        min={min}
        className={numberClass}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

export default function CompetitionFormatFields({
  type,
  format,
  onChange,
}: {
  type: CompetitionType;
  format: CompetitionFormat;
  onChange: (patch: Partial<CompetitionFormat>) => void;
}) {
  const groups = hasGroupStage(type);
  const knockout = hasKnockout(type);
  const single = isSingleGroup(type);

  return (
    <div className="space-y-5">
      {/* Group / league stage */}
      {groups && (
        <div className="grid gap-5 sm:grid-cols-3">
          {!single && (
            <NumberField
              label="Nombre de groupes"
              min={1}
              value={format.group_count}
              onChange={(v) => onChange({ group_count: v })}
            />
          )}
          <NumberField
            label={single ? "Nombre d'équipes" : "Équipes / groupe"}
            min={2}
            value={format.teams_per_group}
            onChange={(v) => onChange({ teams_per_group: v })}
          />
          {!single && knockout && (
            <NumberField
              label="Qualifiés / groupe"
              min={1}
              value={format.qualifiers_per_group}
              onChange={(v) => onChange({ qualifiers_per_group: v })}
            />
          )}
          {single && knockout && (
            <NumberField
              label="Qualifiés en play-offs"
              hint="Arrondi à la puissance de 2 inférieure"
              min={2}
              value={format.knockout_teams ?? 4}
              onChange={(v) => onChange({ knockout_teams: v })}
            />
          )}
        </div>
      )}

      {/* Cup bracket size */}
      {!groups && knockout && (
        <div className="grid gap-5 sm:grid-cols-3">
          <NumberField
            label="Équipes dans le tableau"
            hint="Arrondi à la puissance de 2 inférieure (max 16)"
            min={2}
            value={format.knockout_teams ?? 8}
            onChange={(v) => onChange({ knockout_teams: v })}
          />
        </div>
      )}

      <div className="space-y-3">
        {groups && (
          <CheckField
            label="Aller-retour (chaque affiche jouée deux fois)"
            checked={!!format.double_round}
            onChange={(v) => onChange({ double_round: v })}
          />
        )}
        {knockout && (
          <CheckField
            label="Match pour la 3ᵉ place"
            checked={format.has_third_place}
            onChange={(v) => onChange({ has_third_place: v })}
          />
        )}
      </div>

      {/* Points — only meaningful when a table is computed */}
      {groups && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Points</p>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Victoire</label>
              <input
                type="number"
                min={0}
                className={numberClass}
                value={format.points.win}
                onChange={(e) =>
                  onChange({ points: { ...format.points, win: parseInt(e.target.value, 10) || 0 } })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Nul</label>
              <input
                type="number"
                min={0}
                className={numberClass}
                value={format.points.draw}
                onChange={(e) =>
                  onChange({ points: { ...format.points, draw: parseInt(e.target.value, 10) || 0 } })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Défaite</label>
              <input
                type="number"
                min={0}
                className={numberClass}
                value={format.points.loss}
                onChange={(e) =>
                  onChange({ points: { ...format.points, loss: parseInt(e.target.value, 10) || 0 } })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
