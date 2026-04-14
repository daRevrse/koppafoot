"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function VenueOwnerDashboard() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
      <p className="mt-2 text-gray-600">Bienvenue, {user.firstName} !</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Réservations</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">—</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Confirmées</p>
          <p className="mt-1 text-2xl font-bold text-primary-600">—</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Revenus</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">—</p>
        </div>
      </div>
    </div>
  );
}
