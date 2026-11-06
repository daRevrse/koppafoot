import { Alert } from "react-native";

// Demander avant un geste qui détruit, prévenir quand un geste échoue. Sur le
// web, Alert de React Native ne fait rien : confirmer.web.ts prend le relais.

/** La question, et la réponse en promesse : vrai si l'on confirme. */
export function confirmer(q: { titre: string; message: string; action: string }): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      q.titre,
      q.message,
      [
        { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
        { text: q.action, style: "destructive", onPress: () => resolve(true) },
      ],
      // Android : toucher à côté referme la boîte, c'est un non.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function prevenir(titre: string, message: string): void {
  Alert.alert(titre, message);
}
