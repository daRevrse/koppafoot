import { raisonDeNePasSupprimer } from "@/lib/suppression-match";
import type { CompMatch } from "@/types";

const match = (id: string, p: Partial<CompMatch> = {}): CompMatch =>
  ({
    id, stage: "group", status: "scheduled", homeSource: null, awaySource: null, feedsIntoMatchId: null, ...p,
  }) as CompMatch;

describe("raisonDeNePasSupprimer", () => {
  it("laisse supprimer un match de poule pas encore joué", () => {
    expect(raisonDeNePasSupprimer(match("m"), [match("m")])).toBeNull();
  });

  it("laisse supprimer un match ajouté à la main en phase finale, s'il n'est relié à rien", () => {
    const m = match("m", { stage: "knockout" });
    expect(raisonDeNePasSupprimer(m, [m])).toBeNull();
  });

  it("refuse un match en direct", () => {
    expect(raisonDeNePasSupprimer(match("m", { status: "live" }), [])).toMatch(/en cours/);
  });

  it("refuse un match déjà joué, qui compte au classement", () => {
    expect(raisonDeNePasSupprimer(match("m", { status: "completed" }), [])).toMatch(/joué/);
  });

  it("refuse un match qui envoie son vainqueur au tour suivant", () => {
    const m = match("m", { stage: "knockout", feedsIntoMatchId: "f" });
    expect(raisonDeNePasSupprimer(m, [m])).toMatch(/tableau final/);
  });

  it("refuse un match qui attend des qualifiés", () => {
    // Le premier de la poule A, qu'on ne connaît pas encore.
    const m = match("m", { stage: "knockout", homeSource: { kind: "group_rank", group: "A", rank: 1 } });
    expect(raisonDeNePasSupprimer(m, [m])).toMatch(/tableau final/);
  });

  it("refuse un match dont un autre attend le vainqueur", () => {
    const m = match("m", { stage: "knockout" });
    const suivant = match("s", { stage: "knockout", feedsIntoMatchId: "m" });
    expect(raisonDeNePasSupprimer(m, [m, suivant])).toMatch(/tableau final/);
  });
});
