"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Megaphone, Loader2, Send, X, Users, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";

interface CampaignStat {
  type: "manager_no_team" | "player_no_team" | "manager_welcome";
  count: number;
  defaults: { title: string; body: string; link: string };
}

const CAMPAIGN_META: Record<
  string,
  { label: string; description: string; icon: React.ReactNode; color: string }
> = {
  manager_no_team: {
    label: "Managers sans équipe",
    description: "Relance les managers inscrits qui n'ont pas encore créé leur équipe.",
    icon: <Users size={18} />,
    color: "text-amber-600 bg-amber-50",
  },
  player_no_team: {
    label: "Joueurs sans candidature",
    description: "Encourage les joueurs qui n'ont jamais postulé à une équipe.",
    icon: <UserCheck size={18} />,
    color: "text-emerald-600 bg-emerald-50",
  },
  manager_welcome: {
    label: "Nouveaux managers (< 48h)",
    description: "Email de bienvenue aux managers récemment inscrits.",
    icon: <Megaphone size={18} />,
    color: "text-blue-600 bg-blue-50",
  },
};

export default function AdminCampaignsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CampaignStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [active, setActive] = useState<CampaignStat | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const fbUser = auth.currentUser;
        if (!fbUser) return;
        const token = await fbUser.getIdToken();
        const res = await fetch("/api/admin/campaigns", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setStats(await res.json());
      } finally {
        setLoadingStats(false);
      }
    };
    load();
  }, [user]);

  const openModal = (stat: CampaignStat) => {
    setActive(stat);
    setEditTitle(stat.defaults.title);
    setEditBody(stat.defaults.body);
  };

  const closeModal = () => {
    setActive(null);
    setEditTitle("");
    setEditBody("");
  };

  const handleSend = async () => {
    if (!active || !editTitle.trim() || !editBody.trim()) return;
    setSending(true);
    try {
      const fbUser = auth.currentUser;
      if (!fbUser) throw new Error("Non connecté");
      const token = await fbUser.getIdToken();
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campaignType: active.type,
          title: editTitle.trim(),
          body: editBody.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Erreur"); return; }
      toast.success(`Campagne envoyée à ${data.count} utilisateur(s) !`);
      closeModal();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-extrabold text-gray-900 font-display"
        >
          Campagnes
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-gray-500 mt-0.5"
        >
          Emails de relance ciblés — in-app + push + email personnalisé
        </motion.p>
      </div>

      {loadingStats ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="space-y-4">
          {stats.map((stat, i) => {
            const meta = CAMPAIGN_META[stat.type];
            return (
              <motion.div
                key={stat.type}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm flex items-center gap-4"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.color}`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">{meta.label}</p>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                      {stat.count} destinataire{stat.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{meta.description}</p>
                </div>
                <button
                  onClick={() => openModal(stat)}
                  disabled={stat.count === 0}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={13} />
                  Envoyer
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-gray-900 font-display">
                  {CAMPAIGN_META[active.type].label}
                </h3>
                <button
                  onClick={closeModal}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">Titre</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={80}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-gray-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">Message</label>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    maxLength={400}
                    className="w-full resize-none rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-gray-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {active.count} destinataire{active.count !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={closeModal}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !editTitle.trim() || !editBody.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Confirmer l'envoi
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
