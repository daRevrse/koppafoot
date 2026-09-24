import {
  competitionHref, kickoff, liveMinute, matchHref, ordreDesCompetitions, type Entry,
} from "@/lib/direct-shared";
import { FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";
import type { Competition, CompMatch } from "@/types";

const comp = (id: string, slug = id): Competition => ({ id, slug, name: id } as Competition);
const match = (id: string, p: Partial<CompMatch> = {}): CompMatch =>
  ({ id, date: "2026-09-24", time: "15:00", status: "scheduled", liveState: null, ...p } as CompMatch);
const entree = (c: Competition, m: CompMatch): Entry => ({ competition: c, match: m });

const DEPART = "2026-09-24T15:00:00.000Z";
const T0 = new Date(DEPART).getTime();

describe("liveMinute", () => {
  it("compte depuis le coup d'envoi quand le chrono tourne", () => {
    const m = match("m", {
      status: "live",
      liveState: { currentPeriod: 1, timerStartAt: DEPART, timerOffset: 0, isTimerRunning: true, events: [] },
    } as Partial<CompMatch>);
    expect(liveMinute(m, T0 + 12 * 60_000 + 5_000)).toBe(13);
  });

  it("s'arrête sur le décalage quand le chrono est à l'arrêt", () => {
    const m = match("m", {
      status: "live",
      liveState: { currentPeriod: 1, timerStartAt: null, timerOffset: 45 * 60_000, isTimerRunning: false, events: [] },
    } as Partial<CompMatch>);
    expect(liveMinute(m, T0)).toBe(46);
  });

  it("vaut 0 sans état de direct", () => {
    expect(liveMinute(match("m"))).toBe(0);
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
