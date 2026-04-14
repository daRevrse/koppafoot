"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function AdminDashboard() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard Admin</h1>
      <p className="mt-2 text-gray-600">Bienvenue, {user.firstName}.</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Utilisateurs</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">—</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Équipes</p>
          <p className="mt-1 text-2xl font-bold text-green-600">—</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Terrains</p>
          <p className="mt-1 text-2xl font-bold text-purple-600">—</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Matchs ce mois</p>
          <p className="mt-1 text-2xl font-bold text-orange-600">—</p>
        </div>
      </div>
    </div>
  );
}
