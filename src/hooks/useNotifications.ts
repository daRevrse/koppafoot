"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { onNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/firestore";
import type { Notification } from "@/types";

export function useNotifications(max = 50) {
  const { user } = useAuth();
  // `null` = le premier snapshot n'est pas encore arrivé. C'est ce qui
  // distingue « on charge » de « boîte vide » sans poser un setState dans le
  // corps de l'effet, qui déclencherait un rendu en cascade.
  const [notifications, setNotifications] = useState<Notification[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onNotifications(user.uid, setNotifications, max);
    return unsub;
  }, [user, max]);

  const list = notifications ?? [];
  const loading = user != null && notifications === null;
  const unreadCount = list.filter((n) => !n.read).length;

  const markRead = (id: string) => {
    setNotifications((prev) =>
      (prev ?? []).map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    void markNotificationRead(id);
  };

  const markAllRead = () => {
    if (!user) return;
    setNotifications((prev) => (prev ?? []).map((n) => ({ ...n, read: true })));
    void markAllNotificationsRead(user.uid);
  };

  return { notifications: list, unreadCount, loading, markRead, markAllRead };
}
