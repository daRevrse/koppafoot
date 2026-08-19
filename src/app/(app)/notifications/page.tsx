"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Bell, CheckCheck, ChevronRight, Inbox, Loader2, Megaphone,
  Swords, ClipboardCheck, UserPlus, Users, Star,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import type { Notification, NotificationType } from "@/types";

// ============================================
// /notifications — l'écran qui manquait derrière la cloche.
//
// Le dropdown du header coupe le corps du message à deux lignes et ne garde
// que les plus récentes : rien ne permettait de relire une notification, ni
// de retrouver celle qu'on avait fermée par erreur. Ici l'historique complet,
// filtrable, groupé par jour, avec le même geste qu'au clic sur la cloche
// (marquer lu puis suivre le lien).
// ============================================

const HISTORY_SIZE = 200;

const TYPE_META: Record<
  NotificationType,
  { label: string; Icon: typeof Bell; tone: string }
> = {
  invitation:            { label: "Invitation",  Icon: UserPlus,       tone: "bg-emerald-50 text-emerald-600" },
  join_request:          { label: "Candidature", Icon: Inbox,          tone: "bg-blue-50 text-blue-600" },
  match_challenge:       { label: "Défi",        Icon: Swords,         tone: "bg-amber-50 text-amber-600" },
  participation_request: { label: "Convocation", Icon: ClipboardCheck, tone: "bg-purple-50 text-purple-600" },
  admin_message:         { label: "Message",     Icon: Megaphone,      tone: "bg-red-50 text-red-600" },
  team_activity:         { label: "Mon équipe",  Icon: Users,          tone: "bg-emerald-50 text-emerald-600" },
  follow_activity:       { label: "Suivi",       Icon: Star,           tone: "bg-sky-50 text-sky-600" },
};

const FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "unread", label: "Non lues" },
  { key: "team", label: "Mon équipe" },
  { key: "market", label: "Mercato" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const MARKET_TYPES: NotificationType[] = ["invitation", "join_request"];
const TEAM_TYPES: NotificationType[] = [
  "team_activity", "follow_activity", "match_challenge", "participation_request",
];

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === dayKey(today.toISOString())) return "Aujourd'hui";
  if (key === dayKey(yesterday.toISOString())) return "Hier";
  try {
    return new Date(`${key}T00:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  } catch {
    return key;
  }
}

function hourLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function NotificationRow({
  n, onRead,
}: {
  n: Notification;
  onRead: (id: string) => void;
}) {
  const router = useRouter();
  const meta = TYPE_META[n.type] ?? TYPE_META.admin_message;
  const { Icon } = meta;

  const open = () => {
    if (!n.read) onRead(n.id);
    if (n.link) router.push(n.link);
  };

  return (
    <button
      onClick={open}
      className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-gray-50/70 ${
        n.read ? "" : "bg-emerald-50/40"
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
        <Icon size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-gray-900">{n.title}</p>
          {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />}
        </div>
        {/* Le message en entier : c'est exactement ce que la cloche tronquait. */}
        <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{n.body}</p>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] font-bold text-gray-400">
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-500">{meta.label}</span>
          <span>{hourLabel(n.createdAt)}</span>
        </div>
      </div>

      {n.link && <ChevronRight size={16} className="mt-2 shrink-0 text-gray-300" />}
    </button>
  );
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markRead, markAllRead } =
    useNotifications(HISTORY_SIZE);
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    switch (filter) {
      case "unread": return notifications.filter((n) => !n.read);
      case "team":   return notifications.filter((n) => TEAM_TYPES.includes(n.type));
      case "market": return notifications.filter((n) => MARKET_TYPES.includes(n.type));
      default:       return notifications;
    }
  }, [notifications, filter]);

  const days = useMemo(() => {
    const buckets = new Map<string, Notification[]>();
    for (const n of filtered) {
      const key = dayKey(n.createdAt);
      const bucket = buckets.get(key) ?? [];
      bucket.push(n);
      buckets.set(key, bucket);
    }
    // La requête arrive déjà en created_at desc : l'ordre d'insertion des
    // seaux est donc le bon, du plus récent au plus ancien.
    return [...buckets.entries()];
  }, [filtered]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* En-tête */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 font-display text-2xl font-black text-gray-900">
            Notifications
            {unreadCount > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-500 px-2 text-xs font-black text-white">
                {unreadCount}
              </span>
            )}
          </h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50"
            >
              <CheckCheck size={14} />
              <span className="hidden sm:inline">Tout marquer lu</span>
              <span className="sm:hidden">Tout lu</span>
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Tout ce qui bouge sur tes équipes, tes compétitions et ton mercato.
        </p>
      </motion.div>

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-black transition-colors ${
              filter === f.key
                ? "bg-gray-900 text-white"
                : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            {f.label}
            {f.key === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : days.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <Bell size={30} className="text-gray-300" />
          <h2 className="mt-4 font-display text-lg font-black text-gray-900">
            {filter === "all" ? "Aucune notification" : "Rien dans ce filtre"}
          </h2>
          <p className="mt-1 max-w-xs text-sm text-gray-500">
            Suis une compétition ou rejoins une équipe pour être prévenu de ce
            qui s&apos;y passe.
          </p>
          <Link
            href="/competitions"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-emerald-600"
          >
            Voir les compétitions
            <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map(([key, items]) => (
            <div
              key={key}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-2.5">
                <p className="text-xs font-black uppercase tracking-wide text-gray-500">
                  {dayLabel(key)}
                </p>
                <span className="text-[11px] font-bold text-gray-400">
                  {items.length}
                </span>
              </div>
              {items.map((n) => (
                <NotificationRow key={n.id} n={n} onRead={markRead} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
