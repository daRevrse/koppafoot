"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, X, Loader2, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { onBookingsByOwner, updateBookingStatus } from "@/lib/firestore";
import { isVenueOwner } from "@/lib/hats";
import type { Booking } from "@/types";

// ============================================
// Les demandes REÇUES sur ses terrains.
//
// À ne pas confondre avec /mes-reservations, qui liste les créneaux qu'on a
// demandés ailleurs, en tant que client. Un propriétaire a les deux : il loue
// son terrain et peut jouer sur celui d'un autre.
//
// La confusion était dans le menu : « Réservations » y menait à la page du
// demandeur, si bien qu'un propriétaire cliquait dessus et ne voyait jamais
// les demandes qu'on lui adressait. Elles n'existaient qu'en tête de
// /mes-terrains, mêlées à la gestion des fiches.
//
// Confirmer appartient au propriétaire, et les règles Firestore le tiennent :
// un demandeur ne peut écrire que l'annulation.
// ============================================

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "border-amber-200 bg-amber-50 text-amber-700" },
  confirmed: { label: "Confirmé", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Annulé", className: "border-gray-200/70 bg-gray-50 text-gray-500" },
  completed: { label: "Passé", className: "border-gray-200/70 bg-gray-50 text-gray-500" },
};

/** « samedi 23 août », la date d'un créneau, telle qu'on la dit. */
function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export default function ReservationsRecuesPage() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onBookingsByOwner(user.uid, setBookings);
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

  if (!isVenueOwner(user)) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <div className="border border-gray-200/70 bg-white p-8 text-center sm:p-12">
          <MapPin size={30} className="mx-auto text-gray-300" strokeWidth={1.5} />
          <h1 className="mt-4 font-display text-xl font-black uppercase tracking-tight text-gray-900">
            Pas encore de terrain
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
            Cette page liste les demandes reçues sur vos terrains. Pour en
            recevoir, il faut d&apos;abord en référencer un.
          </p>
          <Link
            href="/terrains/candidature"
            className="mt-6 inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
          >
            Référencer mon terrain
          </Link>
        </div>
      </div>
    );
  }

  const answer = async (b: Booking, status: "confirmed" | "cancelled") => {
    setActing(b.id);
    try {
      await updateBookingStatus(b.id, status);
      toast.success(status === "confirmed" ? "Créneau confirmé" : "Demande refusée");
    } catch (err) {
      console.error("Booking answer failed:", err);
      toast.error("L'enregistrement a échoué");
    } finally {
      setActing(null);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const liste = (bookings ?? []).filter((b) => b.date >= today);
  const pending = liste.filter((b) => b.status === "pending");
  const autres = liste
    .filter((b) => b.status !== "pending")
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const Ligne = ({ b, actions }: { b: Booking; actions: boolean }) => {
    const badge = STATUS[b.status] ?? STATUS.pending;
    return (
      <li className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">{b.userName || "Un joueur"}</p>
          <p className="mt-1 text-[11px] font-bold text-gray-500">
            {b.venueName} · {longDate(b.date)} à {b.time} · {b.duration} h
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions ? (
            <>
              <button
                type="button"
                onClick={() => answer(b, "confirmed")}
                disabled={acting === b.id}
                className="flex items-center gap-1.5 border border-gray-900 bg-gray-900 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700 disabled:opacity-40"
              >
                {acting === b.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => answer(b, "cancelled")}
                disabled={acting === b.id}
                className="flex items-center gap-1.5 border border-gray-200/70 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-500 transition-colors hover:border-red-500 hover:text-red-500 disabled:opacity-40"
              >
                <X size={13} /> Refuser
              </button>
            </>
          ) : (
            <>
              <span className={`border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${badge.className}`}>
                {badge.label}
              </span>
              {b.status === "confirmed" && (
                <button
                  type="button"
                  onClick={() => answer(b, "cancelled")}
                  className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-red-500"
                >
                  Annuler
                </button>
              )}
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <nav
        aria-label="Fil d'ariane"
        className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
      >
        <Link href="/" className="transition-colors hover:text-emerald-700">Direct</Link>
        <span aria-hidden className="text-gray-300">›</span>
        <Link href="/mes-terrains" className="transition-colors hover:text-emerald-700">Mes terrains</Link>
        <span aria-hidden className="text-gray-300">›</span>
        <span className="text-gray-600">Réservations reçues</span>
      </nav>

      <section className="sticky top-[var(--header-h,72px)] z-30 -mx-3 overflow-hidden bg-gray-900 text-white lg:-mx-5">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
        <div className="relative mx-auto max-w-4xl px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
            Espace terrain
          </p>
          <h1 className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
            Réservations reçues
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">
            Les demandes de créneau sur vos terrains. Confirmer publie le
            créneau comme occupé ; refuser le laisse libre.
          </p>
        </div>
      </section>

      {bookings === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
        </div>
      ) : liste.length === 0 ? (
        <div className="mt-6 border border-gray-200/70 bg-white py-16 text-center">
          <CalendarDays size={30} className="mx-auto text-gray-300" strokeWidth={1.5} />
          <p className="mt-4 font-display text-lg font-black text-gray-900">Aucune demande</p>
          <p className="mt-1 text-sm text-gray-500">
            Rien à venir sur vos terrains pour le moment.
          </p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="mt-6">
              <h2 className="border-b border-gray-200/70 pb-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                En attente de réponse ({pending.length})
              </h2>
              <ul className="divide-y divide-gray-200/70 border-x border-b border-gray-200/70 bg-white">
                {pending.map((b) => <Ligne key={b.id} b={b} actions />)}
              </ul>
            </section>
          )}

          {autres.length > 0 && (
            <section className="mt-8">
              <h2 className="border-b border-gray-200/70 pb-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                Déjà traitées
              </h2>
              <ul className="divide-y divide-gray-200/70 border-x border-b border-gray-200/70 bg-white">
                {autres.map((b) => <Ligne key={b.id} b={b} actions={false} />)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
