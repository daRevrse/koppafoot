"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";

const TARGET_OPTIONS = [
  { value: "all", label: "Tous les utilisateurs" },
  { value: "player", label: "Joueurs uniquement" },
  { value: "manager", label: "Managers uniquement" },
  { value: "referee", label: "Arbitres uniquement" },
  { value: "venue_owner", label: "Propriétaires de terrain" },
  { value: "email", label: "Email spécifique" },
];

export default function AdminMessagesPage() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("all");
  const [customTarget, setCustomTarget] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTarget = target === "email" ? customTarget.trim() : target;
    if (!finalTarget) return;

    setLoading(true);
    try {
      const fbUser = auth.currentUser;
      if (!fbUser) throw new Error("Non connecté");
      const token = await fbUser.getIdToken();
      const res = await fetch("/api/admin/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), target: finalTarget }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }
      toast.success(`Message envoyé à ${data.count} utilisateur(s)`);
      setTitle("");
      setBody("");
      setTarget("all");
      setCustomTarget("");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-extrabold text-gray-900 font-display"
        >
          Messages
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-gray-500 mt-0.5"
        >
          Envoyez une notification à un segment ou à tous les utilisateurs
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <MessageSquare size={20} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 font-display">Nouveau message</h3>
            <p className="text-xs text-gray-500">Notification in-app + push + email (haute priorité)</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">Destinataires</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-gray-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
            >
              {TARGET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {target === "email" && (
            <input
              type="email"
              placeholder="Email de l'utilisateur..."
              value={customTarget}
              onChange={(e) => setCustomTarget(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
            />
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">Titre</label>
            <input
              type="text"
              placeholder="Titre de la notification..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={80}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">Message</label>
            <textarea
              placeholder="Contenu du message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              maxLength={400}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !title.trim() || !body.trim()}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Envoyer
          </button>
        </form>
      </motion.div>
    </div>
  );
}
