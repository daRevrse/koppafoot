import {
  joueursDuRemplacement, marquesDesJoueurs, motifDesMarques, type FaitRaconte,
} from "@/lib/recit-du-match";

// Le module vit côté site (src/lib/recit-du-match) ; il est pur, et c'est
// ici que la suite de tests des modules partagés tourne.

const fait = (p: Partial<FaitRaconte> & Pick<FaitRaconte, "type">): FaitRaconte => ({
  minute: 10, ...p,
});

describe("marquesDesJoueurs", () => {
  it("compte les buts du buteur et la passe du passeur", () => {
    const m = marquesDesJoueurs([
      fait({ type: "goal", playerId: "h9", assistPlayerId: "h8", minute: 19 }),
      fait({ type: "goal", playerId: "h9", minute: 53 }),
    ]);
    expect(m.h9.buts).toBe(2);
    expect(m.h8.passes).toBe(1);
    expect(m.h8.buts).toBe(0);
  });

  it("ne compte ni un but refusé par la VAR, ni sa passe", () => {
    const m = marquesDesJoueurs([
      fait({ type: "goal", playerId: "h9", assistPlayerId: "h8", varStatus: "cancelled" }),
    ]);
    expect(m.h9).toBeUndefined();
    expect(m.h8).toBeUndefined();
  });

  it("range un but contre son camp à part, sans passe", () => {
    const m = marquesDesJoueurs([
      fait({ type: "goal", playerId: "a4", detail: "csc", assistPlayerId: "h8" }),
    ]);
    expect(m.a4).toMatchObject({ buts: 0, csc: 1 });
    expect(m.h8).toBeUndefined();
  });

  it("porte les cartons, le second jaune compris", () => {
    const m = marquesDesJoueurs([
      fait({ type: "yellow_card", playerId: "a2", minute: 25 }),
      fait({ type: "yellow_card", playerId: "a2", minute: 60 }),
      fait({ type: "red_card", playerId: "a2", minute: 60, detail: "2e carton jaune" }),
    ]);
    expect(m.a2).toMatchObject({ jaunes: 2, rouge: true });
  });

  it("dit qui sort et qui entre, à quelle minute", () => {
    const m = marquesDesJoueurs([
      fait({ type: "substitution", playerId: "h15", outPlayerId: "h9", minute: 28 }),
    ]);
    expect(m.h9.sortieA).toBe(28);
    expect(m.h9.entreeA).toBeNull();
    expect(m.h15.entreeA).toBe(28);
    expect(m.h15.sortieA).toBeNull();
  });

  it("garde la première entrée et la dernière sortie d'un aller-retour, dans l'ordre des minutes", () => {
    // Titulaire, h9 sort à la 30e, revient à la 50e, ressort à la 70e. Les
    // faits arrivent dans le désordre.
    const m = marquesDesJoueurs([
      fait({ type: "substitution", playerId: "h12", outPlayerId: "h9", minute: 70 }),
      fait({ type: "substitution", playerId: "h15", outPlayerId: "h9", minute: 30 }),
      fait({ type: "substitution", playerId: "h9", outPlayerId: "h15", minute: 50 }),
    ]);
    expect(m.h9.entreeA).toBe(50);
    expect(m.h9.sortieA).toBe(70);
    expect(m.h15.entreeA).toBe(30);
    expect(m.h15.sortieA).toBe(50);
  });

  it("ne marque personne quand le fait n'a pas d'identifiant", () => {
    const m = marquesDesJoueurs([
      fait({ type: "goal", playerName: "Inconnu" }),
      fait({ type: "substitution", detail: "A → B" }),
    ]);
    expect(Object.keys(m)).toEqual([]);
  });
});

describe("motifDesMarques", () => {
  it("dit les buts et les passes, au pluriel quand il faut", () => {
    expect(motifDesMarques({ buts: 2, csc: 0, passes: 1, jaunes: 0, rouge: false, sortieA: null, entreeA: null }))
      .toBe("2 buts · 1 passe");
  });

  it("se tait quand il n'y a rien", () => {
    expect(motifDesMarques(undefined)).toBeNull();
    expect(motifDesMarques({ buts: 0, csc: 0, passes: 0, jaunes: 1, rouge: false, sortieA: null, entreeA: null }))
      .toBeNull();
  });
});

describe("joueursDuRemplacement", () => {
  it("lit les deux noms écrits par la console", () => {
    expect(joueursDuRemplacement({
      playerName: "Mawuli Hounkpati", outPlayerName: "Mawuena Dossou",
      detail: "Mawuena Dossou → Mawuli Hounkpati",
    })).toEqual({ entre: "Mawuli Hounkpati", sort: "Mawuena Dossou" });
  });

  it("retombe sur le texte d'un remplacement écrit avant le champ du sortant", () => {
    expect(joueursDuRemplacement({ detail: "Mawuena Dossou → Mawuli Hounkpati" }))
      .toEqual({ entre: "Mawuli Hounkpati", sort: "Mawuena Dossou" });
    expect(joueursDuRemplacement({ playerName: "Mawuli Hounkpati", detail: "Mawuena Dossou → Mawuli Hounkpati" }))
      .toEqual({ entre: "Mawuli Hounkpati", sort: "Mawuena Dossou" });
  });

  it("garde l'entrant seul quand on ne sait pas qui sort", () => {
    expect(joueursDuRemplacement({ playerName: "Mawuli Hounkpati" }))
      .toEqual({ entre: "Mawuli Hounkpati", sort: "" });
  });

  it("rend null quand personne n'est nommé", () => {
    expect(joueursDuRemplacement({})).toBeNull();
    expect(joueursDuRemplacement({ detail: "Changement tactique" })).toBeNull();
  });
});
