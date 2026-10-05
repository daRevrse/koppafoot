import { gereLaCompetition, isOrganizer } from "@/lib/hats";

// Le module vit côté site (src/lib/hats) ; il est pur, et c'est ici que la
// suite de tests des modules partagés tourne.

const competition = { organizerIds: ["orga"] };

describe("gereLaCompetition", () => {
  it("ouvre l'espace à ses organisateurs", () => {
    expect(gereLaCompetition({ uid: "orga", isOrganizer: true }, competition)).toBe(true);
  });

  it("et à l'administration, qui n'est pas dans la liste", () => {
    expect(gereLaCompetition({ uid: "admin", isSuperAdmin: true }, competition)).toBe(true);
  });

  it("mais pas à l'organisateur d'une autre compétition", () => {
    const autre = { uid: "autre", isOrganizer: true };
    expect(isOrganizer(autre)).toBe(true);
    expect(gereLaCompetition(autre, competition)).toBe(false);
  });

  it("ni à personne tant qu'on ne sait pas qui regarde ou quoi", () => {
    expect(gereLaCompetition(null, competition)).toBe(false);
    expect(gereLaCompetition({ uid: "orga" }, null)).toBe(false);
  });
});
