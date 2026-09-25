"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Booking, PlageOuverture, Venue } from "@/types";
import {
  JOURS, amplitude, aujourdhui, finCreneau, joursDeLaSemaine, lundiDe, placer, plageDuJour,
} from "@/lib/terrains";

// ============================================
// La semaine d'un terrain, d'un coup d'œil.
//
// LA LISTE DES DEMANDES NE MONTRAIT PAS UNE JOURNÉE. Triée par date, elle
// disait ce qui était demandé, pas ce qui restait libre : au téléphone avec
// une équipe, le propriétaire ne voyait pas où la caser. Ici, les heures en
// lignes, les jours en colonnes, et ce qui est pris par-dessus.
//
// DEUX GESTES, CEUX DU TÉLÉPHONE : toucher un créneau libre ouvre « Bloquer
// un créneau » prérempli ; toucher une réservation l'ouvre avec ses actions.
//
// SUR TÉLÉPHONE, UN JOUR À LA FOIS. Sept colonnes en 390 pixels font des
// créneaux de cinquante pixels de large, illisibles et intouchables.
// ============================================

/** Pixels par minute : une heure fait 48 pixels, une journée tient à l'écran. */
const PX = 0.8;

const ton = (b: Booking) =>
  b.kind === "blocage"
    ? "border-gray-400 bg-gray-200 text-gray-700"
    : b.status === "confirmed"
      ? "border-emerald-500 bg-emerald-100 text-emerald-900"
      : "border-amber-400 bg-amber-50 text-amber-900";

const titre = (b: Booking) =>
  b.kind === "blocage" ? (b.note || "Bloqué") : (b.matchLabel || b.userName || "Une équipe");

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Une journée : fermetures grisées, heures tracées, créneaux posés. */
function Journee({
  date,
  plage,
  reservations,
  debut,
  fin,
  choisie,
  onLibre,
  onReservation,
}: {
  date: string;
  plage: PlageOuverture | undefined;
  reservations: Booking[];
  debut: number;
  fin: number;
  choisie: string | null;
  onLibre: (time: string) => void;
  onReservation: (b: Booking) => void;
}) {
  const places = useMemo(() => placer(reservations, debut), [reservations, debut]);
  const hauteur = (fin - debut) * PX;

  // Ce qui est fermé ce jour-là : tout le jour, ou avant l'ouverture et après
  // la fermeture. Sans horaires (`undefined`), rien n'est grisé.
  const fermetures: { haut: number; hauteur: number }[] = [];
  if (plage === null) fermetures.push({ haut: 0, hauteur });
  else if (plage) {
    const [oh, om] = plage.ouvre.split(":").map(Number);
    const [fh, fm] = plage.ferme.split(":").map(Number);
    const o = oh * 60 + om, f = fh * 60 + fm;
    if (o > debut) fermetures.push({ haut: 0, hauteur: (o - debut) * PX });
    if (f < fin) fermetures.push({ haut: (f - debut) * PX, hauteur: (fin - f) * PX });
  }

  const toucher = (e: React.MouseEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    // Arrondi à la demi-heure en dessous : on ne bloque pas un 18:07.
    const minutes = debut + Math.floor(y / PX / 30) * 30;
    onLibre(hhmm(Math.min(Math.max(minutes, debut), fin - 30)));
  };

  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label={`Journée du ${date}`}
      onClick={toucher}
      className="relative cursor-copy border-l border-gray-200/70"
      style={{ height: hauteur }}
    >
      {fermetures.map((z, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,#f3f4f6_0,#f3f4f6_6px,#e5e7eb_6px,#e5e7eb_7px)]"
          style={{ top: z.haut, height: z.hauteur }}
        />
      ))}
      {Array.from({ length: (fin - debut) / 60 }, (_, i) => (
        <div key={i} aria-hidden className="absolute inset-x-0 border-t border-gray-100" style={{ top: i * 60 * PX }} />
      ))}
      {places.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={(e) => { e.stopPropagation(); onReservation(b); }}
          title={`${b.time} → ${finCreneau(b.time, b.duration)} · ${titre(b)}`}
          className={`absolute overflow-hidden border-l-4 px-1.5 py-1 text-left transition-shadow hover:shadow-md ${ton(b)} ${
            choisie === b.id ? "ring-2 ring-gray-900" : ""
          }`}
          style={{
            top: b.haut * PX,
            height: Math.max(b.hauteur * PX, 20),
            left: `${(b.colonne / b.colonnes) * 100}%`,
            width: `calc(${100 / b.colonnes}% - 2px)`,
          }}
        >
          <span className="block text-[10px] font-black leading-tight">{b.time}</span>
          <span className="block truncate text-[10px] font-bold leading-tight">{titre(b)}</span>
        </button>
      ))}
    </div>
  );
}

/** Les heures, dans la marge. */
function Graduations({ debut, fin }: { debut: number; fin: number }) {
  return (
    <div className="relative" style={{ height: (fin - debut) * PX }}>
      {Array.from({ length: (fin - debut) / 60 }, (_, i) => (
        <span
          key={i}
          className="absolute right-1.5 -translate-y-1/2 text-[9px] font-bold tabular-nums text-gray-400"
          style={{ top: i * 60 * PX }}
        >
          {i === 0 ? "" : hhmm(debut + i * 60)}
        </span>
      ))}
    </div>
  );
}

export default function PlanningSemaine({
  reservations,
  terrains,
  choisie,
  onCreneauLibre,
  onReservation,
}: {
  reservations: Booking[];
  terrains: Venue[];
  choisie: string | null;
  onCreneauLibre: (venueId: string, date: string, time: string) => void;
  onReservation: (b: Booking) => void;
}) {
  const aujourdhuiIso = aujourdhui();
  const [venueId, setVenueId] = useState(terrains[0]?.id ?? "");
  const [decalage, setDecalage] = useState(0);
  const jours = useMemo(() => joursDeLaSemaine(lundiDe(aujourdhuiIso), decalage), [aujourdhuiIso, decalage]);
  // Sur téléphone, le jour montré : aujourd'hui dans la semaine courante, le
  // lundi sinon.
  const [jourChoisi, setJourChoisi] = useState(() => Math.max(0, jours.indexOf(aujourdhuiIso)));

  const terrain = terrains.find((v) => v.id === venueId) ?? terrains[0];

  // Ce qui occupe le terrain cette semaine : demandes en attente, créneaux
  // confirmés, blocages. Les refus et annulations ne prennent pas de place.
  const semaine = useMemo(
    () => reservations.filter((b) =>
      b.venueId === terrain?.id
      && (b.status === "pending" || b.status === "confirmed")
      && b.date >= jours[0] && b.date <= jours[6]),
    [reservations, terrain?.id, jours],
  );
  const { debut, fin } = amplitude(terrain?.openingHours ?? null, semaine);

  const libelleJour = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    const j = JOURS.find((x) => x.cle === String(d.getDay()));
    return { court: j?.court ?? "", numero: d.getDate() };
  };
  const debutSemaine = new Date(`${jours[0]}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

  const changerSemaine = (pas: number) => {
    setDecalage((d) => d + pas);
    setJourChoisi(0);
  };

  if (!terrain) return null;

  const journee = (date: string) => (
    <Journee
      date={date}
      plage={plageDuJour(terrain.openingHours, date)}
      reservations={semaine.filter((b) => b.date === date)}
      debut={debut}
      fin={fin}
      choisie={choisie}
      onLibre={(time) => onCreneauLibre(terrain.id, date, time)}
      onReservation={onReservation}
    />
  );

  return (
    <div className="mt-6 border border-gray-200/70 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/70 px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => changerSemaine(-1)}
            aria-label="Semaine précédente"
            className="border border-gray-200/70 p-2 text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900"
          >
            <ChevronLeft size={14} />
          </button>
          <p className="min-w-[9rem] text-center text-[11px] font-black uppercase tracking-[0.1em] text-gray-900">
            Semaine du {debutSemaine}
          </p>
          <button
            type="button"
            onClick={() => changerSemaine(1)}
            aria-label="Semaine suivante"
            className="border border-gray-200/70 p-2 text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900"
          >
            <ChevronRight size={14} />
          </button>
          {decalage !== 0 && (
            <button
              type="button"
              onClick={() => { setDecalage(0); setJourChoisi(Math.max(0, joursDeLaSemaine(lundiDe(aujourdhuiIso)).indexOf(aujourdhuiIso))); }}
              className="ml-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 hover:text-gray-900"
            >
              Aujourd&apos;hui
            </button>
          )}
        </div>
        {terrains.length > 1 && (
          <select
            value={terrain.id}
            onChange={(e) => setVenueId(e.target.value)}
            aria-label="Terrain affiché"
            className="border border-gray-200/70 bg-white px-3 py-2 text-xs font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
          >
            {terrains.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        )}
      </div>

      {/* La légende : trois couleurs, et le geste. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-gray-200/70 px-4 py-2.5 text-[10px] font-bold text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 border-l-4 border-amber-400 bg-amber-50" />En attente</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 border-l-4 border-emerald-500 bg-emerald-100" />Confirmé</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 border-l-4 border-gray-400 bg-gray-200" />Bloqué</span>
        <span className="text-gray-400">Touchez un créneau libre pour le bloquer.</span>
      </div>

      {/* ─── Ordinateur : la semaine ─── */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-gray-200/70">
          <span />
          {jours.map((d) => {
            const { court, numero } = libelleJour(d);
            const auj = d === aujourdhuiIso;
            return (
              <p key={d} className={`border-l border-gray-200/70 py-2 text-center text-[10px] font-black uppercase tracking-[0.1em] ${auj ? "bg-emerald-50 text-emerald-800" : "text-gray-500"}`}>
                {court} {numero}
              </p>
            );
          })}
        </div>
        <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] py-2">
          <Graduations debut={debut} fin={fin} />
          {jours.map((d) => <div key={d}>{journee(d)}</div>)}
        </div>
      </div>

      {/* ─── Téléphone : un jour à la fois ─── */}
      <div className="sm:hidden">
        <div className="grid grid-cols-7 border-b border-gray-200/70">
          {jours.map((d, i) => {
            const { court, numero } = libelleJour(d);
            const actif = i === jourChoisi;
            const occupe = semaine.some((b) => b.date === d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => setJourChoisi(i)}
                aria-pressed={actif}
                className={`relative py-2 text-center transition-colors ${actif ? "bg-gray-900 text-white" : d === aujourdhuiIso ? "text-emerald-700" : "text-gray-500"}`}
              >
                <span className="block text-[9px] font-black uppercase">{court.replace(".", "")}</span>
                <span className="block text-sm font-black">{numero}</span>
                {occupe && (
                  <span aria-hidden className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${actif ? "bg-white" : "bg-emerald-500"}`} />
                )}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-[3rem_minmax(0,1fr)] py-2 pr-2">
          <Graduations debut={debut} fin={fin} />
          {journee(jours[jourChoisi] ?? jours[0])}
        </div>
      </div>
    </div>
  );
}
