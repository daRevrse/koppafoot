"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  UserPlus, Shield, MapPin, Clock, Check, X,
  Users, Inbox, ChevronRight,
} from "lucide-react";
import Link from "next/link";

// ============================================
// Mock data
// ============================================

interface Invitation {
  id: string;
  teamName: string;
  teamCity: string;
  teamMembers: number;
  invitedBy: string;
  invitedByRole: string;
  sentAt: string;
  message: string;
  color: string;
}

const MOCK_INVITATIONS: Invitation[] = [
  {
    id: "inv1",
    teamName: "AS Tonnerre",
    teamCity: "Lyon",
    teamMembers: 10,
    invitedBy: "Karim M.",
    invitedByRole: "Manager",
    sentAt: "Il y a 2 heures",
    message: "Salut ! On cherche un milieu de terrain dynamique, je pense que tu serais parfait pour notre équipe.",
    color: "amber",
  },
  {
    id: "inv2",
    teamName: "FC Étoile",
    teamCity: "Paris",
    teamMembers: 8,
    invitedBy: "Sarah L.",
    invitedByRole: "Manager",
    sentAt: "Hier",
    message: "On recrute pour la saison, viens jouer avec nous le week-end !",
    color: "blue",
  },
  {
    id: "inv3",
    teamName: "Red Wolves FC",
    teamCity: "Toulouse",
    teamMembers: 7,
    invitedBy: "Mehdi B.",
    invitedByRole: "Capitaine",
    sentAt: "Il y a 3 jours",
    message: "Notre équipe monte en puissance. On a besoin de renforts !",
    color: "red",
  },
];

const COLOR_MAP: Record<string, { bg: string; icon: string; stripe: string }> = {
  amber: { bg: "bg-amber-100", icon: "text-amber-600", stripe: "bg-amber-500" },
  blue: { bg: "bg-blue-100", icon: "text-blue-600", stripe: "bg-blue-500" },
  red: { bg: "bg-red-100", icon: "text-red-600", stripe: "bg-red-500" },
  emerald: { bg: "bg-emerald-100", icon: "text-emerald-600", stripe: "bg-emerald-500" },
};

// ============================================
// Component
// ============================================

export default function PlayerInvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>(MOCK_INVITATIONS);
  const [decided, setDecided] = useState<Record<string, "accepted" | "declined">>({});

  const handleAccept = (id: string) => {
    setDecided((prev) => ({ ...prev, [id]: "accepted" }));
    // Remove after animation
    setTimeout(() => {
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
    }, 600);
  };

  const handleDecline = (id: string) => {
    setDecided((prev) => ({ ...prev, [id]: "declined" }));
    setTimeout(() => {
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
    }, 600);
  };

  const pendingCount = invitations.filter((inv) => !decided[inv.id]).length;

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
          {invitations.map((inv, i) => {
            const colors = COLOR_MAP[inv.color] ?? COLOR_MAP.emerald;
            const status = decided[inv.id];

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
                          <span className="flex items-center gap-1"><MapPin size={12} /> {inv.teamCity}</span>
                          <span className="flex items-center gap-1"><Users size={12} /> {inv.teamMembers} joueurs</span>
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={12} /> {inv.sentAt}
                    </span>
                  </div>

                  {/* Message */}
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <p className="text-sm text-gray-600 leading-relaxed">&ldquo;{inv.message}&rdquo;</p>
                    <p className="mt-2 text-xs text-gray-400">
                      Invité par <span className="font-medium text-gray-600">{inv.invitedBy}</span> — {inv.invitedByRole}
                    </p>
                  </div>

                  {/* Actions */}
                  {!status ? (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleAccept(inv.id)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]"
                      >
                        <Check size={16} /> Accepter
                      </button>
                      <button
                        onClick={() => handleDecline(inv.id)}
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
        {invitations.length === 0 && (
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
