"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createVenue } from "@/lib/firestore";
import { uploadVenuePhoto } from "@/lib/storage";
import { MapPin, ArrowLeft, Save, Loader2, Image as ImageIcon, XCircle } from "lucide-react";
import Link from "next/link";

export default function NewVenuePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      await createVenue({
        ...formData,
        ownerId: user.uid,
      });
      router.push("/venue-owner/venues");
    } catch (error) {
      console.error("Error creating venue:", error);
      alert("Une erreur est survenue lors de la création du terrain.");
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-bold text-gray-900 font-display">Ajouter un terrain</h1>
          <p className="text-gray-500">Remplissez les informations pour référencer votre installation.</p>
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
                          // We need a temporary ID if we want to upload before create,
                          // or we can just use "temp" and move it later? 
                          // Better: create venue first with empty URL, then upload.
                          // But for UX, we can upload to a 'temp' folder.
                          const url = await uploadVenuePhoto("temp_" + user?.uid, file);
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
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-8 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Enregistrer le terrain
          </button>
        </div>
      </form>
    </div>
  );
}
