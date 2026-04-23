"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getVenueById, updateVenue } from "@/lib/firestore";
import { uploadVenuePhoto } from "@/lib/storage";
import { MapPin, ArrowLeft, Save, Loader2, Image as ImageIcon, XCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import type { Venue } from "@/types";

export default function EditVenuePage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const venueId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    fieldType: "outdoor" as const,
    fieldSurface: "synthetic" as const,
    fieldSize: "5v5" as const,
    pricePerHour: 50,
    amenities: [] as string[],
    photoUrl: "",
    available: true,
  });

  useEffect(() => {
    async function loadVenue() {
      if (!venueId) return;
      try {
        const venue = await getVenueById(venueId);
        if (venue) {
          setFormData({
            name: venue.name,
            address: venue.address,
            city: venue.city,
            fieldType: venue.fieldType as any,
            fieldSurface: venue.fieldSurface as any,
            fieldSize: venue.fieldSize as any,
            pricePerHour: venue.pricePerHour,
            amenities: venue.amenities || [],
            photoUrl: venue.photoUrl || "",
            available: venue.available,
          });
        }
      } catch (error) {
        console.error("Error loading venue:", error);
      } finally {
        setLoading(false);
      }
    }
    loadVenue();
  }, [venueId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !venueId) return;

    setSaving(true);
    try {
      await updateVenue(venueId, {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        fieldType: formData.fieldType,
        fieldSurface: formData.fieldSurface,
        fieldSize: formData.fieldSize,
        pricePerHour: formData.pricePerHour,
        amenities: formData.amenities,
        photoUrl: formData.photoUrl,
        available: formData.available,
      });
      toast.success("Terrain mis à jour !");
      router.push("/venue-owner/venues");
    } catch (error) {
      console.error("Error updating venue:", error);
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAmenity = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/venue-owner/venues"
          className="rounded-full bg-white p-2 text-gray-500 shadow-sm border border-gray-200 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Modifier le terrain</h1>
          <p className="text-gray-500">Mettez à jour les informations de votre installation.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du terrain</label>
              <input
                type="text"
                required
                placeholder="ex: Stade de la Victoire"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-emerald-500 focus:outline-none"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
              <input
                type="text"
                required
                placeholder="ex: Paris"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-emerald-500 focus:outline-none"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse complète</label>
              <input
                type="text"
                required
                placeholder="123 rue du Football"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-emerald-500 focus:outline-none"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de terrain</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-emerald-500 focus:outline-none"
                value={formData.fieldType}
                onChange={(e) => setFormData({ ...formData, fieldType: e.target.value as any })}
              >
                <option value="outdoor">Plein air (Outdoor)</option>
                <option value="indoor">Salle (Indoor)</option>
                <option value="hybrid">Hybride</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Surface</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-emerald-500 focus:outline-none"
                value={formData.fieldSurface}
                onChange={(e) => setFormData({ ...formData, fieldSurface: e.target.value as any })}
              >
                <option value="synthetic">Gazon Synthétique</option>
                <option value="natural_grass">Herbe Naturelle</option>
                <option value="indoor">Parquet / Sol Indoor</option>
                <option value="hybrid">Hybride</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Format / Taille</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-emerald-500 focus:outline-none"
                value={formData.fieldSize}
                onChange={(e) => setFormData({ ...formData, fieldSize: e.target.value as any })}
              >
                <option value="5v5">Foot à 5 / Urban</option>
                <option value="7v7">Foot à 7</option>
                <option value="11v11">Foot à 11</option>
                <option value="futsal">Futsal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix par heure (€)</label>
              <input
                type="number"
                required
                min="0"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-emerald-500 focus:outline-none"
                value={formData.pricePerHour}
                onChange={(e) => setFormData({ ...formData, pricePerHour: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Photo du terrain</label>
              <div className="flex flex-col gap-3">
                {formData.photoUrl && (
                  <div className="relative h-32 w-full overflow-hidden rounded-lg border border-gray-200">
                    <img src={formData.photoUrl} alt="Preview" className="h-full w-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, photoUrl: "" })}
                      className="absolute right-2 top-2 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600"
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700">
                    {uploadingPhoto ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <>
                        <ImageIcon size={18} />
                        Téléverser une photo
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingPhoto}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingPhoto(true);
                        try {
                          const url = await uploadVenuePhoto(venueId, file);
                          setFormData({ ...formData, photoUrl: url });
                        } catch (err) {
                          console.error(err);
                          alert("Erreur lors de l'upload");
                        } finally {
                          setUploadingPhoto(false);
                        }
                      }}
                    />
                  </label>
                  <div className="flex-[2]">
                    <input
                      type="url"
                      placeholder="Ou coller une URL..."
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-emerald-500 focus:outline-none text-sm"
                      value={formData.photoUrl}
                      onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Disponibilité</label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                checked={formData.available}
                onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Rendre ce terrain visible et réservable</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Équipements & Services</label>
            <div className="flex flex-wrap gap-2">
              {["Vestiaires", "Douches", "Parking", "Cafétéria", "Projecteurs", "Ballons inclus"].map((amenity) => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleAmenity(amenity)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                    formData.amenities.includes(amenity)
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {amenity}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/venue-owner/venues"
            className="rounded-lg px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-8 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Enregistrer les modifications
          </button>
        </div>
      </form>
    </div>
  );
}
