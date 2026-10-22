import { phraseDeRaison } from "~/lib/raisons-auth";

describe("phraseDeRaison", () => {
  it("dit pourquoi on demande un compte", () => {
    expect(phraseDeRaison("pronostic", "défaut")).toBe("Crée ton compte pour donner ton pronostic.");
    expect(phraseDeRaison("tchat", "défaut")).toBe("Connecte-toi pour écrire dans le tchat du match.");
    expect(phraseDeRaison("suivre", "défaut")).toBe("Crée un compte pour suivre cette compétition.");
  });

  it("garde la phrase de l'écran sans raison, ou pour une raison inconnue", () => {
    expect(phraseDeRaison(undefined, "défaut")).toBe("défaut");
    expect(phraseDeRaison("toString", "défaut")).toBe("défaut");
  });
});
