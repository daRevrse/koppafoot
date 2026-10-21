import { pointsDeCartons } from "@/lib/cartons";
import { DETAIL_SECOND_JAUNE } from "@/lib/retrait-evenement";
import { comparerLignes, computeStandings, pouleDuMatch, type GroupStanding } from "@/lib/poules";
import type { CompMatch, CompTeam, CompetitionFormat } from "@/types";

const FORMAT = { points: { win: 3, draw: 1, loss: 0 } } as unknown as CompetitionFormat;
const equipe = (id: string, name: string, group = "A") => ({ id, name, group } as unknown as CompTeam);

type Fait = { type: string; teamId: string; playerId?: string; detail?: string };
let n = 0;
const match = (
  home: string, away: string, score: [number, number], faits: Fait[] = [], stage = "group",
): CompMatch => ({
  id: `m${++n}`, stage, status: "completed", homeTeamId: home, awayTeamId: away,
  scoreHome: score[0], scoreAway: score[1],
  liveState: { events: faits.map((f, i) => ({ id: `e${i}`, minute: 10, period: 1, createdAt: "", ...f })) },
} as unknown as CompMatch);

const jaune = (teamId: string, playerId = "p"): Fait => ({ type: "yellow_card", teamId, playerId });
const rouge = (teamId: string, playerId = "p", detail?: string): Fait => ({ type: "red_card", teamId, playerId, detail });

describe("pointsDeCartons", () => {
  it("compte 1 par jaune et 3 par rouge", () => {
    expect(pointsDeCartons([jaune("a", "x"), jaune("a", "y"), rouge("a", "z")], "a")).toBe(5);
  });

  it("ne compte que les cartons de l'équipe", () => {
    expect(pointsDeCartons([jaune("a"), rouge("b")], "a")).toBe(1);
  });

  // Deux jaunes valent une expulsion, pas plus qu'un rouge direct.
  it("compte 3 en tout pour une expulsion sur second jaune, marquée par la console", () => {
    expect(pointsDeCartons([jaune("a"), jaune("a"), rouge("a", "p", DETAIL_SECOND_JAUNE)], "a")).toBe(3);
  });

  it("reconnaît le second jaune saisi après le match, sans la marque de la console", () => {
    expect(pointsDeCartons([jaune("a"), jaune("a"), rouge("a")], "a")).toBe(3);
  });
});

describe("computeStandings, les cartons départagent", () => {
  const a = equipe("a", "Alpha");
  const z = equipe("z", "Zulu");
  const c = equipe("c", "Charlie");

  it("place devant, à égalité parfaite, l'équipe qui a reçu le moins de cartons", () => {
    // Alpha et Zulu font 1–1 ; Alpha a deux jaunes, Zulu aucun.
    const [poule] = computeStandings([match("a", "z", [1, 1], [jaune("a", "x"), jaune("a", "y")])], [a, z], FORMAT);
    expect(poule.rows.map((r) => r.team.name)).toEqual(["Zulu", "Alpha"]);
    expect(poule.rows.map((r) => r.cartons)).toEqual([0, 2]);
  });

  it("garde l'ordre alphabétique quand les cartons sont aussi à égalité", () => {
    const [poule] = computeStandings([match("a", "z", [0, 0], [jaune("a"), jaune("z")])], [a, z], FORMAT);
    expect(poule.rows.map((r) => r.team.name)).toEqual(["Alpha", "Zulu"]);
  });

  it("ne fait pas passer les cartons avant les points ni les buts", () => {
    // Zulu gagne malgré un rouge : les points d'abord.
    const [poule] = computeStandings([match("a", "z", [0, 1], [rouge("z")])], [a, z], FORMAT);
    expect(poule.rows[0].team.name).toBe("Zulu");
  });

  it("ne compte pas les cartons d'un match hors poule", () => {
    const [poule] = computeStandings(
      [
        match("a", "z", [1, 1]),
        match("a", "c", [0, 0], [rouge("z"), rouge("z", "q")], "exhibition"),
        match("z", "c", [0, 0], [rouge("z", "r")], "knockout"),
      ],
      [a, z],
      FORMAT,
    );
    expect(poule.rows.find((r) => r.team.id === "z")?.cartons).toBe(0);
  });

  it("sert aussi au classement des meilleurs troisièmes", () => {
    const ligne = (name: string, cartons: number) =>
      ({ team: equipe(name, name), points: 4, goalDiff: 0, goalsFor: 3, cartons } as never);
    const lignes = [ligne("Alpha", 4), ligne("Zulu", 1)].sort(comparerLignes);
    expect(lignes.map((l: { team: CompTeam }) => l.team.name)).toEqual(["Zulu", "Alpha"]);
  });
});

describe("pouleDuMatch", () => {
  const poule = (group: string, ids: string[]) =>
    ({ group, rows: ids.map((id) => ({ team: { id } })) }) as unknown as GroupStanding;
  const poules = [poule("A", ["a1", "a2", "a3"]), poule("B", ["b1", "b2"])];

  it("rend la poule qui contient les deux équipes", () => {
    expect(pouleDuMatch(poules, "a3", "a1")?.group).toBe("A");
  });

  it("rien quand une équipe manque, ou qu'elles ne sont pas dans la même poule", () => {
    expect(pouleDuMatch(poules, "a1", null)).toBeNull();
    expect(pouleDuMatch(poules, "a1", "b1")).toBeNull();
  });
});
