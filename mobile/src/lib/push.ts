import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { cidDuSlug } from "~/lib/fiche-firestore";
import { db } from "~/lib/firebase";
import { destinationDuLien, ecranDeLaDestination } from "~/lib/lien-notification";
import { ouvrirSurLeSite } from "~/lib/navigateur";

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
//
// LA TRACE NE PROUVE PAS QUE LE COMPTE A LE JETON : le serveur retire ceux qu'il
// croit morts, et l'interrupteur resterait allumé sur un téléphone qui ne sonne
// plus. Un téléphone qui a choisi les notifications redépose donc le sien à
// chaque ouverture (reposerLeJeton).
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

/** Range le jeton de ce téléphone sur le compte, à la place de l'ancien s'il a changé. */
async function remplacerLeJeton(uid: string, ancien: string, jeton: string): Promise<void> {
  const compte = doc(db, "users", uid);
  if (ancien !== jeton) await updateDoc(compte, { fcm_tokens: arrayRemove(ancien) }).catch(() => {});
  await updateDoc(compte, { fcm_tokens: arrayUnion(jeton) }).catch(() => {});
  await AsyncStorage.setItem(CLE_JETON, jeton).catch(() => {});
}

/**
 * À l'ouverture : un téléphone qui a choisi les notifications (sa trace le dit)
 * remet son jeton sur le compte, qui a pu le perdre. Il rattrape aussi un jeton
 * changé pendant que l'application était fermée. Sans trace, on ne s'invite
 * pas : la permission ne se demande qu'au geste.
 */
export async function reposerLeJeton(uid: string): Promise<void> {
  if (Platform.OS !== "android") return;
  const [perm, ancien] = await Promise.all([Notifications.getPermissionsAsync(), AsyncStorage.getItem(CLE_JETON)]);
  if (!perm.granted || !ancien) return;
  const { data: jeton } = await Notifications.getDevicePushTokenAsync();
  if (typeof jeton !== "string" || !jeton) return;
  await remplacerLeJeton(uid, ancien, jeton);
}

/**
 * Le jeton peut changer (réinstallation des services Google, restauration) :
 * on remplace l'ancien par le nouveau sur le compte, sans rien redemander.
 */
export function suivreLeJeton(uid: string): () => void {
  void reposerLeJeton(uid).catch(() => {});
  const abonnement = Notifications.addPushTokenListener(async ({ data }) => {
    if (typeof data !== "string" || !data) return;
    const ancien = await AsyncStorage.getItem(CLE_JETON).catch(() => null);
    if (!ancien || ancien === data) return;
    await remplacerLeJeton(uid, ancien, data);
  });
  return () => abonnement.remove();
}

/** Le chemin du site que porte une notification (`data.link`), s'il en porte un. */
export function lienDeLaNotification(r: Notifications.NotificationResponse | null): string | null {
  const lien = r?.notification.request.content.data?.link;
  return typeof lien === "string" && lien.startsWith("/") && !lien.startsWith("//") ? lien : null;
}

/**
 * Ouvrir une adresse du site dans l'application : ce qu'annonce une
 * notification touchée, le match d'une forme, celui d'une fiche de club. Un
 * match, une compétition, une équipe, un club, un joueur, un amical ou le
 * classement des joueurs s'ouvrent dans leur écran ; le reste (une réservation, un espace
 * d'organisateur) sur le site, dans le navigateur intégré. `natif` : les
 * écrans de l'application sont ouverts (l'accueil est passé, le profil
 * existe) — sinon, le site.
 */
export async function ouvrirLeLien(lien: string, natif: boolean): Promise<void> {
  const destination = destinationDuLien(lien);
  if (natif && destination.genre !== "site") {
    const cid = "slug" in destination ? await cidDuSlug(destination.slug).catch(() => null) : null;
    const ecran = ecranDeLaDestination(destination, cid);
    if (ecran) {
      router.push(ecran);
      return;
    }
  }
  ouvrirSurLeSite(lien);
}
