import { useLastNotificationResponse, type NotificationResponse } from "expo-notifications";

/**
 * La dernière notification touchée, y compris celle qui a lancé l'application.
 *
 * Un module à part pour sa variante web (notification-touchee.web.ts) :
 * `getLastNotificationResponse` n'existe pas dans le navigateur, et l'appel
 * fait planter tout l'arbre au rendu de la version web d'Expo.
 */
export function useNotificationTouchee(): NotificationResponse | null {
  return useLastNotificationResponse() ?? null;
}
