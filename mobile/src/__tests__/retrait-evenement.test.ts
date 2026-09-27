import { DETAIL_SECOND_JAUNE, planDuRetrait, type Evenement } from "@/lib/retrait-evenement";

// Le module vit côté site (src/lib/retrait-evenement) ; il est pur, et c'est
// ici que la suite de tests des modules partagés tourne.

const ev = (p: Partial<Evenement> & Pick<Evenement, "id" | "type">): Evenement => ({
  period: 1, minute: 10, teamId: "H", createdAt: "", ...p,
});

const contexte = (home: string[], away: string[] = ["a1", "a2"]) => ({
  homeTeamId: "H",
  surLeTerrain: { home, away },
});

describe("planDuRetrait", () => {
  it("retire un but et rend son point au tableau, du bon côté", () => {
    const events = [ev({ id: "b1", type: "goal", teamId: "A", playerId: "a1" })];
    const r = planDuRetrait(events, "b1", contexte(["h1"]));
    expect(r).toEqual({ ok: true, plan: { ids: ["b1"], score: { home: 0, away: -1 }, surLeTerrain: {} } });
  });

  it("ne retire pas deux fois le point d'un but déjà refusé par la VAR", () => {
    const events = [ev({ id: "b1", type: "goal", playerId: "h1", varStatus: "cancelled" })];
    const r = planDuRetrait(events, "b1", contexte(["h1"]));
    expect(r.ok && r.plan.score).toEqual({ home: 0, away: 0 });
  });

  it("emporte le rouge automatique avec le second jaune, et rend le joueur à la pelouse", () => {
    const events = [
      ev({ id: "j1", type: "yellow_card", playerId: "h2" }),
      ev({ id: "j2", type: "yellow_card", playerId: "h2" }),
      ev({ id: "r1", type: "red_card", playerId: "h2", detail: DETAIL_SECOND_JAUNE }),
    ];
    const r = planDuRetrait(events, "j2", contexte(["h1"]));
    expect(r.ok && r.plan.ids).toEqual(["j2", "r1"]);
    expect(r.ok && r.plan.surLeTerrain).toEqual({ home: ["h1", "h2"] });
  });

  it("emporte le second jaune avec le rouge qu'il a provoqué, pas le premier", () => {
    const events = [
      ev({ id: "j1", type: "yellow_card", playerId: "h2" }),
      ev({ id: "f1", type: "foul", playerId: "h2" }),
      ev({ id: "j2", type: "yellow_card", playerId: "h2" }),
      ev({ id: "r1", type: "red_card", playerId: "h2", detail: DETAIL_SECOND_JAUNE }),
    ];
    const r = planDuRetrait(events, "r1", contexte(["h1"]));
    expect(r.ok && r.plan.ids).toEqual(["r1", "j2"]);
  });

  it("retire un rouge direct seul, et rend le joueur à la pelouse", () => {
    const events = [ev({ id: "r1", type: "red_card", playerId: "h2" })];
    const r = planDuRetrait(events, "r1", contexte(["h1"]));
    expect(r.ok && r.plan).toEqual({ ids: ["r1"], score: { home: 0, away: 0 }, surLeTerrain: { home: ["h1", "h2"] } });
  });

  it("retire un premier jaune sans rien toucher d'autre", () => {
    const events = [ev({ id: "j1", type: "yellow_card", playerId: "h2" })];
    const r = planDuRetrait(events, "j1", contexte(["h1", "h2"]));
    expect(r.ok && r.plan).toEqual({ ids: ["j1"], score: { home: 0, away: 0 }, surLeTerrain: {} });
  });

  it("défait un remplacement : l'entrant ressort, le sortant revient", () => {
    const events = [ev({ id: "s1", type: "substitution", playerId: "h9", outPlayerId: "h2" })];
    const r = planDuRetrait(events, "s1", contexte(["h1", "h9"]));
    expect(r.ok && r.plan.surLeTerrain).toEqual({ home: ["h1", "h2"] });
  });

  it("refuse de défaire un remplacement quand la pelouse a changé depuis", () => {
    const events = [ev({ id: "s1", type: "substitution", playerId: "h9", outPlayerId: "h2" })];
    // L'entrant est déjà ressorti.
    expect(planDuRetrait(events, "s1", contexte(["h1", "h2"])).ok).toBe(false);
  });

  it("refuse un ancien remplacement dont le sortant n'est pas connu", () => {
    const events = [ev({ id: "s1", type: "substitution", playerId: "h9" })];
    expect(planDuRetrait(events, "s1", contexte(["h1", "h9"])).ok).toBe(false);
  });

  it("dit quand l'événement n'est plus là", () => {
    expect(planDuRetrait([], "x", contexte([])).ok).toBe(false);
  });

  it("retire un corner, une faute ou un tir, seuls", () => {
    const events = [ev({ id: "c1", type: "corner" }), ev({ id: "t1", type: "shot_on_target", playerId: "h1" })];
    const r = planDuRetrait(events, "t1", contexte(["h1"]));
    expect(r.ok && r.plan).toEqual({ ids: ["t1"], score: { home: 0, away: 0 }, surLeTerrain: {} });
  });
});
