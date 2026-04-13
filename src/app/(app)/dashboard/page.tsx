"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">
        Bienvenue, {user.firstName} !
      </h1>
      <p className="mt-2 text-gray-600">
        Rôle : {ROLE_LABELS[user.userType]}
      </p>
      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500">
          Les modules seront ajoutés ici au fur et à mesure.
        </p>
      </div>
    </div>
  );
}
