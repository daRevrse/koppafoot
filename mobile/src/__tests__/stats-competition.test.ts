import { POSSESSION_VIDE } from "@/lib/possession";
import { statsDeJeu, titreDuRecord, type MatchDeJeu } from "@/lib/stats-competition";

type Fait = { type: string; teamId: string; detail?: string };

let n = 0;
const match = (
  score: [number, number],
  faits: Fait[] = [],
  autre: Partial<MatchDeJeu> = {},
): MatchDeJeu => ({
  id: `m${++n}`, status: "completed", stage: "group", forfeitByTeamId: null,
  date: "2026-07-24", time: "16:00",
  homeTeamId: "h", awayTeamId: "a", homeTeamName: "Lions", awayTeamName: "Étoile",
  scoreHome: score[0], scoreAway: score[1],
  liveState: {
    currentPeriod: 4, timerStartAt: null, timerOffset: 0, isTimerRunning: false,
    events: faits.map((f, i) => ({ id: `e${i}`, period: 1, minute: 10, createdAt: "", ...f })),
  },
  ...autre,
} as unknown as MatchDeJeu);

const but = (teamId: string): Fait => ({ type: "goal", teamId });
const fois = (k: number, f: Fait) => Array.from({ length: k }, () => f);
const total = (s: ReturnType<typeof statsDeJeu>, cle: string) => s.totaux.find((t) => t.cle === cle);

describe("statsDeJeu, sur quels matchs on compte", () => {
  it("compte les buts au tableau d'affichage de tous les matchs joués", () => {
    // Le second n'a aucun fait saisi : son score compte quand même.
    const s = statsDeJeu([match([2, 1], [but("h"), but("h"), but("a")]), match([3, 0])]);
    expect(total(s, "buts")).toMatchObject({ total: 6, matchs: 2, parMatch: 3 });
    expect(s).toMatchObject({ joues: 2, suivis: 1 });
  });

  it("laisse de côté exhibitions, forfaits et matchs pas encore joués", () => {
    const s = statsDeJeu([
      match([1, 0]),
      match([5, 5], [], { stage: "exhibition" }),
      match([3, 0], [], { forfeitByTeamId: "a" }),
      match([0, 0], [], { status: "scheduled" }),
    ]);
    expect(s.joues).toBe(1);
    expect(total(s, "buts")?.total).toBe(1);
  });

  it("compte le reste sur les seuls matchs suivis en direct", () => {
    const s = statsDeJeu([
      match([0, 0], [...fois(4, { type: "foul", teamId: "h" }), { type: "foul", teamId: "a" }]),
      match([0, 0], [{ type: "corner", teamId: "h" }]),
      match([1, 1]),
    ]);
    // Deux matchs suivis : un sans faute est une faute de moins, pas un trou.
    expect(total(s, "fautes")).toMatchObject({ total: 5, matchs: 2, parMatch: 2.5 });
  });

  // Un but est un tir cadré sur sa fiche. Une compétition où l'on n'a saisi
  // que les buts afficherait autant de tirs que de buts.
  it("ne compte pas de tirs là où personne n'en a saisi", () => {
    const s = statsDeJeu([match([2, 0], [but("h"), but("h")])]);
    expect(total(s, "tirs")).toBeUndefined();
    expect(total(s, "cadres")).toBeUndefined();
  });

  it("compte les tirs sur les matchs où l'on en a saisi", () => {
    const s = statsDeJeu([
      match([1, 0], [but("h"), { type: "shot", teamId: "a" }, { type: "save", teamId: "a" }]),
      match([3, 0], [but("h"), but("h"), but("h")]),
    ]);
    // Le but, le tir et la frappe arrêtée du premier match ; rien du second.
    expect(total(s, "tirs")).toMatchObject({ total: 3, matchs: 1 });
  });

  it("n'additionne pas la possession", () => {
    const possession = { ...POSSESSION_VIDE, homeMs: 600_000, awayMs: 400_000 };
    const m = match([0, 0], [{ type: "corner", teamId: "h" }]);
    const s = statsDeJeu([{ ...m, liveState: { ...m.liveState!, possession } }]);
    expect(total(s, "possession")).toBeUndefined();
  });

  it("compte les passes sur les matchs où elles ont été comptées", () => {
    const avec = match([0, 0], [{ type: "corner", teamId: "h" }]);
    const s = statsDeJeu([
      { ...avec, liveState: { ...avec.liveState!, possession: { ...POSSESSION_VIDE, homePasses: 30, awayPasses: 10 } } },
      match([0, 0], [{ type: "corner", teamId: "a" }]),
    ]);
    expect(total(s, "passes")).toMatchObject({ total: 40, matchs: 1, parMatch: 40 });
  });

  it("range les totaux comme une fiche de match", () => {
    const s = statsDeJeu([match([1, 0], [but("h"), { type: "yellow_card", teamId: "a" }, { type: "corner", teamId: "h" }])]);
    expect(s.totaux.map((t) => t.cle)).toEqual(["buts", "corners", "jaunes"]);
  });
});

describe("statsDeJeu, les records", () => {
  it("désigne le match qui a le plus de chaque mesure", () => {
    const record = match([7, 3]);
    const s = statsDeJeu([match([1, 0]), record, match([2, 2])]);
    expect(s.records.find((r) => r.cle === "buts")).toMatchObject({
      n: 10, matchId: record.id, affiche: "Lions 7–3 Étoile",
    });
  });

  it("n'appelle pas record un seul fait", () => {
    const s = statsDeJeu([match([0, 0], [{ type: "yellow_card", teamId: "a" }])]);
    expect(s.records.find((r) => r.cle === "jaunes")).toBeUndefined();
  });

  it("garde le plus récent en cas d'égalité", () => {
    const ancien = match([2, 1], [], { date: "2026-07-24" });
    const recent = match([3, 0], [], { date: "2026-07-30" });
    const s = statsDeJeu([recent, ancien]);
    expect(s.records.find((r) => r.cle === "buts")?.matchId).toBe(recent.id);
  });
});

describe("titreDuRecord", () => {
  it("élide devant une voyelle", () => {
    expect(titreDuRecord("Buts")).toBe("Le plus de buts");
    expect(titreDuRecord("Arrêts")).toBe("Le plus d'arrêts");
  });
});
