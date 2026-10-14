import { PENALTY_FOUL_DETAIL } from "@/lib/evenements";
import { lignesStats, type FaitCompte } from "@/lib/stats-match";

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
