import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Les vibrations de l'application, en un seul endroit. Un téléphone sans
// moteur de vibration rejette la promesse : on l'ignore, ce n'est qu'un
// agrément. Sur le web, rien.

/** Le choix d'un jour ou d'un filtre. */
export function retourSelection(): void {
  if (Platform.OS === "web") return;
  Haptics.selectionAsync().catch(() => {});
}

/** L'étoile d'une compétition. */
export function retourImpact(): void {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
