"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ClipboardList, CheckCircle2, Clock, XCircle, Loader2, Trophy } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// Devenir organisateur — application form (the "Organiser" button).
// Applications are reviewed by the system admin in /admin/organizers.
// ============================================

interface MyApplication {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string | null;
}

export default function BecomeOrganizerPage() {
  const { user, firebaseUser } = useAuth();
  const [existing, setExisting] = useState<MyApplication | null>(null);
  const [checking, setChecking] = useState(true);
  const [motivation, setMotivation] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const loadMine = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/organizer-applications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { applications: MyApplication[] };
        const pending = data.applications.find((a) => a.status === "pending");
        setExisting(pending ?? data.applications[0] ?? null);
      }
    } catch { /* ignore */ } finally {
      setChecking(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  useEffect(() => {
    if (user) {
      setCity((c) => c || user.locationCity || "");
      setPhone((p) => p || user.phone || "");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    if (motivation.trim().length < 20) {
      toast.error("Décris ton projet en quelques phrases (20 caractères minimum).");
      return;
    }
    setSubmitting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/organizer-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ motivation, competitionName, city, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de l'envoi.");
        return;
      }
      setSent(true);
    } catch {
      toast.error("Erreur réseau. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-all";

  // Already an organizer
  if (user && (user.userType === "organizer" || user.userType === "superadmin")) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <Trophy size={26} className="text-emerald-500" />
        </div>
        <h1 className="mt-4 font-display text-xl font-black text-gray-900">
          Tu es déjà organisateur
        </h1>
        <p className="mt-1 text-sm text-gray-400">Ton espace t&apos;attend.</p>
        <Link
          href="/organizer"
          className="mt-5 inline-flex rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-600"
        >
          Ouvrir mon espace organisateur
        </Link>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  // Submitted just now, or a pending application exists
  if (sent || existing?.status === "pending") {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
          <Clock size={26} className="text-amber-500" />
        </div>
        <h1 className="mt-4 font-display text-xl font-black text-gray-900">
          Candidature en cours d&apos;examen
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">
          Notre équipe examine ta demande. Tu recevras la réponse par email et
          par notification.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-xl border border-gray-200 px-6 py-3 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50"
        >
          Retour au Direct
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      {/* Rejected notice above the (re-application) form */}
      {existing?.status === "rejected" && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <XCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
          <p className="text-xs leading-relaxed text-gray-500">
            Ta précédente candidature n&apos;a pas été retenue. Tu peux repostuler
            en détaillant davantage ton projet.
          </p>
        </div>
      )}

      <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50">
            <ClipboardList size={20} className="text-emerald-500" />
          </div>
          <div>
            <h1 className="font-display text-xl font-black text-gray-900">
              Devenir organisateur
            </h1>
            <p className="text-xs font-semibold text-gray-400">
              Crée et gère tes compétitions sur Koppafoot.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-gray-600">
              Ton projet de compétition
            </label>
            <textarea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="Décris ta compétition : quel format, combien d'équipes, où, quand… et ton expérience d'organisation."
              className={`${inputClass} resize-none`}
              required
            />
            <p className="mt-1 text-right text-[10px] font-semibold text-gray-300">
              {motivation.length}/1000
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-gray-600">
              Nom de la compétition envisagée{" "}
              <span className="font-semibold text-gray-300">(optionnel)</span>
            </label>
            <input
              value={competitionName}
              onChange={(e) => setCompetitionName(e.target.value)}
              className={inputClass}
              placeholder="Ex. Tournoi inter-quartiers de Lomé"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-600">Ville</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
                placeholder="Lomé"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-600">Téléphone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                className={inputClass}
                placeholder="+22890123456"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-600 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Envoyer ma candidature
          </button>
        </form>
      </div>
    </div>
  );
}
