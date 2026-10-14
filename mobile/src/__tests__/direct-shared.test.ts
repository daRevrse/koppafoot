import {
  competitionHref, kickoff, matchHref, minuteDuDirect, ordreDesCompetitions, type Entry,
} from "@/lib/direct-shared";
import { FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";
import type { Competition, CompMatch } from "@/types";

const comp = (id: string, slug = id): Competition => ({ id, slug, name: id } as Competition);
const match = (id: string, p: Partial<CompMatch> = {}): CompMatch =>
  ({ id, date: "2026-09-24", time: "15:00", status: "scheduled", liveState: null, ...p } as CompMatch);
const entree = (c: Competition, m: CompMatch): Entry => ({ competition: c, match: m });

const DEPART = "2026-09-24T15:00:00.000Z";
const T0 = new Date(DEPART).getTime();

describe("minuteDuDirect", () => {
  const libelles = { avant: "Bientôt", pause: "MT", interrompu: "Interrompu" };
  const enDirect = (c: Competition, ls: Partial<NonNullable<CompMatch["liveState"]>>) =>
    entree(c, match("m", {
      status: "live",
      liveState: { currentPeriod: 1, timerStartAt: null, timerOffset: 0, isTimerRunning: false, events: [], ...ls },
    } as Partial<CompMatch>));

  it("compte depuis le coup d'envoi quand le chrono tourne", () => {
    const e = enDirect(comp("c"), { timerStartAt: DEPART, isTimerRunning: true });
    expect(minuteDuDirect(e, libelles, T0 + 12 * 60_000 + 5_000)).toBe("13′");
  });

  it("écrit le temps additionnel selon la durée du format", () => {
    const sept = { ...comp("c"), format: { half_duration: 20 } } as Competition;
    const e = enDirect(sept, { timerStartAt: DEPART, isTimerRunning: true });
    expect(minuteDuDirect(e, libelles, T0 + 21 * 60_000)).toBe("20+2′");
  });

  it("dit la pause, et non la 46e", () => {
    const e = enDirect(comp("c"), { currentPeriod: 2, timerOffset: 45 * 60_000 });
    expect(minuteDuDirect(e, libelles, T0)).toBe("MT");
  });

  it("dit l'avant-match tant que le chrono n'a pas tourné", () => {
    expect(minuteDuDirect(enDirect(comp("c"), {}), libelles, T0)).toBe("Bientôt");
  });

  it("ne dit rien sans état de direct", () => {
    expect(minuteDuDirect(entree(comp("c"), match("m")), libelles)).toBe("");
  });
});

describe("liens", () => {
  it("un match de la plateforme mène à sa fiche", () => {
    expect(matchHref(entree(comp("c1", "coupe-lome"), match("m1")))).toBe("/c/coupe-lome/matches/m1");
  });

  it("un amical mène à /matches/[id]", () => {
    expect(matchHref(entree(FRIENDLY_COMPETITION, match("a1")))).toBe("/matches/a1");
  });

  it("un match mondial mène à sa compétition", () => {
    const monde = comp("__monde__PL", "PL");
    expect(matchHref(entree(monde, match("w1")))).toBe("/competitions/monde/PL");
    expect(competitionHref(comp("__monde__X", ""))).toBe("/competitions");
  });
});

describe("ordreDesCompetitions", () => {
  it("le direct d'abord, puis le football d'ici, puis l'heure", () => {
    const ici = [entree(comp("ici"), match("a", { time: "18:00" }))];
    const monde = [entree(comp("__monde__PL"), match("b", { time: "12:00" }))];
    const enDirect = [entree(comp("__monde__L1"), match("c", { status: "live", time: "20:00" }))];
    const tries = [monde, ici, enDirect].sort(ordreDesCompetitions);
    expect(tries.map((g) => g[0].competition.id)).toEqual(["__monde__L1", "ici", "__monde__PL"]);
  });

  it("une date absente passe en dernier", () => {
    expect(kickoff(entree(comp("c"), match("m", { date: null, time: null })))).toBe("9999-99-99T99:99");
  });
});
