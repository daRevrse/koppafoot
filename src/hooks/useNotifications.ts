"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { onNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/firestore";
import type { Notification } from "@/types";

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = onNotifications(user.uid, setNotifications);
    return unsub;
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    void markNotificationRead(id);
  };

  const markAllRead = () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    void markAllNotificationsRead(user.uid);
  };

  return { notifications, unreadCount, markRead, markAllRead };
}
