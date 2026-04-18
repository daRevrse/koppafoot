"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings, Shield, UserPlus, Mail, Loader2,
  CheckCircle, XCircle, AlertTriangle, Crown, Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";

interface AdminUser {
  uid: string;
  email: string | null;
  firstName: string;
  lastName: string;
  isSelf: boolean;
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Fetch existing superadmins
  useEffect(() => {
    if (!user) return;
    const fetchAdmins = async () => {
      try {
        const q = query(
          collection(db, "users"),
          where("user_type", "==", "superadmin")
        );
        const snap = await getDocs(q);
        const list: AdminUser[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            email: data.email,
            firstName: data.first_name,
            lastName: data.last_name,
            isSelf: d.id === user.uid,
          };
        });
        // Put self first
        list.sort((a, b) => (a.isSelf ? -1 : b.isSelf ? 1 : 0));
        setAdmins(list);
      } catch (err) {
        console.error("Error fetching admins:", err);
      } finally {
        setLoadingAdmins(false);
      }
    };
    fetchAdmins();
  }, [user]);

  const getToken = async (): Promise<string> => {
    const fbUser = auth.currentUser;
    if (!fbUser) throw new Error("Non connecté");
    return fbUser.getIdToken();
  };

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: email.trim(), action: "promote" }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }

      toast.success(`${email} promu superadmin !`);
      setEmail("");

      // Refresh admins list
      setLoadingAdmins(true);
      const q = query(
        collection(db, "users"),
        where("user_type", "==", "superadmin")
      );
      const snap = await getDocs(q);
      setAdmins(
        snap.docs.map((d) => {
          const dd = d.data();
          return {
            uid: d.id,
            email: dd.email,
            firstName: dd.first_name,
            lastName: dd.last_name,
            isSelf: d.id === user?.uid,
          };
        })
      );
      setLoadingAdmins(false);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (adminUser: AdminUser) => {
    if (adminUser.isSelf) {
      toast.error("Impossible de révoquer vos propres droits");
      return;
    }
    if (!adminUser.email) return;

    const confirmed = window.confirm(
      `Révoquer les droits superadmin de ${adminUser.firstName} ${adminUser.lastName} (${adminUser.email}) ?`
    );
    if (!confirmed) return;

    setRevoking(adminUser.uid);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: adminUser.email, action: "revoke" }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }

      toast.success(`Droits superadmin révoqués pour ${adminUser.email}`);
      setAdmins((prev) => prev.filter((a) => a.uid !== adminUser.uid));
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setRevoking(null);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-extrabold text-gray-900 font-display"
        >
          Paramètres
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-gray-500 mt-0.5"
        >
          Gestion des super-administrateurs de la plateforme
        </motion.p>
      </div>

      {/* Add superadmin form */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <UserPlus size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 font-display">
              Ajouter un superadmin
            </h3>
            <p className="text-xs text-gray-500">
              L'utilisateur doit déjà avoir un compte sur la plateforme
            </p>
          </div>
        </div>

        <form onSubmit={handlePromote} className="flex gap-3">
          <div className="relative flex-1">
            <Mail
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="email"
              placeholder="Email de l'utilisateur à promouvoir..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Crown size={16} />
            )}
            Promouvoir
          </button>
        </form>

        {/* Warning */}
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            Un superadmin a un accès complet à toutes les données de la
            plateforme. N'accordez ce rôle qu'aux personnes de confiance.
          </p>
        </div>
      </motion.div>

      {/* Current superadmins list */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
            <Shield size={20} className="text-purple-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 font-display">
              Super-administrateurs actifs
            </h3>
            <p className="text-xs text-gray-500">
              {admins.length} superadmin{admins.length > 1 ? "s" : ""} sur la
              plateforme
            </p>
          </div>
        </div>

        {loadingAdmins ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Aucun superadmin trouvé
          </p>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {admins.map((a, i) => (
                <motion.div
                  key={a.uid}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 group"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white uppercase">
                    {a.firstName?.[0]}
                    {a.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {a.firstName} {a.lastName}
                      </p>
                      {a.isSelf && (
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                          VOUS
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {a.email || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-semibold text-purple-700">
                      <Crown size={11} /> Superadmin
                    </span>
                    {!a.isSelf && (
                      <button
                        onClick={() => handleRevoke(a)}
                        disabled={revoking === a.uid}
                        className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 disabled:opacity-50"
                      >
                        {revoking === a.uid ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        Révoquer
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* CLI instructions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
            <Settings size={20} className="text-gray-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 font-display">
              Bootstrap via CLI
            </h3>
            <p className="text-xs text-gray-500">
              Pour créer le tout premier superadmin (sans accès admin)
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-gray-900 p-4 font-mono text-sm text-emerald-400 overflow-x-auto">
          npx tsx scripts/promote-superadmin.ts votre@email.com
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Cette commande trouve l'utilisateur par email et modifie son rôle en
          superadmin directement dans Firestore.
        </p>
      </motion.div>
    </div>
  );
}
