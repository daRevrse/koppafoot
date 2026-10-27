import { phraseDeRaison } from "~/lib/raisons-auth";

describe("phraseDeRaison", () => {
  it("dit pourquoi on demande un compte", () => {
    expect(phraseDeRaison("pronostic", "défaut")).toBe("Crée ton compte pour donner ton pronostic.");
    expect(phraseDeRaison("tchat", "défaut")).toBe("Connecte-toi pour écrire dans le tchat du match.");
    expect(phraseDeRaison("suivre", "défaut")).toBe("Crée un compte pour suivre cette compétition.");
    expect(phraseDeRaison("role", "défaut")).toBe("Crée ton compte pour choisir ton rôle : joueur, manager ou arbitre.");
    expect(phraseDeRaison("casquette", "défaut")).toBe("Crée ton compte pour demander une casquette : organisateur, scoreur ou propriétaire de terrain.");
  });

  it("garde la phrase de l'écran sans raison, ou pour une raison inconnue", () => {
    expect(phraseDeRaison(undefined, "défaut")).toBe("défaut");
    expect(phraseDeRaison("toString", "défaut")).toBe("défaut");
  });
});
