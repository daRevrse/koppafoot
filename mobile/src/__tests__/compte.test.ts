import { messageDInvitation, nomDeLOffre } from "~/lib/compte";
import { SITE_URL } from "~/lib/config";

describe("nomDeLOffre", () => {
  it("nomme l'offre que le compte peut avoir, comme le menu du site", () => {
    expect(nomDeLOffre({ evolutionRole: "manager" })).toBe("KoppaFoot+");
    expect(nomDeLOffre({ evolutionRole: "player", isOrganizer: true })).toBe("KoppaFoot+");
    expect(nomDeLOffre({ evolutionRole: "player" })).toBe("Pas de pubs");
  });

  it("sans compte : les offres", () => {
    expect(nomDeLOffre(null)).toBe("Offres");
  });
});

describe("messageDInvitation", () => {
  it("invite au nom du compte, avec l'adresse du site", () => {
    expect(messageDInvitation("Kossi")).toBe(
      `Kossi t'invite à suivre les compétitions de football en direct sur Koppafoot ⚽\n${SITE_URL}`,
    );
    expect(messageDInvitation(null)).toBe(`Suis les compétitions de football en direct sur Koppafoot ⚽\n${SITE_URL}`);
  });
});
