"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { onBookingsByOwner, updateBookingStatus } from "@/lib/firestore";
import type { Booking } from "@/types";
import { Calendar, Clock, User, Check, X, MoreHorizontal, Filter } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function BookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    const unsub = onBookingsByOwner(user.uid, (data) => {
      setBookings(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const handleStatusUpdate = async (id: string, status: Booking["status"]) => {
    try {
      await updateBookingStatus(id, status);
    } catch (error) {
      console.error("Error updating booking status:", error);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (filter === "all") return true;
    return b.status === filter;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Réservations</h1>
        <p className="text-gray-500">Suivez et gérez les demandes de réservation de vos terrains.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: "all", label: "Toutes" },
            { id: "pending", label: "En attente" },
            { id: "confirmed", label: "Confirmées" },
            { id: "completed", label: "Passées" },
            { id: "cancelled", label: "Annulées" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filter === f.id
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          <Filter size={16} />
          Filtrer
        </button>
      </div>

      {filteredBookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 text-center">
          <div className="mb-4 rounded-full bg-gray-50 p-4 text-gray-400">
            <Calendar size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Aucune réservation</h3>
          <p className="mt-1 text-gray-500">
            {filter === "all" 
              ? "Vous n'avez pas encore reçu de réservations." 
              : `Aucune réservation avec le statut "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-400">
              <tr>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Terrain</th>
                <th className="px-6 py-4">Date & Heure</th>
                <th className="px-6 py-4">Prix</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <User size={16} />
                      </div>
                      <span className="font-medium text-gray-900">{booking.userName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-700">{booking.venueName}</td>
                  <td className="px-6 py-4 text-gray-600">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 font-medium text-gray-900">
                        <Calendar size={14} className="text-gray-400" />
                        {format(new Date(booking.date), "dd MMM yyyy", { locale: fr })}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                        <Clock size={14} />
                        {booking.time} ({booking.duration}h)
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">{booking.totalPrice}€</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                      booking.status === "confirmed" ? "bg-emerald-100 text-emerald-700" :
                      booking.status === "pending" ? "bg-amber-100 text-amber-700" :
                      booking.status === "cancelled" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        booking.status === "confirmed" ? "bg-emerald-500" :
                        booking.status === "pending" ? "bg-amber-500" :
                        booking.status === "cancelled" ? "bg-red-500" :
                        "bg-gray-500"
                      }`} />
                      {booking.status === "confirmed" ? "Confirmé" :
                       booking.status === "pending" ? "En attente" :
                       booking.status === "cancelled" ? "Annulé" : "Terminé"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center gap-2">
                       {booking.status === "pending" && (
                         <>
                           <button 
                            onClick={() => handleStatusUpdate(booking.id, "confirmed")}
                            className="rounded-lg bg-emerald-50 p-2 text-emerald-600 hover:bg-emerald-100"
                           >
                             <Check size={16} />
                           </button>
                           <button 
                            onClick={() => handleStatusUpdate(booking.id, "cancelled")}
                            className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100"
                           >
                             <X size={16} />
                           </button>
                         </>
                       )}
                       <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
                         <MoreHorizontal size={16} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
