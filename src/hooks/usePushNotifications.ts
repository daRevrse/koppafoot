"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { activerPush, desactiverPush, etatPush, type EtatPush } from "@/lib/fcm-client";
import { CATEGORIES_PUSH, type PushCategory, type PushPrefs } from "@/lib/push-categories";

// ============================================
// L'état du push, pour l'interrupteur du menu compte.
//
// L'ÉTAT NE SE LIT QU'APRÈS LE MONTAGE. `Notification.permission` et
// localStorage n'existent pas sur le serveur : les lire au rendu ferait
// diverger les deux passes et React remplacerait le bloc entier. D'où le
// départ à `null`, que l'appelant traduit par « on ne sait pas encore ».
//
// DEUX PORTÉES DIFFÉRENTES, et c'est la subtilité du réglage :
//  - l'interrupteur principal vaut pour CET APPAREIL (le jeton y vit) ;
//  - les catégories valent pour LE COMPTE (le serveur filtre à l'envoi).
// Les mélanger donnerait un réglage qui ment sur au moins un des deux points.
// ============================================

export interface ReglagePush {
  /** `null` tant que le navigateur n'a pas été interrogé. */
  etat: EtatPush | null;
  /** Les catégories, absence résolue en `true`. */
  prefs: Record<PushCategory, boolean>;
  occupe: boolean;
  activer: () => Promise<void>;
  desactiver: () => Promise<void>;
  basculer: (categorie: PushCategory) => Promise<void>;
}

function resoudre(prefs: PushPrefs | undefined): Record<PushCategory, boolean> {
  return Object.fromEntries(
    CATEGORIES_PUSH.map((c) => [c, prefs?.[c] !== false]),
  ) as Record<PushCategory, boolean>;
}

export function usePushNotifications(): ReglagePush {
  const { user, updateProfile } = useAuth();
  const [etat, setEtat] = useState<EtatPush | null>(null);
  const [occupe, setOccupe] = useState(false);

  // L'ÉTAT SE RELIT, il ne se lit pas une fois.
  //
  // Le bloc reste monté tant que la feuille du compte existe, et la phrase
  // qu'on affiche en cas de refus envoie l'utilisateur dans les réglages du
  // navigateur. Sans réécoute, il autorise, revient, et retrouve exactement le
  // même message : notre propre consigne mènerait à un écran qui ment.
  //
  // `permissions.query` prévient au moment précis où la permission change.
  // Firefox et quelques Safari ne l'exposent pas pour les notifications, d'où
  // le retour au premier plan comme filet : c'est le geste qui suit toujours
  // un aller-retour dans les réglages.
  useEffect(() => {
    const relire = () => setEtat(etatPush());
    relire();

    let statut: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: "notifications" as PermissionName })
      .then((s) => {
        statut = s;
        s.addEventListener("change", relire);
      })
      .catch(() => {});

    document.addEventListener("visibilitychange", relire);
    window.addEventListener("focus", relire);
    return () => {
      statut?.removeEventListener("change", relire);
      document.removeEventListener("visibilitychange", relire);
      window.removeEventListener("focus", relire);
    };
  }, [user?.uid]);

  const activer = useCallback(async () => {
    if (!user || occupe) return;
    setOccupe(true);
    try {
      setEtat(await activerPush(user.uid));
    } finally {
      setOccupe(false);
    }
  }, [user?.uid, occupe]);

  const desactiver = useCallback(async () => {
    if (!user || occupe) return;
    setOccupe(true);
    try {
      setEtat(await desactiverPush(user.uid));
    } finally {
      setOccupe(false);
    }
  }, [user?.uid, occupe]);

  const basculer = useCallback(
    async (categorie: PushCategory) => {
      if (!user || occupe) return;
      const actuel = resoudre(user.pushPrefs);
      setOccupe(true);
      try {
        // On réécrit l'objet entier plutôt qu'une clé pointée : Firestore
        // remplacerait la map en `merge`, et les catégories décochées
        // ailleurs reviendraient silencieusement à oui.
        await updateProfile({
          push_prefs: { ...actuel, [categorie]: !actuel[categorie] },
        });
      } finally {
        setOccupe(false);
      }
    },
    [user?.uid, user?.pushPrefs, occupe, updateProfile],
  );

  return { etat, prefs: resoudre(user?.pushPrefs), occupe, activer, desactiver, basculer };
}
