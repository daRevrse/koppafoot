"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { requestPushPermission, onForegroundMessage } from "@/lib/fcm-client";
import toast from "react-hot-toast";

export default function PushNotificationSetup() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    requestPushPermission(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    const unsub = onForegroundMessage(({ body }) => {
      toast(body, { icon: "🔔", duration: 5000 });
    });
    return unsub;
  }, []);

  return null;
}
