import {
  attenteAvantMessage, lireMessage, ongletTchatVisible, tchatOuvert, TCHAT_MAX, texteDuMessage,
} from "@/lib/tchat";

// Le module vit côté site (src/lib/tchat) ; il est pur, et c'est ici que la
// suite de tests des modules partagés tourne.

describe("texteDuMessage", () => {
  it("met le message sur une ligne et le nettoie", () => {
    expect(texteDuMessage("  Allez   les\n\nBleus ! ")).toBe("Allez les Bleus !");
  });

  it("refuse un message vide, trop long, ou qui n'est pas du texte", () => {
    expect(texteDuMessage("   ")).toBeNull();
    expect(texteDuMessage("x".repeat(TCHAT_MAX + 1))).toBeNull();
    expect(texteDuMessage(42)).toBeNull();
    expect(texteDuMessage("x".repeat(TCHAT_MAX))).toHaveLength(TCHAT_MAX);
  });
});

describe("l'onglet et l'écriture", () => {
  it("n'écrit que pendant le direct", () => {
    expect(tchatOuvert("live")).toBe(true);
    expect(tchatOuvert("completed")).toBe(false);
    expect(tchatOuvert("scheduled")).toBe(false);
  });

  it("montre l'onglet en direct, puis en lecture seule s'il y a de quoi relire", () => {
    expect(ongletTchatVisible("live", 0)).toBe(true);
    expect(ongletTchatVisible("completed", 3)).toBe(true);
    expect(ongletTchatVisible("completed", 0)).toBe(false);
    expect(ongletTchatVisible("scheduled", 3)).toBe(false);
  });
});

describe("lireMessage", () => {
  it("relit un message", () => {
    expect(lireMessage("m1", { texte: "But !", auteur_uid: "u1", auteur_nom: "Kossi A.", cree_le: { toMillis: () => 9 } }))
      .toEqual({ id: "m1", texte: "But !", auteurUid: "u1", auteurNom: "Kossi A.", creeLeMs: 9, supprime: false });
  });

  it("vide un message supprimé, même si un texte traîne", () => {
    expect(lireMessage("m1", { texte: "insulte", auteur_uid: "u1", supprime: true })?.texte).toBeNull();
  });

  it("écarte un message sans auteur", () => {
    expect(lireMessage("m1", { texte: "?" })).toBeNull();
  });
});

describe("attenteAvantMessage", () => {
  it("laisse écrire au premier message et après cinq secondes", () => {
    expect(attenteAvantMessage(null, 10_000)).toBe(0);
    expect(attenteAvantMessage(1_000, 6_000)).toBe(0);
  });

  it("fait patienter entre deux messages trop rapprochés", () => {
    expect(attenteAvantMessage(1_000, 3_000)).toBe(3_000);
  });
});
