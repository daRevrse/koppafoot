import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

type ModuleGoogle = typeof import("@react-native-google-signin/google-signin");

/** L'identifiant client OAuth « Web » du projet Firebase (google-services.json, client de type 3). */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let charge: ModuleGoogle | null | undefined;

/**
 * Le module Google Sign-In, ou null là où il n'existe pas.
 *
 * C'EST DU CODE NATIF, ABSENT D'EXPO GO : un import direct ferait planter
 * l'application au lancement dans Expo Go, où tout le reste se teste. On ne
 * le charge donc que dans un build de développement ou de production.
 *
 * Et sur Android seulement pour l'instant : l'application iOS n'est déclarée
 * ni dans Firebase ni chez Apple. Là où le module manque, le bouton Google
 * disparaît et l'e-mail reste.
 */
export function moduleGoogle(): ModuleGoogle | null {
  if (charge !== undefined) return charge;
  if (isRunningInExpoGo() || Platform.OS !== "android" || !WEB_CLIENT_ID) {
    charge = null;
    return charge;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement conditionnel voulu, voir plus haut
  const module = require("@react-native-google-signin/google-signin") as ModuleGoogle;
  module.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  charge = module;
  return charge;
}

export function googleDisponible(): boolean {
  return moduleGoogle() !== null;
}

/**
 * Les erreurs propres à Google, dites à l'utilisateur ; les autres (celles de
 * Firebase) restent à lib/auth-errors.
 *
 * Le code « 10 » est DEVELOPER_ERROR : l'empreinte de la clé qui a signé
 * cette version de l'application n'est pas déclarée dans Firebase.
 */
export function messageErreurGoogle(erreur: unknown): string | null {
  const google = moduleGoogle();
  if (!google || !google.isErrorWithCode(erreur)) return null;
  if (erreur.code === google.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return "Les services Google ne sont pas disponibles sur ce téléphone. Utilise ton e-mail.";
  }
  if (erreur.code === google.statusCodes.IN_PROGRESS) return "Connexion Google déjà en cours.";
  if (erreur.code === "10" || erreur.code === "DEVELOPER_ERROR") {
    return "La connexion Google n'est pas encore configurée pour cette version de l'application. Utilise ton e-mail.";
  }
  return null;
}
