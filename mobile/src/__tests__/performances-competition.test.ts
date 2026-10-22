import { computeForm, computeTopAssisters, computeTopScorers } from "@/lib/performances-competition";
import type { CompMatch, CompTeam } from "@/types";

type Evenement = NonNullable<CompMatch["liveState"]>["events"][number];

const but = (p: Partial<Evenement>): Evenement =>
  ({ id: `${Math.random()}`, period: 1, minute: 10, createdAt: "", teamId: "A", type: "goal", ...p } as Evenement);

const match = (id: string, events: Evenement[], p: Partial<CompMatch> = {}): CompMatch =>
  ({
    id, status: "completed", date: "2026-09-20", stage: "group", homeTeamId: "A", awayTeamId: "B",
    scoreHome: 0, scoreAway: 0, liveState: { events }, ...p,
  } as unknown as CompMatch);

describe("computeTopScorers", () => {
  it("compte les buts par joueur, le plus prolifique d'abord", () => {
    const buteurs = computeTopScorers([
      match("m1", [but({ playerId: "p1", playerName: "Kossi" }), but({ playerId: "p2", playerName: "Ama" })]),
      match("m2", [but({ playerId: "p1", playerName: "Kossi" })]),
    ]);
    expect(buteurs.map((b) => [b.playerName, b.goals])).toEqual([["Kossi", 2], ["Ama", 1]]);
  });

  it("ne compte ni le but contre son camp, ni le but annulé, ni le dossard sans nom, ni l'exhibition", () => {
    const buteurs = computeTopScorers([
      match("m1", [
        but({ playerId: "p1", playerName: "Kossi", detail: "csc" }),
        but({ playerId: "p1", playerName: "Kossi", varStatus: "cancelled" }),
        but({ playerId: "dos-9", playerName: "N°9" }),
      ]),
      match("gala", [but({ playerId: "p1", playerName: "Kossi" })], { stage: "exhibition" }),
    ]);
    expect(buteurs).toEqual([]);
  });
});

describe("computeTopAssisters", () => {
  it("compte les passes portées par les buts, sauf celles d'un but annulé", () => {
    const passeurs = computeTopAssisters([
      match("m1", [
        but({ assistPlayerName: "Ama" }),
        but({ assistPlayerName: "ama " }),
        but({ assistPlayerName: "Yao", varStatus: "cancelled" }),
      ]),
    ]);
    expect(passeurs.map((p) => [p.playerName, p.assists])).toEqual([["Ama", 2]]);
  });

  it("ne classe pas un dossard que personne n'a nommé, comme le classement des buteurs", () => {
    const passeurs = computeTopAssisters([
      match("m1", [but({ assistPlayerId: "dos-10", assistPlayerName: "N°10" }), but({ assistPlayerName: "Ama" })]),
    ]);
    expect(passeurs.map((p) => p.playerName)).toEqual(["Ama"]);
  });
});

describe("computeForm", () => {
  const equipes = [{ id: "A", name: "Alpha" }, { id: "B", name: "Beta" }] as CompTeam[];

  it("garde les cinq derniers résultats, le plus récent à droite, la meilleure forme d'abord", () => {
    const joues = [1, 2, 3, 4, 5, 6].map((i) =>
      match(`m${i}`, [], { date: `2026-09-0${i}`, scoreHome: i === 1 ? 0 : 2, scoreAway: 1 }));
    const formes = computeForm(joues, equipes);
    expect(formes.map((f) => [f.team.id, f.results.join("")])).toEqual([["A", "WWWWW"], ["B", "LLLLL"]]);
  });

  it("ignore un match sans score", () => {
    expect(computeForm([match("m", [], { scoreHome: null, scoreAway: null })], equipes)).toEqual([]);
  });
});
