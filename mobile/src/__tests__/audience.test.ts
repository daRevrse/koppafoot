import {
  appareilDuJour, avecLeResume, resumeAStocker, cibleCompetition, cibleMatch, courbe, debutDePeriode, heureDeMinute, idSession, jourAudience, jourLisible,
  jourMoins, lireCible, lirePeriode, lireSession, lireVia, minuteDe, nouvelAppareil, pic, resumer,
  spectateursMaintenant, tempsMoyen, visitesParJour, type SessionLue,
} from "@/lib/audience";

// Le module vit côté site (src/lib/audience) ; il est pur, et c'est ici que
// la suite de tests des modules partagés tourne.

const s = (p: Partial<SessionLue>): SessionLue => ({
  jour: "20261017", vues: 1, minutes: [], via: "autre", connecte: false, derniereMs: null, cid: null, ...p,
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

  it("se lit en français, à l'heure de Lomé", () => {
    expect(jourLisible("20261017")).toBe("17 octobre 2026");
    expect(heureDeMinute(minuteDe(Date.parse("2026-10-17T16:42:30Z")))).toBe("16:42");
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
    expect(lue).toEqual({ jour: "20261017", vues: 3, minutes: [10, 11], via: "autre", connecte: false, derniereMs: 42, cid: null });
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

describe("le résumé quotidien", () => {
  const vieilles = [
    s({ jour: "20261017", vues: 2, minutes: [100, 101], via: "app", connecte: true }),
    s({ jour: "20261017", minutes: [101] }),
    s({ jour: "20261018", via: "qr" }),
  ];

  it("résume les jours terminés, pas aujourd'hui", () => {
    const r = resumeAStocker(vieilles, null, "20261018");
    expect(Object.keys(r.par_jour!)).toEqual(["20261017"]);
    expect(r.par_jour!["20261017"]).toEqual({ visites: 2, vues: 3, connectees: 1, via: { app: 1, qr: 0, partage: 0, autre: 1 } });
    expect(r.courbe).toEqual({ "100": 1, "101": 2 });
  });

  it("se rejoue sans compter deux fois", () => {
    const une = resumeAStocker(vieilles, null, "20261019");
    const deux = resumeAStocker(vieilles, { ...une }, "20261019");
    expect(deux.par_jour).toEqual(une.par_jour);
  });

  it("garde la courbe d'un match une fois ses sessions purgées", () => {
    expect(resumeAStocker([], { courbe: { "5": 3 }, temps_moyen: 12 }, "20261119"))
      .toMatchObject({ courbe: { "5": 3 }, temps_moyen: 12 });
  });

  it("relit les jours purgés dans le résumé, les jours récents dans les sessions", () => {
    const stocke = {
      par_jour: {
        "20261001": { visites: 4, vues: 9, connectees: 1, via: { app: 4, qr: 0, partage: 0, autre: 0 } },
        "20261017": { visites: 99, vues: 99, connectees: 99, via: { app: 99, qr: 0, partage: 0, autre: 0 } },
      },
    };
    const r = avecLeResume(vieilles, stocke, "20260901");
    // Le 17 a encore ses sessions : le résumé de ce jour-là ne compte pas.
    expect(r.visites).toBe(3 + 4);
    expect(r.parJour.map((j) => j.jour)).toEqual(["20261001", "20261017", "20261018"]);
    expect(r.provenance.app).toBe(1 + 4);
  });

  it("ne relit pas un jour antérieur à la période", () => {
    const stocke = { par_jour: { "20261001": { visites: 4, vues: 9, connectees: 0, via: { app: 0, qr: 0, partage: 0, autre: 4 } } } };
    expect(avecLeResume([], stocke, "20261010").visites).toBe(0);
  });

  it("reprend la courbe stockée d'un match purgé", () => {
    const r = avecLeResume([], { courbe: { "10": 2, "11": 5 }, temps_moyen: 30 }, "20260901");
    expect(r.pic).toEqual({ minute: 11, spectateurs: 5 });
    expect(r.tempsMoyenMin).toBe(30);
  });
});
