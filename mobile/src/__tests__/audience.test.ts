import {
  appareilDuJour, cibleCompetition, cibleMatch, courbe, debutDePeriode, idSession, jourAudience,
  jourMoins, lireCible, lirePeriode, lireSession, lireVia, minuteDe, nouvelAppareil, pic, resumer,
  spectateursMaintenant, tempsMoyen, visitesParJour, type SessionLue,
} from "@/lib/audience";

// Le module vit côté site (src/lib/audience) ; il est pur, et c'est ici que
// la suite de tests des modules partagés tourne.

const s = (p: Partial<SessionLue>): SessionLue => ({
  jour: "20261017", vues: 1, minutes: [], via: "autre", connecte: false, derniereMs: null, ...p,
});

describe("les cibles", () => {
  it("se lisent dans les deux sens", () => {
    expect(lireCible(cibleCompetition("abc123"))).toEqual({ genre: "competition", id: "abc123" });
    expect(lireCible(cibleMatch("m9"))).toEqual({ genre: "match", id: "m9" });
  });

  it("refusent ce qui n'en a pas la forme", () => {
    expect(lireCible("users-x")).toBeNull();
    expect(lireCible("comp-")).toBeNull();
    expect(lireCible("comp-a/b")).toBeNull();
  });
});

describe("le temps", () => {
  it("donne le jour de Lomé, qui est celui d'UTC", () => {
    expect(jourAudience(new Date("2026-10-16T23:59:59Z"))).toBe("20261016");
    expect(jourAudience(new Date("2026-10-17T00:00:00Z"))).toBe("20261017");
  });

  it("recule d'un jour, d'un mois, d'une année", () => {
    expect(jourMoins("20261017", 1)).toBe("20261016");
    expect(jourMoins("20261001", 1)).toBe("20260930");
    expect(jourMoins("20260101", 1)).toBe("20251231");
  });

  it("compte la minute du mur", () => {
    expect(minuteDe(120_000)).toBe(2);
    expect(minuteDe(179_999)).toBe(2);
  });

  it("borne les périodes", () => {
    expect(debutDePeriode("7j", "20261017")).toBe("20261011");
    expect(debutDePeriode("30j", "20261017")).toBe("20260918");
    expect(debutDePeriode("tout", "20261017")).toBeNull();
    expect(lirePeriode("n'importe quoi")).toBe("30j");
  });
});

describe("l'appareil du jour", () => {
  it("garde l'appareil d'aujourd'hui et ses cibles", () => {
    const a = appareilDuJour({ jour: "20261017", appareil: "abcdefghij012345", cibles: ["comp-x"] }, "20261017");
    expect(a).toEqual({ jour: "20261017", appareil: "abcdefghij012345", cibles: ["comp-x"] });
  });

  it("en tire un neuf le lendemain : rien ne relie deux journées", () => {
    const a = appareilDuJour({ jour: "20261016", appareil: "abcdefghij012345", cibles: ["comp-x"] }, "20261017", () => "zzzzzzzzzzzzzzzz");
    expect(a).toEqual({ jour: "20261017", appareil: "zzzzzzzzzzzzzzzz", cibles: [] });
  });

  it("ne croit pas un stockage abîmé", () => {
    expect(appareilDuJour({ jour: "20261017", appareil: "court" }, "20261017", () => "yyyyyyyyyyyyyyyy").appareil)
      .toBe("yyyyyyyyyyyyyyyy");
    expect(appareilDuJour(null, "20261017", () => "yyyyyyyyyyyyyyyy").appareil).toBe("yyyyyyyyyyyyyyyy");
  });

  it("tire 16 caractères de l'alphabet attendu", () => {
    expect(nouvelAppareil()).toMatch(/^[a-z0-9]{16}$/);
    expect(idSession("20261017", "abcdefghij012345")).toBe("20261017_abcdefghij012345");
  });
});

describe("lireVia et lireSession", () => {
  it("ne garde que nos propres provenances", () => {
    expect(lireVia("app")).toBe("app");
    expect(lireVia("qr")).toBe("qr");
    expect(lireVia("facebook")).toBe("autre");
    expect(lireVia(null)).toBe("autre");
  });

  it("relit une session sans lui faire confiance", () => {
    const lue = lireSession({
      jour: "20261017", vues: 3, minutes: [10, "x", 11], via: "pirate", connecte: "oui",
      derniere: { toMillis: () => 42 },
    });
    expect(lue).toEqual({ jour: "20261017", vues: 3, minutes: [10, 11], via: "autre", connecte: false, derniereMs: 42 });
    expect(lireSession({ jour: "hier" })).toBeNull();
  });
});

describe("la lecture", () => {
  const sessions = [
    s({ jour: "20261016", vues: 2, minutes: [100, 101, 102], via: "app", connecte: true }),
    s({ jour: "20261017", minutes: [101, 102, 104], via: "qr" }),
    s({ jour: "20261017", vues: 4 }),
  ];

  it("compte visites et vues par jour", () => {
    expect(visitesParJour(sessions)).toEqual([
      { jour: "20261016", visites: 1, vues: 2 },
      { jour: "20261017", visites: 2, vues: 5 },
    ]);
  });

  it("trace la courbe minute par minute, trous compris", () => {
    expect(courbe(sessions)).toEqual([
      { minute: 100, spectateurs: 1 },
      { minute: 101, spectateurs: 2 },
      { minute: 102, spectateurs: 2 },
      { minute: 103, spectateurs: 0 },
      { minute: 104, spectateurs: 1 },
    ]);
  });

  it("donne le pic et sa première minute", () => {
    expect(pic(courbe(sessions))).toEqual({ minute: 101, spectateurs: 2 });
    expect(pic([])).toBeNull();
  });

  it("calcule le temps moyen parmi ceux qui ont suivi le direct", () => {
    expect(tempsMoyen(sessions)).toBe(3);
    expect(tempsMoyen([s({})])).toBe(0);
  });

  it("ne compte une minute qu'une fois par appareil", () => {
    expect(courbe([s({ minutes: [5, 5, 5] })])).toEqual([{ minute: 5, spectateurs: 1 }]);
  });

  it("compte les spectateurs du moment à leur dernière minute de direct", () => {
    const maintenant = 105 * 60_000 + 30_000;
    expect(spectateursMaintenant(sessions, maintenant)).toBe(1);
    // Rouvrir la fiche d'un match fini n'en fait pas un spectateur.
    expect(spectateursMaintenant([s({ minutes: [], derniereMs: maintenant })], maintenant)).toBe(0);
  });

  it("résume tout d'un coup", () => {
    const r = resumer(sessions);
    expect(r).toMatchObject({ visites: 3, vues: 7, connectees: 1, tempsMoyenMin: 3 });
    expect(r.provenance).toEqual({ app: 1, qr: 1, partage: 0, autre: 1 });
    expect(r.pic).toEqual({ minute: 101, spectateurs: 2 });
  });
});
