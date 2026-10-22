import { toMatch } from "@/lib/match-mappers";
import type { FirestoreMatch } from "@/types";

// Le module vit côté site (src/lib/match-mappers) ; il est pur, et c'est ici
// que la suite de tests des modules partagés tourne.

const brut = (p: Partial<FirestoreMatch> = {}) => ({
  home_team_id: "A", away_team_id: "B", home_team_name: "Alpha", away_team_name: "Beta",
  date: "2026-10-21", time: "16:00", status: "completed", score_home: 2, score_away: 1,
  ...p,
}) as FirestoreMatch;

const ligne = (id: string) => ({ player_id: id, name: id, number: "9", role: "starter", user_id: null, position: "attaquant" });

describe("toMatch", () => {
  it("lit la feuille, et retombe sur la compo d'avant (ghost) faute de feuille", () => {
    const m = toMatch("m1", brut({
      home_lineup: [ligne("p1")] as unknown as FirestoreMatch["home_lineup"],
      away_ghost_lineup: [ligne("g1")] as unknown as FirestoreMatch["away_ghost_lineup"],
    }));
    expect(m.homeLineup.map((e) => e.playerId)).toEqual(["p1"]);
    expect(m.awayLineup.map((e) => e.playerId)).toEqual(["g1"]);
  });

  it("garde le passeur et le statut VAR des faits de jeu", () => {
    const m = toMatch("m1", brut({
      live_state: {
        current_period: 4, timer_start_at: null, timer_offset: 0, is_timer_running: false,
        events: [{
          id: "e1", type: "goal", period: 1, minute: 12, team_id: "A", player_id: "p1", player_name: "Kossi",
          assist_player_id: "p2", assist_player_name: "Ama", var_status: "cancelled", created_at: "2026-10-21T16:12:00Z",
        }],
      } as unknown as FirestoreMatch["live_state"],
    }));
    expect(m.liveState!.events[0]).toMatchObject({ assistPlayerName: "Ama", varStatus: "cancelled", teamId: "A" });
  });
});
