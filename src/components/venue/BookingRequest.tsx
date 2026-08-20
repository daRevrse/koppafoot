"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Loader2, Check } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { createBooking } from "@/lib/firestore";

// ============================================
// Demander un créneau sur un terrain.
//
// Le geste est volontairement pauvre : une date, une heure, une durée. Pas
// de paiement, pas de contrat, la plateforme met les deux parties d'accord
// sur un moment, le reste se règle entre elles, comme aujourd'hui.
//
// Une demande naît toujours « en attente ». C'est le propriétaire qui
// confirme, et les règles Firestore le tiennent : un demandeur ne peut pas
// écrire une réservation déjà confirmée.
//
// Les créneaux déjà pris sont affichés au-dessus du formulaire. On ne les
// bloque pas techniquement, deux personnes peuvent demander le même samedi,
// c'est au propriétaire d'arbitrer, mais les cacher aurait fabriqué des
// demandes vouées au refus.
// ============================================

interface Slot {
  date: string;
  time: string;
  duration: number;
}

const DURATIONS = [
  { value: 1, label: "1 h" },
  { value: 1.5, label: "1 h 30" },
  { value: 2, label: "2 h" },
  { value: 3, label: "3 h" },
];

/** « samedi 23 août », la date d'un créneau, telle qu'on la dit. */
function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

const todayKey = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function BookingRequest({ venueId, venueName, ownerId, available }: {
  venueId: string;
  venueName: string;
  ownerId: string;
  available: boolean;
}) {
  const { user, loading: authLoading } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState(1.5);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/public/venue/${encodeURIComponent(venueId)}/slots`)
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((d) => { if (alive) setSlots(d.slots ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [venueId]);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await createBooking({
        venueId,
        venueName,
        ownerId,
        userId: user.uid,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        date,
        time,
        duration,
      });
      setSent(true);
      toast.success("Demande envoyée");
    } catch (err) {
      console.error("Booking request failed:", err);
      toast.error("La demande n'a pas pu être envoyée");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 border border-gray-200/70 bg-white p-6">
      <h2 className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
        Réserver un créneau
      </h2>

      {slots.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-bold text-gray-500">Déjà pris :</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {slots.slice(0, 8).map((s, i) => (
              <li
                key={`${s.date}-${s.time}-${i}`}
                className="border border-gray-200/70 bg-gray-50 px-3 py-1.5 text-[11px] font-bold text-gray-500"
              >
                {longDate(s.date)} · {s.time}
                {s.duration ? ` (${s.duration} h)` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!available ? (
        <p className="mt-4 text-sm leading-relaxed text-gray-500">
          Ce terrain est marqué <strong className="font-black text-gray-900">fermé</strong> par
          son propriétaire. Il ne prend pas de demande pour le moment.
        </p>
      ) : authLoading ? (
        <div className="mt-6 flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      ) : !user ? (
        <>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-500">
            Demander un créneau demande un compte : le propriétaire doit savoir
            à qui il confie son terrain, et vous devez pouvoir suivre sa réponse.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
          >
            Créer mon compte
          </Link>
        </>
      ) : sent ? (
        <div className="mt-5 flex items-start gap-3 border border-emerald-200 bg-emerald-50 p-4">
          <Check size={17} className="mt-0.5 shrink-0 text-emerald-600" />
          <p className="text-sm font-semibold leading-relaxed text-emerald-900">
            Demande envoyée pour le {longDate(date)} à {time}. Le propriétaire
            la confirme ou la refuse, vous la suivrez dans{" "}
            <Link href="/mes-reservations" className="underline">mes réservations</Link>.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="booking-date" className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                Date
              </label>
              <input
                id="booking-date"
                type="date"
                value={date}
                min={todayKey()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="booking-time" className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                Heure
              </label>
              <input
                id="booking-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Durée</p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDuration(d.value)}
                  className={`border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
                    duration === d.value
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={busy || !date || !time}
            className="mt-6 flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700 disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CalendarDays size={14} />}
            Demander ce créneau
          </button>

          <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
            Rien n&apos;est payé ni garanti ici : le propriétaire reçoit la
            demande et décide.
          </p>
        </>
      )}
    </div>
  );
}
