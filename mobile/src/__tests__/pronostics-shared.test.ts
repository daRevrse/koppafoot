import { EMPTY_COUNTS, pourcentages } from "@/lib/pronostics-shared";

// Le module vit côté site (src/lib/pronostics-shared) ; il est pur, et c'est
// ici que la suite de tests des modules partagés tourne.

describe("pourcentages", () => {
  it("part d'un tiers chacun, faute de vote : une voix de base par issue", () => {
    expect(pourcentages(EMPTY_COUNTS)).toEqual({ home: 34, draw: 33, away: 33 });
  });

  it("fait cent, et suit les votes", () => {
    const p = pourcentages({ home: 7, draw: 1, away: 1, total: 9 });
    expect(p.home + p.draw + p.away).toBe(100);
    expect(p.home).toBeGreaterThan(p.away);
  });
});
