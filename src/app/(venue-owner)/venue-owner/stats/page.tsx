"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { onBookingsByOwner, onVenuesByOwner } from "@/lib/firestore";
import type { Booking, Venue } from "@/types";
import { TrendingUp, Users, DollarSign, Calendar, ArrowUpRight, ArrowDownRight, BarChart2 } from "lucide-react";

export default function VenueStatsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubB = onBookingsByOwner(user.uid, (data) => setBookings(data));
    const unsubV = onVenuesByOwner(user.uid, (data) => {
        setVenues(data);
        setLoading(false);
    });
    return () => { unsubB(); unsubV(); };
  }, [user]);

  const stats = {
    totalRevenue: bookings.filter(b => b.status === "confirmed" || b.status === "completed").reduce((acc, b) => acc + b.totalPrice, 0),
    totalBookings: bookings.length,
    confirmedBookings: bookings.filter(b => b.status === "confirmed").length,
    activeFields: venues.filter(v => v.available).length,
    avgPrice: venues.length > 0 ? venues.reduce((acc, v) => acc + v.pricePerHour, 0) / venues.length : 0
  };

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
        <h1 className="text-2xl font-bold text-gray-900 font-display">Statistiques</h1>
        <p className="text-gray-500">Analysez la performance de vos terrains et vos revenus.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Revenu Total", value: `${stats.totalRevenue}€`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50", trend: "+12.5%", positive: true },
          { label: "Réservations", value: stats.totalBookings, icon: Calendar, color: "text-blue-600", bg: "bg-blue-50", trend: "+8.2%", positive: true },
          { label: "Taux de confirmation", value: `${stats.totalBookings > 0 ? Math.round((stats.confirmedBookings / stats.totalBookings) * 100) : 0}%`, icon: BarChart2, color: "text-amber-600", bg: "bg-amber-50", trend: "-2.4%", positive: false },
          { label: "Terrains Actifs", value: stats.activeFields, icon: Users, color: "text-purple-600", bg: "bg-purple-50", trend: "Stable", positive: true },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={`rounded-lg ${stat.bg} p-2 ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium ${stat.positive ? "text-emerald-600" : "text-red-600"}`}>
                {stat.trend}
                {stat.trend !== "Stable" && (stat.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />)}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Revenus par terrain</h3>
          <div className="space-y-4">
            {venues.map((venue) => {
                const venueRevenue = bookings
                    .filter(b => b.venueId === venue.id && (b.status === 'confirmed' || b.status === 'completed'))
                    .reduce((acc, b) => acc + b.totalPrice, 0);
                const percentage = stats.totalRevenue > 0 ? (venueRevenue / stats.totalRevenue) * 100 : 0;
                
                return (
                    <div key={venue.id}>
                        <div className="mb-1 flex justify-between text-sm">
                            <span className="font-medium text-gray-700">{venue.name}</span>
                            <span className="text-gray-900 font-bold">{venueRevenue}€</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500 transition-all duration-500" 
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                    </div>
                );
            })}
            {venues.length === 0 && (
                <p className="text-gray-500 text-center py-8">Aucune donnée disponible</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Activités récentes</h3>
          <div className="space-y-4">
            {bookings.slice(0, 5).map((booking) => (
                <div key={booking.id} className="flex items-center gap-3 border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                    <div className="rounded-full bg-emerald-100 p-2 text-emerald-600">
                        <DollarSign size={14} />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{booking.userName}</p>
                        <p className="text-xs text-gray-500">{booking.venueName} • {booking.date}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">+{booking.totalPrice}€</p>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">{booking.status}</p>
                    </div>
                </div>
            ))}
            {bookings.length === 0 && (
                <p className="text-gray-500 text-center py-8">Aucune réservation récente</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
