import { PENALTY_FOUL_DETAIL } from "@/lib/evenements";
import { POSSESSION_VIDE, SEUIL_PUBLIC_PASSES, type Possession } from "@/lib/possession";
import { aDesStats, lignesStats, type FaitCompte } from "@/lib/stats-match";

const fait = (type: FaitCompte["type"], teamId: string, detail?: string): FaitCompte => ({ type, teamId, detail });
const coupsFrancs = (faits: FaitCompte[]) =>
  lignesStats(faits, "h", "a", { home: 0, away: 0 }, null, false).find((l) => l.cle === "coups_francs");

describe("lignesStats, les coups francs", () => {
  // Une faute de X EST un coup franc pour Y. Les saisir séparément donnait
  // « 14 fautes, 3 coups francs » : le scoreur pressé n'en tape qu'un.
  it("compte la faute de l'adversaire comme un coup franc obtenu", () => {
    expect(coupsFrancs([fait("foul", "a"), fait("foul", "a")])).toMatchObject({ home: 2, away: 0 });
  });

  it("compte le hors-jeu de l'adversaire comme un coup franc obtenu", () => {
    expect(coupsFrancs([fait("offside", "h")])).toMatchObject({ home: 0, away: 1 });
  });

  it("garde les coups francs saisis au bouton, quand le fautif n'a pas été vu", () => {
    expect(coupsFrancs([fait("free_kick", "h"), fait("foul", "a")])).toMatchObject({ home: 2, away: 0 });
  });

  it("ne compte pas la faute qui a donné un penalty", () => {
    expect(coupsFrancs([fait("foul", "a", PENALTY_FOUL_DETAIL)])).toBeUndefined();
  });

  it("laisse les fautes compter comme des fautes", () => {
    const fautes = lignesStats([fait("foul", "a", PENALTY_FOUL_DETAIL)], "h", "a", { home: 0, away: 0 }, null, false)
      .find((l) => l.cle === "fautes");
    expect(fautes).toMatchObject({ home: 0, away: 1 });
  });
});

describe("lignesStats, les passes", () => {
  const possession = (homePasses: number, awayPasses: number): Possession => ({
    ...POSSESSION_VIDE, homePasses, awayPasses,
  });
  const passes = (p: Possession, seuilPasses?: number) =>
    lignesStats([], "h", "a", { home: 0, away: 0 }, p, false, 0, seuilPasses).find((l) => l.cle === "passes");

  it("affiche les passes de chaque camp", () => {
    expect(passes(possession(34, 21))).toMatchObject({ home: 34, away: 21 });
  });

  // « Passes 2 – 0 » raconte un scoreur qui a touché deux fois la bascule.
  it("cache la ligne sous le seuil public", () => {
    expect(passes(possession(SEUIL_PUBLIC_PASSES - 1, 0))).toBeUndefined();
    expect(passes(possession(SEUIL_PUBLIC_PASSES, 0))).toMatchObject({ home: SEUIL_PUBLIC_PASSES, away: 0 });
  });

  it("montre la première passe au scoreur", () => {
    expect(passes(possession(1, 0), 0)).toMatchObject({ home: 1, away: 0 });
  });

  it("n'invente pas « 0 – 0 » quand personne ne les a comptées", () => {
    expect(passes(possession(0, 0), 0)).toBeUndefined();
  });

  it("ouvre l'onglet Stats sur des passes seules", () => {
    expect(aDesStats([], possession(SEUIL_PUBLIC_PASSES, 0), false)).toBe(true);
    expect(aDesStats([], possession(3, 0), false)).toBe(false);
  });
});
