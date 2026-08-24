"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { reconcilierPush, onForegroundMessage } from "@/lib/fcm-client";
import toast from "react-hot-toast";

// ============================================
// Le montage du push, dans la coque de l'application.
//
// Ce composant DEMANDAIT la permission ici même, au montage. C'était le
// défaut à corriger : une fenêtre système à l'ouverture, sans contexte, et un
// refus réflexe qui ferme le canal pour de bon. La demande a déménagé sous
// l'interrupteur du menu compte, là où quelqu'un choisit.
//
// Il reste deux choses, qui ne coûtent aucune fenêtre : garder le jeton de
// l'appareil à jour, et afficher les messages reçus pendant qu'on regarde
// l'application — le système ne les montre pas dans ce cas, sans ce toast ils
// n'arriveraient nulle part.
// ============================================

export default function PushNotificationSetup() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    reconcilierPush(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    const unsub = onForegroundMessage(({ body }) => {
      toast(body, { icon: "🔔", duration: 5000 });
    });
    return unsub;
  }, []);

  return null;
}
