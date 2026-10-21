import type { NotificationResponse } from "expo-notifications";

/** Le navigateur ne reçoit pas les notifications de l'application : voir notification-touchee.ts. */
export function useNotificationTouchee(): NotificationResponse | null {
  return null;
}
