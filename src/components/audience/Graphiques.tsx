"use client";

import { useMemo, useState } from "react";
import {
  heureDeMinute, jourLisible, VIAS,
  type ButSurLaCourbe, type JourDeCompetition, type PointDeCourbe, type Via,
} from "@/lib/audience";

// ============================================
// Les graphiques de la mesure d'audience, partagés par l'administration et la
// page Statistiques des organisateurs.
//
// DEUX SÉRIES, DEUX TEINTES VALIDÉES (outil dataviz, clair et sombre) : les
// pages de la compétition en bleu, ses matchs dans le vert de la marque. Le
// texte ne porte jamais la couleur d'une série — elle vit sur la marque, à
// côté du libellé. Les grilles prennent `currentColor`, que le thème sombre
// repeint (styles/dark.css).
// ============================================

export const COULEUR_PAGES = "#0284c7";
export const COULEUR_MATCHS = "#059669";

export const LIBELLE_VIA: Record<Via, string> = {
  app: "Appli",
  qr: "QR code",
  partage: "Lien partagé",
  autre: "Autre",
};

const jourCourt = (jour: string) => {
  const d = new Date(Date.UTC(Number(jour.slice(0, 4)), Number(jour.slice(4, 6)) - 1, Number(jour.slice(6, 8))));
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
};

function Cle({ couleur, libelle }: { couleur: string; libelle: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: couleur }} aria-hidden />
      {libelle}
    </span>
  );
}

/** Les visites jour par jour : pages et matchs empilés, une colonne par jour. */
export function BarresParJour({ jours }: { jours: JourDeCompetition[] }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const max = Math.max(1, ...jours.map((j) => j.pages + j.matchs));
  if (jours.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Aucune visite sur la période.</p>;
  }
  const actif = survol != null ? jours[survol] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <Cle couleur={COULEUR_PAGES} libelle="Pages de la compétition" />
        <Cle couleur={COULEUR_MATCHS} libelle="Fiches de match" />
        <span className="ml-auto text-xs font-bold tabular-nums text-gray-900">
          {actif ? `${jourLisible(actif.jour)} · ${actif.pages + actif.matchs} visites` : `max ${max} / jour`}
        </span>
      </div>
      <div className="relative flex h-40 items-end gap-[2px] border-b border-gray-200/70" role="list">
        {jours.map((j, i) => {
          const total = j.pages + j.matchs;
          return (
            <button
              key={j.jour}
              type="button"
              role="listitem"
              onPointerEnter={() => setSurvol(i)}
              onPointerLeave={() => setSurvol(null)}
              onFocus={() => setSurvol(i)}
              onBlur={() => setSurvol(null)}
              aria-label={`${jourLisible(j.jour)} : ${j.pages} visites des pages, ${j.matchs} des matchs`}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end outline-none"
            >
              <span
                className="flex w-full max-w-6 flex-col justify-end gap-[2px] transition-opacity"
                style={{ height: `${(total / max) * 100}%`, opacity: survol == null || survol === i ? 1 : 0.45 }}
              >
                {j.matchs > 0 && (
                  <span className="w-full rounded-t" style={{ flexGrow: j.matchs, backgroundColor: COULEUR_MATCHS }} />
                )}
                {j.pages > 0 && (
                  <span
                    className={`w-full ${j.matchs > 0 ? "" : "rounded-t"}`}
                    style={{ flexGrow: j.pages, backgroundColor: COULEUR_PAGES }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-gray-400">
        <span>{jourCourt(jours[0].jour)}</span>
        {jours.length > 2 && <span>{jourCourt(jours[Math.floor(jours.length / 2)].jour)}</span>}
        {jours.length > 1 && <span>{jourCourt(jours[jours.length - 1].jour)}</span>}
      </div>
      <details className="mt-2 text-xs text-gray-500">
        <summary className="cursor-pointer font-semibold">Voir le tableau</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead>
            <tr className="text-gray-400">
              <th className="py-1 font-semibold">Jour</th>
              <th className="py-1 text-right font-semibold">Pages</th>
              <th className="py-1 text-right font-semibold">Matchs</th>
            </tr>
          </thead>
          <tbody>
            {jours.map((j) => (
              <tr key={j.jour} className="border-t border-gray-100">
                <td className="py-1">{jourLisible(j.jour)}</td>
                <td className="py-1 text-right">{j.pages}</td>
                <td className="py-1 text-right">{j.matchs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

const L = 600;
const H = 180;
const MARGE = { haut: 22, bas: 22, gauche: 28, droite: 8 };

/**
 * La courbe d'un direct, minute par minute, buts posés dessus. Le réticule
 * suit le pointeur et lit la minute la plus proche.
 */
export function CourbeDuDirect({ points, buts, pic }: {
  points: PointDeCourbe[];
  buts: ButSurLaCourbe[];
  pic: PointDeCourbe | null;
}) {
  const [survol, setSurvol] = useState<number | null>(null);
  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const debut = points[0].minute;
    const fin = points[points.length - 1].minute;
    const etendue = Math.max(1, fin - debut);
    const max = Math.max(1, ...points.map((p) => p.spectateurs));
    const x = (m: number) => MARGE.gauche + ((m - debut) / etendue) * (L - MARGE.gauche - MARGE.droite);
    const y = (n: number) => H - MARGE.bas - (n / max) * (H - MARGE.haut - MARGE.bas);
    const ligne = points.map((p) => `${x(p.minute).toFixed(1)},${y(p.spectateurs).toFixed(1)}`).join(" ");
    const aire = `${x(debut).toFixed(1)},${y(0)} ${ligne} ${x(fin).toFixed(1)},${y(0)}`;
    // Une graduation par quart d'heure, au plus six.
    const pas = Math.max(15, Math.ceil(etendue / 6 / 15) * 15);
    const graduations: number[] = [];
    for (let m = Math.ceil(debut / pas) * pas; m <= fin; m += pas) graduations.push(m);
    return { debut, fin, max, x, y, ligne, aire, graduations };
  }, [points]);

  if (!geo) {
    return <p className="py-8 text-center text-sm text-gray-400">Personne n&apos;a suivi ce match en direct.</p>;
  }
  const actif = survol != null ? points[survol] : null;
  const butsActifs = actif ? buts.filter((b) => b.minute === actif.minute) : [];

  const auPointeur = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const xv = ((e.clientX - r.left) / r.width) * L;
    const m = geo.debut + ((xv - MARGE.gauche) / (L - MARGE.gauche - MARGE.droite)) * (geo.fin - geo.debut);
    const i = Math.round(m - geo.debut);
    setSurvol(Math.min(points.length - 1, Math.max(0, i)));
  };

  return (
    <div>
      <div className="mb-2 flex min-h-5 flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="text-gray-500">Spectateurs simultanés, minute par minute</span>
        <span className="font-bold tabular-nums text-gray-900">
          {actif
            ? `${actif.spectateurs} à ${heureDeMinute(actif.minute)}${butsActifs.length ? ` · ⚽ ${butsActifs.map((b) => b.libelle).join(", ")}` : ""}`
            : pic ? `Pic : ${pic.spectateurs} à ${heureDeMinute(pic.minute)}` : ""}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${L} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`Courbe d'audience : pic de ${pic?.spectateurs ?? 0} spectateurs${pic ? ` à ${heureDeMinute(pic.minute)}` : ""}`}
        onPointerMove={auPointeur}
        onPointerDown={auPointeur}
        onPointerLeave={() => setSurvol(null)}
      >
        <g className="text-gray-200" stroke="currentColor" strokeWidth={1}>
          <line x1={MARGE.gauche} x2={L - MARGE.droite} y1={geo.y(0)} y2={geo.y(0)} />
          <line x1={MARGE.gauche} x2={L - MARGE.droite} y1={geo.y(geo.max)} y2={geo.y(geo.max)} />
        </g>
        <g className="text-gray-400" fill="currentColor" fontSize={10}>
          <text x={MARGE.gauche - 6} y={geo.y(0) + 3} textAnchor="end">0</text>
          <text x={MARGE.gauche - 6} y={geo.y(geo.max) + 3} textAnchor="end">{geo.max}</text>
          {geo.graduations.map((m) => (
            <text key={m} x={geo.x(m)} y={H - 6} textAnchor="middle">{heureDeMinute(m)}</text>
          ))}
        </g>
        {/* Les buts : un trait discret, le ballon au-dessus. */}
        <g className="text-gray-300" stroke="currentColor" strokeWidth={1}>
          {buts.filter((b) => b.minute >= geo.debut && b.minute <= geo.fin).map((b, i) => (
            <line key={i} x1={geo.x(b.minute)} x2={geo.x(b.minute)} y1={MARGE.haut - 4} y2={geo.y(0)} />
          ))}
        </g>
        {buts.filter((b) => b.minute >= geo.debut && b.minute <= geo.fin).map((b, i) => (
          <text key={`b${i}`} x={geo.x(b.minute)} y={MARGE.haut - 8} textAnchor="middle" fontSize={11}>⚽</text>
        ))}
        <polygon points={geo.aire} fill={COULEUR_MATCHS} fillOpacity={0.1} />
        <polyline points={geo.ligne} fill="none" stroke={COULEUR_MATCHS} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pic && (
          <circle cx={geo.x(pic.minute)} cy={geo.y(pic.spectateurs)} r={4.5} fill={COULEUR_MATCHS}
            stroke="var(--k-surface, #ffffff)" strokeWidth={2} />
        )}
        {actif && (
          <g>
            <line x1={geo.x(actif.minute)} x2={geo.x(actif.minute)} y1={MARGE.haut} y2={geo.y(0)}
              className="text-gray-400" stroke="currentColor" strokeWidth={1} />
            <circle cx={geo.x(actif.minute)} cy={geo.y(actif.spectateurs)} r={4} fill={COULEUR_MATCHS}
              stroke="var(--k-surface, #ffffff)" strokeWidth={2} />
          </g>
        )}
      </svg>
    </div>
  );
}

/** D'où viennent les visites : une barre par provenance, la part au bout. */
export function Provenance({ provenance }: { provenance: Record<Via, number> }) {
  const total = VIAS.reduce((n, v) => n + provenance[v], 0);
  if (total === 0) return <p className="text-sm text-gray-400">Aucune visite sur la période.</p>;
  return (
    <div className="space-y-2.5">
      {VIAS.map((v) => {
        const part = provenance[v] / total;
        return (
          <div key={v} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm font-semibold text-gray-700">{LIBELLE_VIA[v]}</span>
            <span className="h-2 flex-1 bg-gray-100">
              <span className="block h-full rounded-r" style={{ width: `${part * 100}%`, backgroundColor: COULEUR_MATCHS }} />
            </span>
            <span className="w-16 shrink-0 text-right text-sm font-bold tabular-nums text-gray-900">
              {Math.round(part * 100)} %
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Ce que les chiffres comptent, et ce qu'ils ne comptent pas : sous chaque écran. */
export function CeQueCaCompte({ depuis }: { depuis: string }) {
  return (
    <p className="text-xs leading-relaxed text-gray-400">
      Mesuré depuis le {jourLisible(depuis)}. On compte des appareils, pas des personnes : une visite = un
      appareil, un jour, une page. Un écran éteint ou un onglet en arrière-plan ne compte pas comme spectateur.
    </p>
  );
}
