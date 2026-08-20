"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, Check, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// Relecture des candidatures « propriétaire de terrain ».
//
// Même circuit que les candidatures d'organisateur, et pour la même raison :
// référencer un terrain, c'est publier une adresse et se présenter comme son
// gestionnaire. Quelqu'un relit avant publication.
//
// À l'approbation, l'API pose la casquette ET crée le terrain à partir de la
// fiche déjà saisie, rien n'est redemandé au candidat.
// ============================================

interface Application {
  id: string;
  uid: string;
  name: string;
  email: string | null;
  phone: string | null;
  venue_name: string;
  city: string | null;
  address: string | null;
  field_size: string | null;
  field_surface: string | null;
  motivation: string | null;
  status: "pending" | "approved" | "rejected";
}

const SIZES: Record<string, string> = {
  "5v5": "5 contre 5", "7v7": "7 contre 7", "11v11": "11 contre 11", futsal: "Futsal",
};
const SURFACES: Record<string, string> = {
  natural_grass: "Pelouse", synthetic: "Synthétique", hybrid: "Hybride", indoor: "Intérieur",
};

const STATUS_STYLE: Record<Application["status"], string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-gray-200/70 bg-gray-50 text-gray-500",
};

const STATUS_LABEL: Record<Application["status"], string> = {
  pending: "En attente", approved: "Approuvée", rejected: "Refusée",
};

export default function AdminVenueApplicationsPage() {
  const { firebaseUser } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/venue-applications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications ?? []);
      } else {
        toast.error("Impossible de charger les candidatures.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, action: "approve" | "reject") => {
    if (!firebaseUser) return;
    setActing(id);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/venue-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur."); return; }
      toast.success(
        action === "approve"
          ? "Candidature acceptée, le terrain est publié."
          : "Candidature refusée.",
      );
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: data.status } : a)));
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setActing(null);
    }
  };

  const shown = filter === "pending"
    ? applications.filter((a) => a.status === "pending")
    : applications;
  const pendingCount = applications.filter((a) => a.status === "pending").length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-black uppercase tracking-tight text-gray-900">
            <MapPin size={22} className="text-emerald-600" />
            Candidatures terrain
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {pendingCount > 0
              ? `${pendingCount} candidature${pendingCount > 1 ? "s" : ""} en attente.`
              : "Aucune candidature en attente."}
          </p>
        </div>

        <div className="flex gap-2">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`border px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
                filter === f
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
              }`}
            >
              {f === "pending" ? "En attente" : "Toutes"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
        </div>
      ) : shown.length === 0 ? (
        <div className="border border-gray-200/70 bg-white py-16 text-center">
          <p className="text-sm font-bold text-gray-400">Rien à relire.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {shown.map((a) => (
            <li key={a.id} className="border border-gray-200/70 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-black uppercase tracking-tight text-gray-900">
                    {a.venue_name}
                  </h2>
                  <p className="mt-1 text-[11px] font-bold text-gray-500">
                    {[a.address, a.city].filter(Boolean).join(", ") || "Adresse non précisée"}
                  </p>
                </div>
                <span className={`shrink-0 border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${STATUS_STYLE[a.status]}`}>
                  {STATUS_LABEL[a.status]}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                <span>{SIZES[a.field_size ?? ""] ?? a.field_size}</span>
                <span>{SURFACES[a.field_surface ?? ""] ?? a.field_surface}</span>
              </div>

              <div className="mt-4 border-t border-gray-200/70 pt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                  Candidat
                </p>
                <p className="mt-1 text-sm font-bold text-gray-900">{a.name}</p>
                <p className="text-[11px] font-semibold text-gray-500">
                  {[a.email, a.phone].filter(Boolean).join(" · ") || "Pas de contact"}
                </p>
                {a.motivation && (
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{a.motivation}</p>
                )}
              </div>

              {a.status === "pending" && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => decide(a.id, "approve")}
                    disabled={acting === a.id}
                    className="flex items-center gap-1.5 border border-gray-900 bg-gray-900 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700 disabled:opacity-40"
                  >
                    {acting === a.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Approuver et publier
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(a.id, "reject")}
                    disabled={acting === a.id}
                    className="flex items-center gap-1.5 border border-gray-200/70 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-gray-500 transition-colors hover:border-red-500 hover:text-red-500 disabled:opacity-40"
                  >
                    <X size={13} />
                    Refuser
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
