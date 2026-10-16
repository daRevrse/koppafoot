import { gereLaCompetition, isOrganizer, possedeLaCompetition } from "@/lib/hats";

// Le module vit côté site (src/lib/hats) ; il est pur, et c'est ici que la
// suite de tests des modules partagés tourne.

const competition = { organizerIds: ["orga"], moderatorIds: ["modo"] };

describe("gereLaCompetition", () => {
  it("ouvre l'espace à ses organisateurs", () => {
    expect(gereLaCompetition({ uid: "orga", isOrganizer: true }, competition)).toBe(true);
  });

  it("à ses modérateurs, casquette d'organisateur ou pas", () => {
    expect(gereLaCompetition({ uid: "modo" }, competition)).toBe(true);
  });

  it("et à l'administration, qui n'est pas dans la liste", () => {
    expect(gereLaCompetition({ uid: "admin", isSuperAdmin: true }, competition)).toBe(true);
  });

  it("mais pas à l'organisateur d'une autre compétition", () => {
    const autre = { uid: "autre", isOrganizer: true };
    expect(isOrganizer(autre)).toBe(true);
    expect(gereLaCompetition(autre, competition)).toBe(false);
  });

  it("lit une compétition d'avant les modérateurs", () => {
    expect(gereLaCompetition({ uid: "modo" }, { organizerIds: ["orga"] })).toBe(false);
  });

  it("ni à personne tant qu'on ne sait pas qui regarde ou quoi", () => {
    expect(gereLaCompetition(null, competition)).toBe(false);
    expect(gereLaCompetition({ uid: "orga" }, null)).toBe(false);
  });
});

describe("possedeLaCompetition", () => {
  it("réserve au propriétaire ce qu'un modérateur ne fait pas", () => {
    expect(possedeLaCompetition({ uid: "orga" }, competition)).toBe(true);
    expect(possedeLaCompetition({ uid: "modo" }, competition)).toBe(false);
  });

  it("l'administration passe, comme partout", () => {
    expect(possedeLaCompetition({ uid: "admin", isSuperAdmin: true }, competition)).toBe(true);
  });

  it("personne sans compte ni compétition", () => {
    expect(possedeLaCompetition(null, competition)).toBe(false);
    expect(possedeLaCompetition({ uid: "orga" }, null)).toBe(false);
  });
});
