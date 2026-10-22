import type { CompMatch, CompTeam, Competition } from "@/types";
import { bilanDeLEquipe, matchsDeLEquipe, placeDansLaPoule, rangLisible } from "~/lib/page-equipe";

const match = (id: string, p: Partial<CompMatch> = {}): CompMatch =>
  ({
    id, date: "2026-09-24", time: "15:00", status: "completed", group: "A", round: null, stage: "group",
    homeTeamId: "A", awayTeamId: "B", homeTeamName: "Alpha", awayTeamName: "Beta", homeTeamLogo: null, awayTeamLogo: null,
    scoreHome: 1, scoreAway: 0, venueName: null, ...p,
  } as CompMatch);

const COUPE = { name: "Coupe", slug: "coupe" };

describe("matchsDeLEquipe", () => {
  it("garde les matchs de l'équipe, vus de son côté, sans les annulés", () => {
    const vus = matchsDeLEquipe([
      match("m1"),
      match("m2", { homeTeamId: "B", awayTeamId: "A", homeTeamName: "Beta", awayTeamName: "Alpha", scoreHome: 2, scoreAway: 2 }),
      match("m3", { homeTeamId: "C", awayTeamId: "D" }),
      match("m4", { status: "cancelled" }),
    ], "A", COUPE);
    expect(vus.map((m) => [m.id, m.domicile, m.adversaire.nom, m.pour, m.contre])).toEqual([
      ["m1", true, "Beta", 1, 0],
      ["m2", false, "Beta", 2, 2],
    ]);
    expect(vus[0].lien).toBe("/c/coupe/matches/m1");
    expect(vus[0].etape).toBe("Groupe A");
  });
});

describe("bilanDeLEquipe", () => {
  it("compte les matchs joués et leur forme, du plus ancien au plus récent", () => {
    const vus = matchsDeLEquipe([
      match("m1", { date: "2026-09-20", scoreHome: 3, scoreAway: 1 }),
      match("m2", { date: "2026-09-21", scoreHome: 0, scoreAway: 0 }),
      match("m3", { date: "2026-09-22", scoreHome: 0, scoreAway: 2 }),
      match("m4", { date: "2026-09-23", status: "scheduled", scoreHome: null, scoreAway: null }),
    ], "A", COUPE);
    expect(bilanDeLEquipe(vus)).toEqual({
      joues: 3, gagnes: 1, nuls: 1, perdus: 1, pour: 3, contre: 3, forme: ["V", "N", "D"],
    });
  });
});

describe("placeDansLaPoule", () => {
  const equipes = [
    { id: "A", name: "Alpha", group: "A" },
    { id: "B", name: "Beta", group: "A" },
  ] as CompTeam[];
  const competition = { format: { qualifiers_per_group: 1, points: { win: 3, draw: 1, loss: 0 } } } as unknown as Competition;

  it("donne le rang et les points de l'équipe dans sa poule", () => {
    expect(placeDansLaPoule(competition, [match("m1")], equipes, equipes[1])).toEqual({ rang: 2, points: 0 });
  });

  it("ne dit rien pour une équipe sans poule", () => {
    expect(placeDansLaPoule(competition, [], equipes, { id: "Z", name: "Z", group: null } as CompTeam)).toBeNull();
  });
});

describe("rangLisible", () => {
  it("écrit 1ᵉʳ, puis 2ᵉ, 3ᵉ…", () => {
    expect(rangLisible(1)).toBe("1ᵉʳ");
    expect(rangLisible(2)).toBe("2ᵉ");
  });
});
