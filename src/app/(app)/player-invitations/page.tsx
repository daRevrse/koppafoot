"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, MapPin, Clock, Check, X,
  Users, Inbox, ChevronRight, Loader2,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { onInvitationsForPlayer, respondToInvitation } from "@/lib/firestore";
import type { Invitation } from "@/types";

// ============================================
// Helpers
// ============================================

const COLOR_MAP: Record<string, { bg: string; icon: string; stripe: string }> = {
  amber: { bg: "bg-amber-100", icon: "text-amber-600", stripe: "bg-amber-500" },
  blue: { bg: "bg-blue-100", icon: "text-blue-600", stripe: "bg-blue-500" },
  red: { bg: "bg-red-100", icon: "text-red-600", stripe: "bg-red-500" },
  emerald: { bg: "bg-emerald-100", icon: "text-emerald-600", stripe: "bg-emerald-500" },
  purple: { bg: "bg-purple-100", icon: "text-purple-600", stripe: "bg-purple-500" },
  orange: { bg: "bg-orange-100", icon: "text-orange-600", stripe: "bg-orange-500" },
};

function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

// ============================================
// Component
// ============================================

export default function PlayerInvitationsPage() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<Record<string, "accepted" | "declined">>({});

  // Real-time listener for invitations
  useEffect(() => {
    if (!user) return;

    const unsub = onInvitationsForPlayer(user.uid, (data) => {
      setInvitations(data);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const pendingInvitations = invitations.filter((inv) => inv.status === "pending");

  const handleAccept = async (inv: Invitation) => {
    if (!user) return;
    setResponding((prev) => ({ ...prev, [inv.id]: "accepted" }));
    try {
      await respondToInvitation(inv.id, true, inv.teamId, user.uid);
    } catch (error) {
      console.error("Erreur lors de l'acceptation de l'invitation:", error);
      // Revert on error
      setResponding((prev) => {
        const next = { ...prev };
        delete next[inv.id];
        return next;
      });
    }
  };

  const handleDecline = async (inv: Invitation) => {
    setResponding((prev) => ({ ...prev, [inv.id]: "declined" }));
    try {
      await respondToInvitation(inv.id, false);
    } catch {
      setResponding((prev) => {
        const next = { ...prev };
        delete next[inv.id];
        return next;
      });
    }
  };

  if (!user) return null;

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 animate-pulse rounded-xl bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-48 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
              <div className="mt-3 h-20 animate-pulse rounded-lg bg-gray-100" />
              <div className="mt-4 flex gap-2">
                <div className="h-10 flex-1 animate-pulse rounded-lg bg-gray-200" />
                <div className="h-10 flex-1 animate-pulse rounded-lg bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pendingCount = pendingInvitations.filter((inv) => !responding[inv.id]).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 font-display">Invitations</h1>
          {pendingCount > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-500 px-2 text-xs font-bold text-white">
              {pendingCount}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Les équipes qui veulent te recruter
        </p>
      </motion.div>

      {/* Invitations list */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {pendingInvitations.map((inv, i) => {
            const colors = COLOR_MAP[inv.teamName?.charAt(0).toLowerCase() === "a" ? "amber" : inv.teamName?.charAt(0).toLowerCase() === "r" ? "red" : inv.teamName?.charAt(0).toLowerCase() === "f" ? "blue" : "emerald"] ?? COLOR_MAP.emerald;
            const status = responding[inv.id];

            return (
              <motion.div
                key={inv.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{
                  opacity: status ? 0.5 : 1,
                  y: 0,
                  scale: status ? 0.98 : 1,
                }}
                exit={{ opacity: 0, x: status === "accepted" ? 80 : -80, height: 0 }}
                transition={{ duration: 0.35, delay: !status ? i * 0.06 : 0 }}
                className="relative overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                {/* Color stripe */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.stripe}`} />

                <div className="p-5 pl-6">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors.bg}`}>
                        <Shield size={22} className={colors.icon} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 font-display">{inv.teamName}</h3>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><MapPin size={12} /> {inv.receiverCity}</span>
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={12} /> {timeAgo(inv.createdAt)}
                    </span>
                  </div>

                  {/* Message */}
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <p className="text-sm text-gray-600 leading-relaxed">&ldquo;{inv.message}&rdquo;</p>
                    <p className="mt-2 text-xs text-gray-400">
                      Invité par <span className="font-medium text-gray-600">{inv.senderName}</span> — Manager
                    </p>
                  </div>

                  {/* Actions */}
                  {!status ? (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleAccept(inv)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]"
                      >
                        <Check size={16} /> Accepter
                      </button>
                      <button
                        onClick={() => handleDecline(inv)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <X size={16} /> Décliner
                      </button>
                    </div>
                  ) : (
                    <div className={`mt-4 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium ${
                      status === "accepted"
                        ? "bg-primary-50 text-primary-600"
                        : "bg-gray-50 text-gray-500"
                    }`}>
                      {status === "accepted" ? (
                        <><Check size={16} /> Invitation acceptée</>
                      ) : (
                        <><X size={16} /> Invitation déclinée</>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty state */}
        {pendingInvitations.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <Inbox size={32} className="text-gray-300" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">Aucune invitation</h3>
            <p className="mt-1 text-sm text-gray-500">Les managers pourront t&apos;inviter à rejoindre leur équipe</p>
            <Link
              href="/teams/search"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Trouver une équipe <ChevronRight size={14} />
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
