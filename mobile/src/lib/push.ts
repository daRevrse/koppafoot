import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { db } from "~/lib/firebase";

// ============================================
// Le push, dans l'application.
//
// L'APPLICATION N'EN RECEVAIT AUCUN. Le serveur envoie par Firebase Cloud
// Messaging aux jetons rangés dans `users.fcm_tokens` ; seul le site en
// déposait. Sur Android, le jeton natif de l'appareil EST un jeton FCM
// (google-services.json est déjà dans le projet) : il rejoint la même liste,
// et le serveur n'a rien d'autre à savoir.
//
// ANDROID SEULEMENT. L'application n'est construite que pour Android (voir
// eas.json) ; sur iPhone, le jeton natif serait un jeton APNs, que FCM
// n'accepte pas sans une configuration iOS qui n'existe pas encore.
//
// LA PERMISSION NE SE DEMANDE QU'AU GESTE, comme sur le site : l'interrupteur
// de l'onglet Compte. Un refus au lancement, par réflexe, coûte le canal.
//
// LE JETON EST PAR APPAREIL, la préférence est par compte : couper ici retire
// le jeton de CE téléphone, pas ceux de l'ordinateur. D'où la trace locale.
// ============================================

/** Le canal Android des notifications Koppafoot (repris par app.json, `defaultChannel`). */
export const CANAL_PUSH = "koppafoot";

const CLE_JETON = "koppafoot:push-token";

export type EtatPushMobile = "non-supporte" | "refuse" | "inactif" | "actif";

/** Au premier plan aussi, la notification s'affiche : un but ne doit pas passer inaperçu. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function etatPushMobile(): Promise<EtatPushMobile> {
  if (Platform.OS !== "android") return "non-supporte";
  const [perm, jeton] = await Promise.all([Notifications.getPermissionsAsync(), AsyncStorage.getItem(CLE_JETON)]);
  if (!perm.granted && !perm.canAskAgain) return "refuse";
  return perm.granted && jeton ? "actif" : "inactif";
}

/** Demande la permission, puis range le jeton de CE téléphone sur le compte. */
export async function activerPushMobile(uid: string): Promise<EtatPushMobile> {
  if (Platform.OS !== "android") return "non-supporte";
  await Notifications.setNotificationChannelAsync(CANAL_PUSH, {
    name: "Koppafoot",
    importance: Notifications.AndroidImportance.HIGH,
  });
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return perm.canAskAgain ? "inactif" : "refuse";

  const { data: jeton } = await Notifications.getDevicePushTokenAsync();
  if (typeof jeton !== "string" || !jeton) return "inactif";
  await updateDoc(doc(db, "users", uid), { fcm_tokens: arrayUnion(jeton) });
  await AsyncStorage.setItem(CLE_JETON, jeton);
  return "actif";
}

/** Retire le jeton de CE téléphone. Ne lève pas : se déconnecter doit toujours aboutir. */
export async function desactiverPushMobile(uid: string): Promise<EtatPushMobile> {
  const jeton = await AsyncStorage.getItem(CLE_JETON).catch(() => null);
  if (jeton) {
    await updateDoc(doc(db, "users", uid), { fcm_tokens: arrayRemove(jeton) }).catch(() => {});
    await AsyncStorage.removeItem(CLE_JETON).catch(() => {});
  }
  return Platform.OS === "android" ? "inactif" : "non-supporte";
}

/**
 * Le jeton peut changer (réinstallation des services Google, restauration) :
 * on remplace l'ancien par le nouveau sur le compte, sans rien redemander.
 */
export function suivreLeJeton(uid: string): () => void {
  const abonnement = Notifications.addPushTokenListener(async ({ data }) => {
    if (typeof data !== "string" || !data) return;
    const ancien = await AsyncStorage.getItem(CLE_JETON).catch(() => null);
    if (!ancien || ancien === data) return;
    await updateDoc(doc(db, "users", uid), { fcm_tokens: arrayRemove(ancien) }).catch(() => {});
    await updateDoc(doc(db, "users", uid), { fcm_tokens: arrayUnion(data) }).catch(() => {});
    await AsyncStorage.setItem(CLE_JETON, data).catch(() => {});
  });
  return () => abonnement.remove();
}

/** Le chemin du site que porte une notification (`data.link`), s'il en porte un. */
export function lienDeLaNotification(r: Notifications.NotificationResponse | null): string | null {
  const lien = r?.notification.request.content.data?.link;
  return typeof lien === "string" && lien.startsWith("/") && !lien.startsWith("//") ? lien : null;
}
