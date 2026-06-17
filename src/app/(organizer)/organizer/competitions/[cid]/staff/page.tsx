"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Loader2, ShieldCheck, UserPlus, Trash2, Mail,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { onCompetition } from "@/lib/competition-firestore";
import type { Competition, FirestoreUser } from "@/types";
import toast from "react-hot-toast";

interface ModeratorRow {
  uid: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

export default function CompetitionStaffPage() {
  const params = useParams<{ cid: string }>();
  const cid = params.cid;
  const { user, firebaseUser } = useAuth();
  const router = useRouter();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [moderators, setModerators] = useState<ModeratorRow[]>([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  useEffect(() => {
    if (!cid) return;
    const unsubscribe = onCompetition(cid, setCompetition);
    return unsubscribe;
  }, [cid]);

  // Guard: only organizers of this competition may view the staff screen.
  useEffect(() => {
    if (!user || !competition) return;
    if (!competition.organizerIds.includes(user.uid)) {
      router.replace("/organizer");
    }
  }, [user, competition, router]);

  // Resolve moderator names whenever the moderatorIds list changes. Users are
  // publicly readable, so a direct getDoc per uid is fine here.
  useEffect(() => {
    const ids = competition?.moderatorIds;
    if (!ids) return;
    if (ids.length === 0) {
      setModerators([]);
      return;
    }
    let cancelled = false;
    setLoadingMods(true);
    (async () => {
      const rows = await Promise.all(
        ids.map(async (uid): Promise<ModeratorRow> => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
              const d = snap.data() as FirestoreUser;
              return { uid, firstName: d.first_name, lastName: d.last_name, email: d.email };
            }
          } catch (err) {
            console.error("Error loading moderator profile:", err);
          }
          return { uid, firstName: "", lastName: "", email: null };
        }),
      );
      if (!cancelled) {
        setModerators(rows);
        setLoadingMods(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [competition?.moderatorIds]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Saisis une adresse e-mail");
      return;
    }
    if (!firebaseUser) {
      toast.error("Session expirée, reconnecte-toi");
      return;
    }
    setSubmitting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/moderators", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cid, email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue");
        return;
      }
      const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || trimmed;
      toast.success(`${name} ajouté comme modérateur`);
      setEmail("");
      // onCompetition will refresh moderatorIds live.
    } catch (err) {
      console.error("Error adding moderator:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (uid: string) => {
    if (!firebaseUser) {
      toast.error("Session expirée, reconnecte-toi");
      return;
    }
    setRemovingUid(uid);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/moderators", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cid, uid }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue");
        return;
      }
      toast.success("Modérateur retiré");
      // onCompetition will refresh moderatorIds live.
    } catch (err) {
      console.error("Error removing moderator:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setRemovingUid(null);
    }
  };

  if (!competition) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href={`/organizer/competitions/${cid}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-primary-600"
      >
        <ArrowLeft size={16} />
        Tableau de bord
      </Link>

      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-2xl font-extrabold text-gray-900"
        >
          Staff
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="mt-0.5 max-w-xl text-sm text-gray-500"
        >
          Les modérateurs peuvent saisir les matchs en direct, sans accès à la configuration.
        </motion.p>
      </div>

      {/* Add form */}
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Mail
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="email"
            placeholder="e-mail du modérateur"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-4 text-sm focus:border-primary-500 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          Ajouter
        </button>
      </motion.form>

      {/* Moderators list */}
      {loadingMods ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={26} className="animate-spin text-gray-300" />
        </div>
      ) : moderators.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
            <ShieldCheck size={26} className="text-primary-500" />
          </div>
          <p className="mt-4 text-base font-bold text-gray-900">Aucun modérateur</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Invite un membre par e-mail pour qu&apos;il puisse saisir les scores en direct.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {moderators.map((mod) => {
              const fullName = [mod.firstName, mod.lastName].filter(Boolean).join(" ");
              return (
                <motion.div
                  key={mod.uid}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                    <ShieldCheck size={20} className="text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {fullName || "Membre"}
                    </p>
                    {mod.email && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">{mod.email}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(mod.uid)}
                    disabled={removingUid === mod.uid}
                    aria-label={`Retirer ${fullName || "ce modérateur"}`}
                    className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    {removingUid === mod.uid ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
