import { statusFlow } from "@/lib/competition-format";

// Le module vit côté site (src/lib/competition-format) ; il est pur, et c'est
// ici que la suite de tests des modules partagés tourne.

describe("statusFlow", () => {
  it("clôt les inscriptions avant le coup d'envoi", () => {
    expect(statusFlow("groups_knockout")).toEqual([
      "draft", "registration", "registration_closed", "group_stage", "knockout", "completed",
    ]);
  });

  it("garde l'étape pour une coupe sans poules", () => {
    const flow = statusFlow("cup");
    expect(flow.slice(0, 3)).toEqual(["draft", "registration", "registration_closed"]);
    expect(flow).not.toContain("group_stage");
  });
});
