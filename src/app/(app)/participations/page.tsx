"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy, Calendar, MapPin, Clock, CheckCircle,
  XCircle, Timer, Shield, Inbox, History, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  onParticipationsForPlayer,
  respondToParticipation,
} from "@/lib/firestore";
import type { Participation } from "@/types";

// ============================================
// Config
// ============================================

const STATUS_CONFIG = {
  confirmed: { label: "Confirmé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  declined: { label: "Décliné", color: "bg-rose-100 text-rose-700", icon: XCircle },
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700", icon: Timer },
  cancelled: { label: "Match Annulé", color: "bg-gray-100 text-gray-500", icon: XCircle },
};

// ============================================
// Loading skeleton
// ============================================

function ParticipationSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-5 w-40 rounded bg-gray-200" />
          </div>
          <div className="flex gap-3">
            <div className="h-3 w-24 rounded bg-gray-100" />
            <div className="h-3 w-20 rounded bg-gray-100" />
            <div className="h-3 w-28 rounded bg-gray-100" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 rounded-lg bg-gray-100" />
            <div className="h-9 w-24 rounded-lg bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Component
// ============================================

type Tab = "requests" | "history";

export default function ParticipationsPage() {
  const { user } = useAuth();
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("requests");
  const [respondingIds, setRespondingIds] = useState<Set<string>>(new Set());

  // Real-time listener for participations
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = onParticipationsForPlayer(user.uid, (data) => {
      setParticipations(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Filter by tab
  const pending = participations.filter((p) => p.status === "pending");
  const history = participations.filter((p) => p.status !== "pending");

  const displayed = tab === "requests" ? pending : history;

  // Respond handler
  const handleRespond = async (participation: Participation, accepted: boolean) => {
    const participationId = participation.id;
    setRespondingIds((prev) => new Set(prev).add(participationId));
    try {
      await respondToParticipation(
        participationId,
        accepted,
        participation.matchId,
        participation.teamId,
        participation.matchFormat,
        participation.isHome,
      );
    } catch (err) {
      console.error("Erreur lors de la réponse:", err);
    } finally {
      setRespondingIds((prev) => {
        const next = new Set(prev);
        next.delete(participationId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-gray-900 font-display">Participations</h1>
        <p className="mt-1 text-sm text-gray-500">Gère tes demandes de participation aux matchs</p>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="flex border-b border-gray-200"
      >
        <button
          onClick={() => setTab("requests")}
          className={`flex items-center gap-2 border-b-2 pb-3 pr-6 text-sm font-medium transition-colors ${
            tab === "requests"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Inbox size={16} /> Demandes
          {pending.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-100 px-1.5 text-xs font-bold text-primary-700">
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex items-center gap-2 border-b-2 pb-3 pr-6 text-sm font-medium transition-colors ${
            tab === "history"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <History size={16} /> Historique
          <span className="text-xs text-gray-400">({history.length})</span>
        </button>
      </motion.div>

      {/* Loading state */}
      {loading && <ParticipationSkeleton />}

      {/* Cards */}
      {!loading && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {displayed.map((participation, i) => {
              const isResponding = respondingIds.has(participation.id);
              const statusConf = STATUS_CONFIG[participation.status];
              const StatusIcon = statusConf.icon;

              return (
                <motion.div
                  key={participation.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
                >
                  <div className="p-4 sm:p-5">
                    {/* Match label */}
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-primary-500" />
                      <span className="text-sm font-bold text-gray-900">
                        {participation.matchLabel}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {participation.matchDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {participation.matchTime}
                      </span>
                      {participation.venueName && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {participation.venueName}
                        </span>
                      )}
                    </div>

                    {/* Status badge (history tab) */}
                    {participation.status !== "pending" && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusConf.color}`}>
                          <StatusIcon size={12} /> {statusConf.label}
                        </span>

                        {/* Goals/assists for confirmed participations */}
                        {participation.status === "confirmed" && (participation.goals > 0 || participation.assists > 0) && (
                          <div className="flex items-center gap-3 text-xs">
                            {participation.goals > 0 && (
                              <span className="flex items-center gap-1 font-semibold text-accent-600">
                                <Trophy size={12} /> {participation.goals} but{participation.goals > 1 ? "s" : ""}
                              </span>
                            )}
                            {participation.assists > 0 && (
                              <span className="flex items-center gap-1 text-gray-500">
                                {participation.assists} passe{participation.assists > 1 ? "s" : ""} D
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons (pending only) */}
                    {participation.status === "pending" && (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleRespond(participation, true)}
                          disabled={isResponding}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isResponding ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle size={14} />
                          )}
                          Accepter
                        </button>
                        <button
                          onClick={() => handleRespond(participation, false)}
                          disabled={isResponding}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isResponding ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <XCircle size={14} />
                          )}
                          Décliner
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Empty state */}
          {displayed.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                {tab === "requests" ? (
                  <Inbox size={32} className="text-gray-300" />
                ) : (
                  <History size={32} className="text-gray-300" />
                )}
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">
                {tab === "requests" ? "Aucune demande en attente" : "Aucun historique"}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {tab === "requests"
                  ? "Les demandes de participation apparaîtront ici quand un manager programmera un match"
                  : "Tes participations confirmées et déclinées apparaîtront ici"}
              </p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
