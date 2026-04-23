"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { onVenuesByOwner, deleteVenue } from "@/lib/firestore";
import type { Venue } from "@/types";
import { MapPin, Plus, Edit2, Trash2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-hot-toast";

export default function MyVenuesPage() {
  const { user } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onVenuesByOwner(user.uid, (data) => {
      setVenues(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const handleDelete = async (venueId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce terrain ? Cette action est irréversible.")) {
      return;
    }

    setDeletingId(venueId);
    try {
      await deleteVenue(venueId);
      toast.success("Terrain supprimé avec succès.");
    } catch (error) {
      console.error("Error deleting venue:", error);
      toast.error("Erreur lors de la suppression.");
    } finally {
      setDeletingId(null);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Mes terrains</h1>
          <p className="text-gray-500">Gérez vos installations sportives et leur visibilité.</p>
        </div>
        <Link 
          href="/venue-owner/venues/new"
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          <Plus size={18} />
          Ajouter un terrain
        </Link>
      </div>

      {venues.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="mb-4 rounded-full bg-emerald-50 p-4 text-emerald-600">
            <MapPin size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Aucun terrain enregistré</h3>
          <p className="mt-1 text-gray-500 max-w-xs">
            Commencez par ajouter votre premier terrain pour recevoir des réservations.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <div key={venue.id} className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
              <div className="relative h-48 w-full bg-gray-100">
                {venue.photoUrl ? (
                  <Image
                    src={venue.photoUrl}
                    alt={venue.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    <MapPin size={48} />
                  </div>
                )}
                <div className="absolute right-3 top-3 flex gap-2">
                  <Link 
                    href={`/venue-owner/venues/${venue.id}/edit`}
                    className="rounded-full bg-white/90 p-2 text-gray-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-emerald-600"
                  >
                    <Edit2 size={16} />
                  </Link>
                  <button 
                    onClick={() => handleDelete(venue.id)}
                    disabled={deletingId === venue.id}
                    className="rounded-full bg-white/90 p-2 text-gray-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-red-600 disabled:opacity-50"
                  >
                    {deletingId === venue.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
                <div className="absolute bottom-3 left-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-md ${
                    venue.available ? "bg-emerald-500/90 text-white" : "bg-red-500/90 text-white"
                  }`}>
                    {venue.available ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {venue.available ? "Disponible" : "Indisponible"}
                  </span>
                </div>
              </div>
              
              <div className="p-5">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">{venue.name}</h3>
                  <span className="text-lg font-bold text-emerald-600">{venue.pricePerHour}€<span className="text-xs font-normal text-gray-500">/h</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <MapPin size={14} />
                  {venue.city}
                </div>
                
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 uppercase">{venue.fieldType}</span>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 uppercase">{venue.fieldSurface}</span>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 uppercase">{venue.fieldSize}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
