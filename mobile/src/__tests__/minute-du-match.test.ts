import { dureeMiTempsDe } from "@/lib/competition-format";
import {
  libelleMinute, minuteEnDirect, texteMinute,
} from "@/lib/minute-du-match";
import type { Competition } from "@/types";

describe("dureeMiTempsDe", () => {
  it("lit la durée du format de la compétition", () => {
    expect(dureeMiTempsDe({ format: { half_duration: 20 } } as Competition)).toBe(20);
  });

  it("retombe sur 45 sans format : amicaux, compétitions du monde", () => {
    expect(dureeMiTempsDe({} as Competition)).toBe(45);
    expect(dureeMiTempsDe(null)).toBe(45);
  });
});

describe("libelleMinute", () => {
  it("écrit une minute du temps réglementaire telle quelle", () => {
    expect(libelleMinute(1, 12, 45)).toBe("12'");
    expect(libelleMinute(1, 45, 45)).toBe("45'");
    expect(libelleMinute(3, 46, 45)).toBe("46'");
  });

  it("écrit le temps additionnel de la première mi-temps en 45+N", () => {
    expect(libelleMinute(1, 46, 45)).toBe("45+1'");
    expect(libelleMinute(1, 48, 45)).toBe("45+3'");
  });

  it("écrit le temps additionnel de la seconde mi-temps en 90+N", () => {
    expect(libelleMinute(3, 90, 45)).toBe("90'");
    expect(libelleMinute(3, 93, 45)).toBe("90+3'");
  });

  it("suit la durée du format", () => {
    expect(libelleMinute(1, 21, 20)).toBe("20+1'");
    expect(libelleMinute(3, 42, 20)).toBe("40+2'");
  });

  it("laisse telle quelle une minute prise pendant la pause", () => {
    // Un changement à la mi-temps porte la 46e : c'est l'usage.
    expect(libelleMinute(2, 46, 45)).toBe("46'");
  });

  it("laisse telle quelle une minute dont la période est inconnue", () => {
    expect(libelleMinute(undefined, 50, 45)).toBe("50'");
  });

  it("prend le signe de minute demandé", () => {
    expect(libelleMinute(1, 47, 45, "′")).toBe("45+2′");
  });
});

describe("minuteEnDirect", () => {
  const DEPART = Date.parse("2026-10-14T15:00:00.000Z");
  const enDirect = (ls: Record<string, unknown> | null) =>
    ({ status: "live", liveState: ls }) as Parameters<typeof minuteEnDirect>[0];

  it("ne dit rien d'un match sans horloge", () => {
    expect(minuteEnDirect(enDirect(null), 45)).toBeNull();
  });

  it("dit « avant » tant que le chrono n'a jamais tourné", () => {
    const m = enDirect({ currentPeriod: 1, isTimerRunning: false, timerStartAt: null, timerOffset: 0 });
    expect(minuteEnDirect(m, 45)).toEqual({ genre: "avant" });
  });

  it("dit « pause » à la mi-temps, et non la 46e", () => {
    const m = enDirect({ currentPeriod: 2, isTimerRunning: false, timerStartAt: null, timerOffset: 45 * 60_000 });
    expect(minuteEnDirect(m, 45)).toEqual({ genre: "pause" });
  });

  it("compte la minute en cours pendant le jeu", () => {
    const m = enDirect({
      currentPeriod: 1, isTimerRunning: true, timerOffset: 0,
      timerStartAt: new Date(DEPART).toISOString(),
    });
    expect(minuteEnDirect(m, 45, DEPART + 11 * 60_000 + 5_000)).toEqual({ genre: "jeu", minute: 12, plus: 0 });
  });

  it("passe en temps additionnel au-delà de la durée réglementaire", () => {
    const m = enDirect({
      currentPeriod: 1, isTimerRunning: true, timerOffset: 0,
      timerStartAt: new Date(DEPART).toISOString(),
    });
    expect(minuteEnDirect(m, 45, DEPART + 46 * 60_000 + 30_000)).toEqual({ genre: "jeu", minute: 45, plus: 2 });
  });

  it("dit « interrompu » pendant une interruption", () => {
    const m = enDirect({
      currentPeriod: 1, isTimerRunning: false, timerStartAt: null, timerOffset: 30 * 60_000,
      jeu: { balle: "morte", raison: "interruption", engage: null, premier: "home" },
    });
    expect(minuteEnDirect(m, 45)).toEqual({ genre: "interrompu" });
  });

  it("lit une horloge arrêtée en cours de période", () => {
    const m = enDirect({ currentPeriod: 3, isTimerRunning: false, timerStartAt: null, timerOffset: 91 * 60_000 });
    expect(minuteEnDirect(m, 45)).toEqual({ genre: "jeu", minute: 90, plus: 2 });
  });
});

describe("texteMinute", () => {
  const libelles = { avant: "Bientôt", pause: "MT", interrompu: "Interrompu" };

  it("écrit le jeu, la pause, l'avant-match et l'interruption", () => {
    expect(texteMinute({ genre: "interrompu" }, libelles)).toBe("Interrompu");
    expect(texteMinute({ genre: "jeu", minute: 12, plus: 0 }, libelles)).toBe("12′");
    expect(texteMinute({ genre: "jeu", minute: 45, plus: 2 }, libelles)).toBe("45+2′");
    expect(texteMinute({ genre: "pause" }, libelles)).toBe("MT");
    expect(texteMinute({ genre: "avant" }, libelles)).toBe("Bientôt");
  });
});
