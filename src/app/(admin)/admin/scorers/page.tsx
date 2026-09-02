"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Radio, CheckCircle, XCircle, Loader2, Clock, Mail, Phone, MapPin,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// Administration, la relecture des candidatures de scoreur.
//
// Jumelle de /admin/organizers, et le décalque est volontaire : c'est la même
// décision, prise par la même personne, sur le même geste. Approuver pose
// `is_scorer` côté serveur (voir /api/scorer-applications/[id]).
//
// CE QU'ON LIT ICI. La motivation, et rien d'autre à quoi se raccrocher : il
// n'y a ni parcours ni référence à vérifier. La question est celle-là, et il
// vaut mieux qu'elle soit posée franchement — cette personne va-t-elle tenir
// le score d'un match qu'elle ne joue pas, et le tenir jusqu'au bout ?
// ============================================

interface Candidature {
  id: string;
  uid: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  motivation: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string | null;
  reviewedAt: string | null;
}

const STATUTS = {
  pending: { label: "En attente", color: "text-amber-700", bg: "bg-amber-50" },
  approved: { label: "Acceptée", color: "text-emerald-700", bg: "bg-emerald-50" },
  rejected: { label: "Refusée", color: "text-red-700", bg: "bg-red-50" },
} as const;

export default function AdminScorersPage() {
  const { firebaseUser } = useAuth();
  const [candidatures, setCandidatures] = useState<Candidature[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<"pending" | "all">("pending");
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/scorer-applications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { applications: Candidature[] };
        setCandidatures(data.applications);
      } else {
        toast.error("Impossible de charger les candidatures.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => { charger(); }, [charger]);

  const decider = async (id: string, action: "approve" | "reject") => {
    if (!firebaseUser) return;
    setEnCours(id);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/scorer-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur.");
        return;
      }
      toast.success(action === "approve" ? "Scoreur validé" : "Candidature refusée");
      await charger();
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setEnCours(null);
    }
  };

  const affichees = filtre === "pending"
    ? candidatures.filter((c) => c.status === "pending")
    : candidatures;
  const enAttente = candidatures.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-black tracking-tight text-gray-900">
            <Radio size={22} className="text-emerald-600" />
            Scoreurs
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {enAttente > 0
              ? `${enAttente} candidature${enAttente > 1 ? "s" : ""} à examiner.`
              : "Aucune candidature en attente."}
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`rounded-full px-4 py-1.5 text-xs font-black transition-colors ${
                filtre === f ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-500"
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
      ) : affichees.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <Clock size={28} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">Rien à examiner ici.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {affichees.map((c) => {
            const st = STATUTS[c.status];
            return (
              <div key={c.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-black text-gray-900">{c.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${st.bg} ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-gray-400">
                      {c.email && <span className="flex items-center gap-1"><Mail size={11} />{c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone size={11} />{c.phone}</span>}
                      {c.city && <span className="flex items-center gap-1"><MapPin size={11} />{c.city}</span>}
                      {c.createdAt && (
                        <span>{new Date(c.createdAt).toLocaleDateString("fr-FR")}</span>
                      )}
                    </div>
                  </div>

                  {c.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => decider(c.id, "approve")}
                        disabled={enCours === c.id}
                        className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {enCours === c.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <CheckCircle size={13} />}
                        Valider
                      </button>
                      <button
                        onClick={() => decider(c.id, "reject")}
                        disabled={enCours === c.id}
                        className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-xs font-black text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
                      >
                        <XCircle size={13} />
                        Refuser
                      </button>
                    </div>
                  )}
                </div>

                <p className="mt-4 whitespace-pre-line border-t border-gray-100 pt-4 text-sm leading-relaxed text-gray-600">
                  {c.motivation}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
