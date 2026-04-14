"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  MapPin, Search, Filter, X, ChevronDown, Eye,
  Star, Ruler, Layers, Sun, Building2, Users,
} from "lucide-react";

// ============================================
// Mock data
// ============================================

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  fieldType: "outdoor" | "indoor" | "hybrid";
  fieldSurface: "natural_grass" | "synthetic" | "hybrid" | "indoor";
  fieldSize: "5v5" | "7v7" | "11v11" | "futsal";
  rating: number;
  reviewCount: number;
  pricePerHour: number;
  amenities: string[];
  available: boolean;
  photoColor: string;
}

const VENUES: Venue[] = [
  {
    id: "v1",
    name: "Stade Municipal Jean Bouin",
    address: "26 Av. du Général Sarrail",
    city: "Paris",
    fieldType: "outdoor",
    fieldSurface: "natural_grass",
    fieldSize: "11v11",
    rating: 4.5,
    reviewCount: 48,
    pricePerHour: 120,
    amenities: ["Vestiaires", "Parking", "Tribunes", "Éclairage"],
    available: true,
    photoColor: "emerald",
  },
  {
    id: "v2",
    name: "Urban Soccer Nanterre",
    address: "15 Rue des Sports",
    city: "Paris",
    fieldType: "indoor",
    fieldSurface: "synthetic",
    fieldSize: "5v5",
    rating: 4.2,
    reviewCount: 112,
    pricePerHour: 80,
    amenities: ["Vestiaires", "Bar", "Parking"],
    available: true,
    photoColor: "blue",
  },
  {
    id: "v3",
    name: "Complexe Sportif de Gerland",
    address: "353 Av. Jean Jaurès",
    city: "Lyon",
    fieldType: "outdoor",
    fieldSurface: "synthetic",
    fieldSize: "7v7",
    rating: 4.7,
    reviewCount: 65,
    pricePerHour: 95,
    amenities: ["Vestiaires", "Parking", "Éclairage", "Buvette"],
    available: true,
    photoColor: "amber",
  },
  {
    id: "v4",
    name: "Terrain Synthétique Nord",
    address: "8 Allée des Peupliers",
    city: "Paris",
    fieldType: "outdoor",
    fieldSurface: "synthetic",
    fieldSize: "5v5",
    rating: 3.9,
    reviewCount: 34,
    pricePerHour: 60,
    amenities: ["Vestiaires", "Éclairage"],
    available: false,
    photoColor: "gray",
  },
  {
    id: "v5",
    name: "Le Five Marseille",
    address: "Zone Artisanale, Av. de la Pinède",
    city: "Marseille",
    fieldType: "indoor",
    fieldSurface: "indoor",
    fieldSize: "5v5",
    rating: 4.4,
    reviewCount: 89,
    pricePerHour: 85,
    amenities: ["Vestiaires", "Bar", "Parking", "Boutique"],
    available: true,
    photoColor: "orange",
  },
  {
    id: "v6",
    name: "Stade de la Roseraie",
    address: "Chemin de la Roseraie",
    city: "Toulouse",
    fieldType: "outdoor",
    fieldSurface: "natural_grass",
    fieldSize: "11v11",
    rating: 4.1,
    reviewCount: 22,
    pricePerHour: 100,
    amenities: ["Vestiaires", "Parking", "Tribunes"],
    available: true,
    photoColor: "purple",
  },
];

const FIELD_TYPE_LABELS: Record<string, { label: string; icon: typeof Sun }> = {
  outdoor: { label: "Extérieur", icon: Sun },
  indoor: { label: "Intérieur", icon: Building2 },
  hybrid: { label: "Hybride", icon: Layers },
};

const SURFACE_LABELS: Record<string, string> = {
  natural_grass: "Gazon naturel",
  synthetic: "Synthétique",
  hybrid: "Hybride",
  indoor: "Indoor",
};

const PHOTO_COLORS: Record<string, string> = {
  emerald: "bg-emerald-200",
  blue: "bg-blue-200",
  amber: "bg-amber-200",
  gray: "bg-gray-200",
  orange: "bg-orange-200",
  purple: "bg-purple-200",
};

const CITIES = ["Toutes", "Paris", "Lyon", "Marseille", "Toulouse"];
const SIZES = ["Tous", "5v5", "7v7", "11v11", "futsal"];

// ============================================
// Component
// ============================================

export default function VenuesPage() {
  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("Toutes");
  const [sizeFilter, setSizeFilter] = useState("Tous");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);

  const filtered = VENUES.filter((v) => {
    if (query && !v.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (cityFilter !== "Toutes" && v.city !== cityFilter) return false;
    if (sizeFilter !== "Tous" && v.fieldSize !== sizeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-gray-900 font-display">Terrains</h1>
        <p className="mt-1 text-sm text-gray-500">Découvre les terrains disponibles autour de toi</p>
      </motion.div>

      {/* Search + Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="space-y-3"
      >
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un terrain..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 transition-shadow focus:shadow-[0_0_0_3px_rgba(5,150,105,0.1)]"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              showFilters
                ? "border-primary-300 bg-primary-50 text-primary-700"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Filter size={16} /> Filtres
            <ChevronDown size={14} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex flex-wrap gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4"
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Ville</label>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-600 focus:outline-none"
              >
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Format</label>
              <select
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-600 focus:outline-none"
              >
                {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {(cityFilter !== "Toutes" || sizeFilter !== "Tous") && (
              <button
                onClick={() => { setCityFilter("Toutes"); setSizeFilter("Tous"); }}
                className="mt-auto flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <X size={14} /> Réinitialiser
              </button>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Results count */}
      <p className="text-sm text-gray-500">
        <span className="font-semibold text-gray-900">{filtered.length}</span> terrain{filtered.length > 1 ? "s" : ""}
      </p>

      {/* Venues grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((venue, i) => {
            const typeConf = FIELD_TYPE_LABELS[venue.fieldType];
            const TypeIcon = typeConf?.icon ?? Sun;
            const isExpanded = selectedVenue === venue.id;

            return (
              <motion.div
                key={venue.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                whileHover={{ y: -3 }}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
              >
                {/* Photo placeholder */}
                <div className={`relative h-32 ${PHOTO_COLORS[venue.photoColor] ?? "bg-gray-200"}`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <MapPin size={32} className="text-white/60" />
                  </div>
                  {/* Badges */}
                  <div className="absolute bottom-2 left-2 flex gap-1.5">
                    <span className="rounded-md bg-white/90 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold text-gray-700">
                      {venue.fieldSize}
                    </span>
                    <span className="rounded-md bg-white/90 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold text-gray-700 flex items-center gap-1">
                      <TypeIcon size={12} /> {typeConf?.label}
                    </span>
                  </div>
                  {!venue.available && (
                    <div className="absolute top-2 right-2 rounded-md bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                      Indisponible
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 font-display leading-snug">{venue.name}</h3>
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={12} /> {venue.address}, {venue.city}
                  </div>

                  {/* Rating + Surface */}
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-accent-600 font-semibold">
                      <Star size={12} className="fill-accent-500 text-accent-500" /> {venue.rating}
                      <span className="text-gray-400 font-normal">({venue.reviewCount})</span>
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-600">{SURFACE_LABELS[venue.fieldSurface]}</span>
                  </div>

                  {/* Amenities */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {venue.amenities.slice(0, 3).map((a) => (
                      <span key={a} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{a}</span>
                    ))}
                    {venue.amenities.length > 3 && (
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
                        +{venue.amenities.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Price + View */}
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <span className="text-lg font-bold text-gray-900 font-display">{venue.pricePerHour}&euro;</span>
                      <span className="text-xs text-gray-400"> /h</span>
                    </div>
                    <button
                      onClick={() => setSelectedVenue(isExpanded ? null : venue.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Eye size={14} /> Voir détails
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16"
        >
          <MapPin size={32} className="text-gray-300" />
          <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">Aucun terrain trouvé</h3>
          <p className="mt-1 text-sm text-gray-500">Essaie d&apos;élargir tes critères de recherche</p>
        </motion.div>
      )}
    </div>
  );
}
