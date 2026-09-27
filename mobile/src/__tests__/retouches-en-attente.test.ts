import {
  ajouterRetouche, appliquerRetouches, estHorsLigne, lireFile, retirerRetouche, sansLesEvenements,
  type Retouche,
} from "@/lib/retouches-en-attente";
import type { Evenement } from "@/lib/retrait-evenement";

// Le module vit côté site (src/lib/retouches-en-attente) ; il est pur, et
// c'est ici que la suite de tests des modules partagés tourne.

const ev = (p: Partial<Evenement> & Pick<Evenement, "id" | "type">): Evenement => ({
  period: 1, minute: 10, teamId: "H", createdAt: "", ...p,
});

const passeur = (eventId: string, nom: string): Retouche => ({
  genre: "passeur", eventId, valeur: { playerId: nom, playerName: nom },
});

describe("la file des retouches", () => {
  it("garde la dernière réponse à une même question", () => {
    const file = ajouterRetouche(ajouterRetouche([], passeur("b1", "Komla")), passeur("b1", "Yawa"));
    expect(file).toEqual([passeur("b1", "Yawa")]);
  });

  it("distingue les questions : un passeur et une victime cohabitent", () => {
    const victime: Retouche = { genre: "victime", eventId: "f1", valeur: null };
    expect(ajouterRetouche([passeur("b1", "Komla")], victime)).toHaveLength(2);
  });

  it("retire une retouche écrite, et celles d'un événement retiré", () => {
    const file = [passeur("b1", "Komla"), passeur("b2", "Yawa")];
    expect(retirerRetouche(file, { genre: "passeur", eventId: "b1" })).toEqual([passeur("b2", "Yawa")]);
    expect(sansLesEvenements(file, ["b2"])).toEqual([passeur("b1", "Komla")]);
  });

  it("montre l'événement retouché en attendant le réseau", () => {
    const events = [
      ev({ id: "b1", type: "goal", playerId: "h9" }),
      ev({ id: "f1", type: "foul", playerId: "h2" }),
      ev({ id: "p1", type: "penalty" }),
    ];
    const file: Retouche[] = [
      passeur("b1", "Komla"),
      { genre: "victime", eventId: "f1", valeur: { playerId: "a4", playerName: "Kofi" } },
      { genre: "penalty", eventId: "p1", valeur: { issue: "marque", tireur: { playerId: "h9", playerName: "Elom" } } },
    ];
    const [but, faute, penalty] = appliquerRetouches(events, file);
    expect(but.assistPlayerName).toBe("Komla");
    expect(faute.victimPlayerName).toBe("Kofi");
    expect(penalty.detail).toBe("marque");
    expect(penalty.playerName).toBe("Elom");
  });

  it("relit un stockage abîmé comme une file vide", () => {
    expect(lireFile(null)).toEqual([]);
    expect(lireFile("{pas du json")).toEqual([]);
    expect(lireFile(JSON.stringify([{ genre: "inconnu", eventId: "x" }, passeur("b1", "Komla")]))).toEqual([
      passeur("b1", "Komla"),
    ]);
  });

  it("reconnaît une écriture qui n'a pas joint le serveur", () => {
    expect(estHorsLigne({ code: "unavailable" })).toBe(true);
    expect(estHorsLigne(new Error("Failed to get document because the client is offline."))).toBe(true);
    expect(estHorsLigne(new Error("Missing or insufficient permissions."))).toBe(false);
  });
});
