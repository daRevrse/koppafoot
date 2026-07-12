"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList, CheckCircle, XCircle, Loader2, Clock, Mail, Phone, MapPin, Trophy,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// Admin — organizer applications review. Approve promotes the user to
// "organizer" (handled server-side by /api/organizer-applications/[id]).
// ============================================

interface Application {
  id: string;
  uid: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  motivation: string;
  competitionName: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string | null;
  reviewedAt: string | null;
}

const STATUS_CONFIG = {
  pending: { label: "En attente", color: "text-amber-700", bg: "bg-amber-50" },
  approved: { label: "Acceptée", color: "text-emerald-700", bg: "bg-emerald-50" },
  rejected: { label: "Refusée", color: "text-red-700", bg: "bg-red-50" },
} as const;

export default function AdminOrganizersPage() {
  const { firebaseUser } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/organizer-applications", {
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

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, action: "approve" | "reject") => {
    if (!firebaseUser) return;
    setActing(id);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/organizer-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur.");
        return;
      }
      toast.success(action === "approve" ? "Candidature acceptée — utilisateur promu organisateur." : "Candidature refusée.");
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: data.status } : a)),
      );
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
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-black text-gray-900">
            <ClipboardList size={22} className="text-emerald-600" />
            Candidatures organisateur
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {pendingCount > 0
              ? `${pendingCount} candidature${pendingCount > 1 ? "s" : ""} en attente.`
              : "Aucune candidature en attente."}
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-xs font-black transition-colors ${
                filter === f ? "bg-gray-900 text-white" : "bg-white text-gray-500 border border-gray-200"
              }`}
            >
              {f === "pending" ? "En attente" : "Toutes"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-emerald-500" />
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <Clock size={28} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">Rien à examiner ici.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((a) => {
            const st = STATUS_CONFIG[a.status];
            return (
              <div key={a.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-black text-gray-900">{a.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${st.bg} ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-gray-400">
                      {a.email && <span className="flex items-center gap-1"><Mail size={11} />{a.email}</span>}
                      {a.phone && <span className="flex items-center gap-1"><Phone size={11} />{a.phone}</span>}
                      {a.city && <span className="flex items-center gap-1"><MapPin size={11} />{a.city}</span>}
                      {a.createdAt && (
                        <span>{new Date(a.createdAt).toLocaleDateString("fr-FR")}</span>
                      )}
                    </div>
                  </div>

                  {a.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => decide(a.id, "approve")}
                        disabled={acting === a.id}
                        className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {acting === a.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                        Accepter
                      </button>
                      <button
                        onClick={() => decide(a.id, "reject")}
                        disabled={acting === a.id}
                        className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-xs font-black text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
                      >
                        <XCircle size={13} />
                        Refuser
                      </button>
                    </div>
                  )}
                </div>

                {a.competitionName && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-gray-600">
                    <Trophy size={12} className="text-emerald-500" />
                    {a.competitionName}
                  </p>
                )}
                <p className="mt-2 whitespace-pre-line rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
                  {a.motivation}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
