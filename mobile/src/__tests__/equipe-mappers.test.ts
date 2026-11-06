import { toGhostPlayer, toJoinRequest, toTeam } from "@/lib/equipe-mappers";
import type { FirestoreGhostPlayer, FirestoreJoinRequest, FirestoreTeam } from "@/types";

// Les mappeurs d'équipe (src/lib/equipe-mappers), partagés par le site et
// l'application : un champ mal lu, et l'écran de gestion écrit à côté.

const equipe = (d: Partial<FirestoreTeam>) =>
  ({ name: "FC Koppa", manager_id: "m", city: "Lomé", description: "", level: "amateur", max_members: 20, color: "emerald", ...d }) as FirestoreTeam;

describe("toTeam", () => {
  it("lit l'effectif, les dossards, les titulaires et le staff délégué", () => {
    const t = toTeam("t1", equipe({
      member_ids: ["a", "b"], squad_numbers: { a: "9" }, lineup_ids: ["a"], staff_manager_ids: ["d"],
    }));
    expect(t.id).toBe("t1");
    expect(t.managerId).toBe("m");
    expect(t.memberIds).toEqual(["a", "b"]);
    expect(t.squadNumbers).toEqual({ a: "9" });
    expect(t.lineupIds).toEqual(["a"]);
    expect(t.staffManagerIds).toEqual(["d"]);
  });

  it("donne des listes vides quand les champs manquent", () => {
    const t = toTeam("t1", equipe({}));
    expect(t.memberIds).toEqual([]);
    expect(t.squadNumbers).toEqual({});
    expect(t.lineupIds).toEqual([]);
    expect(t.staffManagerIds).toEqual([]);
    expect(t.isGhost).toBe(false);
  });
});

describe("toGhostPlayer", () => {
  it("garde l'équipe, et rend un dossard absent quand il est nul", () => {
    // La base écrit `null` (createGhostPlayer), que le type ne prévoit pas.
    const g = toGhostPlayer("g1", "t1", {
      first_name: "Kodjo", last_name: "Mensah", position: "defender", squad_number: null,
      goals: 2, assists: 0, matches_played: 3, created_at: "2026-11-01T10:00:00.000Z", updated_at: "2026-11-01T10:00:00.000Z",
    } as unknown as FirestoreGhostPlayer);
    expect(g.teamId).toBe("t1");
    expect(g.firstName).toBe("Kodjo");
    expect(g.squadNumber).toBeUndefined();
    expect(g.goals).toBe(2);
  });
});

describe("toJoinRequest", () => {
  it("garde le statut et le manager de la demande", () => {
    const d = toJoinRequest("j1", {
      player_id: "p", player_name: "Ama", player_city: "Lomé", player_position: "forward", player_level: "amateur",
      team_id: "t1", team_name: "FC Koppa", manager_id: "m", message: "", status: "pending",
      created_at: "2026-11-01T10:00:00.000Z", updated_at: "2026-11-01T10:00:00.000Z",
    } as FirestoreJoinRequest);
    expect(d.status).toBe("pending");
    expect(d.managerId).toBe("m");
    expect(d.playerName).toBe("Ama");
  });
});
