import { toCompMatch } from "@/lib/competition-mappers";
import type { FirestoreCompMatch } from "@/types";

// Un match de compétition en direct, tel que la console l'écrit.
const brut = (liveState: Record<string, unknown>): FirestoreCompMatch =>
  ({
    stage: "group",
    status: "live",
    home_team_name: "A",
    away_team_name: "B",
    live_state: {
      current_period: 1,
      timer_start_at: null,
      timer_offset: 0,
      is_timer_running: false,
      events: [],
      ...liveState,
    },
  }) as unknown as FirestoreCompMatch;

describe("toCompMatch, l'horloge du direct", () => {
  // La console écrit la possession et le temps additionnel d'un match de
  // compétition, mais le convertisseur ne les relisait pas : le réglage du
  // temps additionnel retombait à zéro, et la possession était perdue au
  // moindre rechargement de la console.
  it("relit la possession", () => {
    const m = toCompMatch("m", brut({
      possession: { home_ms: 120_000, away_ms: 60_000, side: "home", since: null },
    }));
    // Un match d'avant le comptage des passes : elles se lisent comme zéro.
    expect(m.liveState?.possession).toEqual({
      homeMs: 120_000, awayMs: 60_000, side: "home", since: null, homePasses: 0, awayPasses: 0,
    });
  });

  it("relit les passes", () => {
    const m = toCompMatch("m", brut({
      possession: { home_ms: 0, away_ms: 0, side: "away", since: null, home_passes: 41, away_passes: 17 },
    }));
    expect(m.liveState?.possession?.homePasses).toBe(41);
    expect(m.liveState?.possession?.awayPasses).toBe(17);
  });

  it("relit le temps additionnel annoncé", () => {
    const m = toCompMatch("m", brut({ added_time: { first: 3, second: 0 } }));
    expect(m.liveState?.addedTime).toEqual({ first: 3, second: 0 });
  });

  it("rend null quand rien n'a été posé", () => {
    const m = toCompMatch("m", brut({}));
    expect(m.liveState?.possession).toBeNull();
    expect(m.liveState?.addedTime).toBeNull();
  });
});
