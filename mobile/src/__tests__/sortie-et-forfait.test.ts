import { campsSousLeMinimum, scoreDeForfait } from "@/lib/etat-du-jeu";
import { computeMinutesPlayed } from "@/lib/player-stats";
import { planDuRetrait, type Evenement } from "@/lib/retrait-evenement";
import type { CompMatch } from "@/types";

const ev = (p: Partial<Evenement> & Pick<Evenement, "id" | "type">): Evenement => ({
  period: 1, minute: 30, teamId: "H", createdAt: "", ...p,
});

describe("la sortie sans remplaçant", () => {
  it("se retire en rendant le joueur à la pelouse", () => {
    const r = planDuRetrait([ev({ id: "s1", type: "sortie", playerId: "h2" })], "s1", {
      homeTeamId: "H",
      surLeTerrain: { home: ["h1"], away: ["a1"] },
    });
    expect(r.ok && r.plan.surLeTerrain).toEqual({ home: ["h1", "h2"] });
  });

  it("arrête le temps de jeu du joueur à sa sortie", () => {
    const match = {
      homeTeamId: "H", awayTeamId: "A",
      homeLineup: [{ playerId: "h2", name: "Koffi", number: "8", role: "starter" }],
      awayLineup: [],
      homeOnPitch: ["h1"], awayOnPitch: [],
      liveState: { events: [ev({ id: "s1", type: "sortie", playerId: "h2", minute: 30 })] },
    } as unknown as CompMatch;
    expect(computeMinutesPlayed(match, "H", "h2", 90)).toBe(30);
  });
});

describe("le minimum de joueurs", () => {
  it("désigne le camp passé sous le minimum", () => {
    expect(campsSousLeMinimum({ home: 7, away: 6 }, 7)).toEqual(["away"]);
    expect(campsSousLeMinimum({ home: 7, away: 11 }, 7)).toEqual([]);
  });
});

describe("le score d'un forfait", () => {
  it("donne trois à zéro à l'adversaire", () => {
    expect(scoreDeForfait({ home: 0, away: 0 }, "home")).toEqual({ home: 0, away: 3 });
    expect(scoreDeForfait({ home: 2, away: 1 }, "home")).toEqual({ home: 0, away: 3 });
    expect(scoreDeForfait({ home: 2, away: 4 }, "away")).toEqual({ home: 3, away: 0 });
  });

  it("garde le score du moment quand il est plus favorable à l'adversaire", () => {
    expect(scoreDeForfait({ home: 0, away: 5 }, "home")).toEqual({ home: 0, away: 5 });
    expect(scoreDeForfait({ home: 4, away: 1 }, "away")).toEqual({ home: 4, away: 1 });
  });
});
