"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNotifications } from "@/hooks/useNotifications";
import { useRouter } from "next/navigation";
import type { Notification } from "@/types";

function NotificationItem({
  n,
  onRead,
}: {
  n: Notification;
  onRead: (id: string) => void;
}) {
  const router = useRouter();

  const handleClick = () => {
    onRead(n.id);
    if (n.link) router.push(n.link);
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50 ${
        !n.read ? "bg-emerald-50/60" : ""
      }`}
    >
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.read ? "bg-emerald-500" : "bg-transparent"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{n.title}</p>
        <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{n.body}</p>
        <p className="mt-1 text-[10px] text-gray-400">
          {new Date(n.createdAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </button>
  );
}

export default function NotificationDropdown() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
      >
        <Bell size={18} className="lg:w-5 lg:h-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-bold text-gray-900">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  <CheckCheck size={13} />
                  Tout marquer lu
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">
                  Aucune notification
                </p>
              ) : (
                notifications.map((n) => (
                  <NotificationItem key={n.id} n={n} onRead={markRead} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
