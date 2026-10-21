import { pouleDuMatch, type GroupStanding } from "@/lib/poules";

const poule = (group: string, ids: string[]) =>
  ({ group, rows: ids.map((id) => ({ team: { id } })) }) as unknown as GroupStanding;

const poules = [poule("A", ["a1", "a2", "a3"]), poule("B", ["b1", "b2"])];

describe("pouleDuMatch", () => {
  it("rend la poule qui contient les deux équipes", () => {
    expect(pouleDuMatch(poules, "a3", "a1")?.group).toBe("A");
  });

  it("rien quand une équipe manque, ou qu'elles ne sont pas dans la même poule", () => {
    expect(pouleDuMatch(poules, "a1", null)).toBeNull();
    expect(pouleDuMatch(poules, "a1", "b1")).toBeNull();
  });
});
