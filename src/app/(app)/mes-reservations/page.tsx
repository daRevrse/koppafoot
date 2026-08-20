"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Loader2, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { onBookingsByUser, updateBookingStatus } from "@/lib/firestore";
import type { Booking } from "@/types";

// ============================================
// Mes réservations — le côté demandeur.
//
// Sans cette page, une demande partait dans le vide : le propriétaire la
// voyait, le demandeur non. Il devait retourner sur la fiche du terrain pour
// deviner si son samedi soir tenait.
//
// Annuler reste possible des deux côtés, et c'est délibéré — un match qui
// tombe à l'eau se dit tout de suite. Confirmer, en revanche, n'appartient
// qu'au propriétaire : les règles Firestore le tiennent, pas seulement
// l'absence de bouton.
// ============================================

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "border-amber-200 bg-amber-50 text-amber-700" },
  confirmed: { label: "Confirmé", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Annulé", className: "border-gray-200/70 bg-gray-50 text-gray-500" },
  completed: { label: "Passé", className: "border-gray-200/70 bg-gray-50 text-gray-500" },
};

/** « samedi 23 août » — la date d'un créneau, telle qu'on la dit. */
function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export default function MyBookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onBookingsByUser(user.uid, setBookings);
    return unsub;
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    );
  }

  if (!user) return null;

  const cancel = async (b: Booking) => {
    if (!confirm(`Annuler la demande du ${longDate(b.date)} à ${b.time} ?`)) return;
    try {
      await updateBookingStatus(b.id, "cancelled");
      toast.success("Demande annulée");
    } catch (err) {
      console.error("Cancel failed:", err);
      toast.error("L'annulation a échoué");
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <nav
        aria-label="Fil d'ariane"
        className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
      >
        <Link href="/" className="transition-colors hover:text-emerald-700">Direct</Link>
        <span aria-hidden className="text-gray-300">›</span>
        <Link href="/terrains" className="transition-colors hover:text-emerald-700">MyFields</Link>
        <span aria-hidden className="text-gray-300">›</span>
        <span className="text-gray-600">Mes réservations</span>
      </nav>

      <section className="sticky top-16 z-30 -mx-3 overflow-hidden bg-gray-900 text-white lg:-mx-5 lg:top-[72px]">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
        <div className="relative mx-auto max-w-4xl px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
            Terrains
          </p>
          <h1 className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
            Mes réservations
          </h1>
        </div>
      </section>

      <div className="mt-6">
        {bookings === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="border border-gray-200/70 bg-white py-16 text-center">
            <CalendarDays size={30} className="mx-auto text-gray-300" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg font-black text-gray-900">Aucune demande</p>
            <p className="mt-1 text-sm text-gray-500">
              Trouve un terrain et demande un créneau.
            </p>
            <Link
              href="/terrains"
              className="mt-6 inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
            >
              Voir les terrains
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200/70 border border-gray-200/70 bg-white">
            {bookings.map((b) => {
              const badge = STATUS[b.status] ?? STATUS.pending;
              const annulable = b.status !== "cancelled" && b.date >= today;
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <Link
                      href={`/terrains/${b.venueId}`}
                      className="flex items-center gap-1.5 text-sm font-bold text-gray-900 transition-colors hover:text-emerald-700"
                    >
                      <MapPin size={13} className="shrink-0 text-gray-400" />
                      {b.venueName}
                    </Link>
                    <p className="mt-1 text-[11px] font-bold text-gray-500">
                      {longDate(b.date)} à {b.time} · {b.duration} h
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${badge.className}`}>
                      {badge.label}
                    </span>
                    {annulable && (
                      <button
                        type="button"
                        onClick={() => cancel(b)}
                        className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-red-500"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
