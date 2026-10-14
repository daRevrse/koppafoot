"use client";

import {
  hasGroupStage, hasKnockout, isSingleGroup,
  halfDuration, matchDuration, teamSize, TEAM_SIZE_OPTIONS,
  extraTime, extraTimeDuration, minPlayers, reentryAllowed, subsMax,
} from "@/lib/competition-format";
import type { CompetitionFormat, CompetitionType } from "@/types";

// ============================================
// Format fields, the inputs that make sense for the picked type. Shared by
// the creation page and the organizer's format editor so the two can never
// drift apart.
// ============================================

const numberClass =
  "w-full border border-gray-200/70 px-4 py-2 focus:border-primary-500 focus:outline-none";

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
        className="h-4 w-4 rounded border-gray-200/70 text-primary-600 focus:ring-primary-500"
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
  const size = teamSize(format);
  const half = halfDuration(format);

  return (
    <div className="space-y-5">
      {/* Règles du jeu, vraies pour toutes les formes de tournoi. Le NvN
          plafonne les titulaires de la feuille de match et la durée cale
          l'horloge de la console live. */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Type de jeu</label>
          <select
            className={numberClass}
            value={size}
            onChange={(e) => onChange({ team_size: parseInt(e.target.value, 10) })}
          >
            {TEAM_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} contre {n} ({n}v{n})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Joueurs par équipe sur le terrain, gardien compris
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Durée d&apos;une mi-temps
          </label>
          <div className="relative">
            <input
              type="number"
              min={1}
              max={60}
              className={`${numberClass} pr-12`}
              value={half}
              onChange={(e) => onChange({ half_duration: parseInt(e.target.value, 10) || 0 })}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              min
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Match de 2 × {half} min, soit {matchDuration(format)} min de jeu
          </p>
        </div>
      </div>

      {/* LES RÈGLES DU MATCH, que la console applique sur chaque rencontre.
          Leurs valeurs par défaut suivent le format — illimités et volants à
          huit et moins, cinq et définitifs au-delà — et l'organisateur les
          change ici. */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Changements</label>
          <select
            className={numberClass}
            value={subsMax(format) === null ? "illimites" : String(subsMax(format))}
            onChange={(e) =>
              onChange(
                e.target.value === "illimites"
                  ? { unlimited_subs: true }
                  : { unlimited_subs: false, subs_max: parseInt(e.target.value, 10) },
              )
            }
          >
            <option value="3">3 par équipe</option>
            <option value="5">5 par équipe</option>
            <option value="illimites">Illimités</option>
          </select>
          <div className="mt-2">
            <CheckField
              label="Un joueur sorti peut revenir"
              checked={reentryAllowed(format)}
              onChange={(v) => onChange({ subs_return: v })}
            />
          </div>
        </div>
        <NumberField
          label="Minimum de joueurs sur le terrain"
          hint="En dessous, l'arbitre arrête le match et l'équipe perd par forfait"
          min={1}
          value={minPlayers(format)}
          onChange={(v) => onChange({ min_players: Math.min(size, Math.max(1, v)) })}
        />
      </div>

      {/* Les prolongations n'ont de sens qu'en élimination directe. */}
      {knockout && (
        <div>
          <CheckField
            label="Prolongations en cas d'égalité"
            checked={extraTime(format)}
            onChange={(v) => onChange({ extra_time: v })}
          />
          {extraTime(format) ? (
            <div className="mt-3 max-w-xs pl-7">
              <NumberField
                label="Durée d'une prolongation (min)"
                hint={`2 × ${extraTimeDuration(format)} min, puis tirs au but`}
                min={1}
                value={extraTimeDuration(format)}
                onChange={(v) => onChange({ extra_time_duration: v })}
              />
            </div>
          ) : (
            <p className="mt-1 pl-7 text-xs text-gray-400">
              À égalité, le match passe directement aux tirs au but.
            </p>
          )}
        </div>
      )}

      <div className="border-t border-gray-200/70" />

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

      {/* Points, only meaningful when a table is computed */}
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
