import {
  extraTime, extraTimeDuration, minPlayers, reentryAllowed, subsMax,
} from "@/lib/competition-format";
import type { CompetitionFormat } from "@/types";

const format = (f: Partial<CompetitionFormat>) => f as CompetitionFormat;

describe("les changements", () => {
  it("à 9 joueurs et plus : cinq changements, et une sortie est définitive", () => {
    expect(subsMax(format({ team_size: 11 }))).toBe(5);
    expect(reentryAllowed(format({ team_size: 11 }))).toBe(false);
    expect(subsMax(format({ team_size: 9 }))).toBe(5);
  });

  it("à 8 joueurs et moins : changements illimités et volants", () => {
    expect(subsMax(format({ team_size: 7 }))).toBeNull();
    expect(reentryAllowed(format({ team_size: 7 }))).toBe(true);
    expect(subsMax(format({ team_size: 5 }))).toBeNull();
  });

  it("sans nombre de joueurs, c'est du foot à onze", () => {
    expect(subsMax(format({}))).toBe(5);
  });

  it("suit le choix de l'organisateur avant la valeur par défaut", () => {
    expect(subsMax(format({ team_size: 7, unlimited_subs: false }))).toBe(5);
    expect(subsMax(format({ team_size: 11, unlimited_subs: true }))).toBeNull();
    expect(subsMax(format({ team_size: 11, unlimited_subs: false, subs_max: 3 }))).toBe(3);
  });

  it("laisse régler le retour à part", () => {
    expect(reentryAllowed(format({ team_size: 11, subs_return: true }))).toBe(true);
    expect(reentryAllowed(format({ team_size: 7, subs_return: false }))).toBe(false);
  });
});

describe("les prolongations", () => {
  it("n'ont pas lieu sans que l'organisateur les demande", () => {
    expect(extraTime(format({}))).toBe(false);
    expect(extraTime(format({ extra_time: true }))).toBe(true);
  });

  it("durent un tiers d'une mi-temps, par défaut", () => {
    expect(extraTimeDuration(format({}))).toBe(15);
    expect(extraTimeDuration(format({ half_duration: 20 }))).toBe(7);
    expect(extraTimeDuration(format({ extra_time_duration: 10 }))).toBe(10);
  });
});

describe("le minimum de joueurs", () => {
  it("se calcule sur la base de sept pour onze", () => {
    expect([11, 9, 8, 7, 6, 5].map((n) => minPlayers(format({ team_size: n })))).toEqual([7, 6, 5, 4, 4, 3]);
  });

  it("suit le choix de l'organisateur", () => {
    expect(minPlayers(format({ team_size: 7, min_players: 5 }))).toBe(5);
  });
});
