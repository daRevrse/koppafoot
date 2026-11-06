import { Alert, type AlertButton } from "react-native";
import { confirmer, prevenir } from "~/lib/confirmer";
import { messageDe } from "~/lib/message-erreur";

// La confirmation d'un geste qui détruit (retirer un membre, supprimer un
// joueur) : une vraie question, dont la réponse revient en promesse.

let boutons: AlertButton[] = [];
beforeEach(() => {
  boutons = [];
  jest.spyOn(Alert, "alert").mockImplementation((_titre, _message, b) => {
    boutons = b ?? [];
  });
});
afterEach(() => jest.restoreAllMocks());

describe("confirmer", () => {
  it("pose la question avec Annuler et le geste, le geste en rouge", async () => {
    const reponse = confirmer({ titre: "Retirer Ama ?", message: "Ama quittera l'effectif.", action: "Retirer" });
    expect(Alert.alert).toHaveBeenCalledWith("Retirer Ama ?", "Ama quittera l'effectif.", expect.any(Array), { cancelable: true, onDismiss: expect.any(Function) });
    expect(boutons.map((b) => [b.text, b.style])).toEqual([["Annuler", "cancel"], ["Retirer", "destructive"]]);
    boutons[1].onPress?.();
    await expect(reponse).resolves.toBe(true);
  });

  it("répond non quand on annule", async () => {
    const reponse = confirmer({ titre: "Supprimer ?", message: "", action: "Supprimer" });
    boutons[0].onPress?.();
    await expect(reponse).resolves.toBe(false);
  });
});

describe("prevenir", () => {
  it("montre un message avec un seul bouton", () => {
    prevenir("Retrait impossible", "Permission refusée.");
    expect(Alert.alert).toHaveBeenCalledWith("Retrait impossible", "Permission refusée.");
  });
});

describe("messageDe", () => {
  it("garde le message d'une route, traduit un refus des règles et une panne de réseau", () => {
    expect(messageDe(new Error("Créer une équipe demande le rôle manager."))).toBe("Créer une équipe demande le rôle manager.");
    expect(messageDe(new Error("Missing or insufficient permissions."))).toBe("Tu n'as pas les droits pour faire ça.");
    expect(messageDe(new Error("Network request failed"))).toBe("Pas de connexion. Réessaie quand le réseau revient.");
    expect(messageDe("bizarre", "Autre chose.")).toBe("Autre chose.");
  });
});
