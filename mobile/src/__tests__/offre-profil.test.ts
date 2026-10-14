import {
  aDroitAKoppaFootPlus, koppaFootPlusLeve, messageLimite, offreAffichee, titresDuCompte, titresDuProfil,
} from "@/lib/offre";

// Le module vit côté site (src/lib/offre) ; il est pur, et c'est ici que la
// suite de tests des modules partagés tourne.

const AUCUN = { manager: false, organisateur: false, gerant: false };

describe("messageLimite", () => {
  it("nomme KoppaFoot+ : c'est lui qui lève la limite, pour qui porte le titre", () => {
    expect(messageLimite("equipes", 2))
      .toBe("Tu gères déjà 2 équipes, le maximum de l'offre gratuite. KoppaFoot+ lève cette limite.");
    expect(messageLimite("terrains", 1)).toContain("KoppaFoot+ lève cette limite.");
  });
});

describe("titresDuProfil", () => {
  it("un manager l'est par son rôle, quel que soit le champ qui le porte", () => {
    expect(titresDuProfil({ user_type: "manager" })).toEqual({ ...AUCUN, manager: true });
    expect(titresDuProfil({ user_type: "user", evolution_role: "manager" })).toEqual({ ...AUCUN, manager: true });
  });

  it.each(["user", "player", "referee"])("un compte « %s » n'a aucun titre", (role) => {
    expect(titresDuProfil({ user_type: role, evolution_role: role === "user" ? undefined : role })).toEqual(AUCUN);
  });

  it("les casquettes se lisent dans leurs drapeaux, et se cumulent avec le rôle", () => {
    expect(titresDuProfil({ user_type: "player", is_organizer: true })).toEqual({ ...AUCUN, organisateur: true });
    expect(titresDuProfil({ user_type: "referee", is_venue_owner: true })).toEqual({ ...AUCUN, gerant: true });
    expect(titresDuProfil({ user_type: "manager", is_organizer: true, is_venue_owner: true }))
      .toEqual({ manager: true, organisateur: true, gerant: true });
  });

  it("le superadmin organise d'office", () => {
    expect(titresDuProfil({ user_type: "player", is_superadmin: true }).organisateur).toBe(true);
    expect(titresDuProfil({ user_type: "superadmin" }).organisateur).toBe(true);
  });

  it("le scoreur est une casquette qui n'ouvre rien", () => {
    expect(titresDuProfil({ user_type: "player", is_scorer: true } as never)).toEqual(AUCUN);
  });

  it("un drapeau qui n'est pas exactement vrai ne compte pas", () => {
    expect(titresDuProfil({ is_organizer: "true", is_venue_owner: 1 })).toEqual(AUCUN);
  });

  it("un profil absent n'a aucun titre", () => {
    expect(titresDuProfil(null)).toEqual(AUCUN);
    expect(titresDuProfil(undefined)).toEqual(AUCUN);
  });
});

describe("titresDuCompte", () => {
  it("lit le profil tel que le navigateur le tient", () => {
    expect(titresDuCompte({ userType: "user", evolutionRole: "manager", isVenueOwner: true }))
      .toEqual({ manager: true, organisateur: false, gerant: true });
    expect(titresDuCompte({ userType: "player", isSuperAdmin: true }).organisateur).toBe(true);
    expect(titresDuCompte(null)).toEqual(AUCUN);
  });
});

describe("aDroitAKoppaFootPlus", () => {
  it("un seul titre suffit", () => {
    expect(aDroitAKoppaFootPlus({ ...AUCUN, manager: true })).toBe(true);
    expect(aDroitAKoppaFootPlus({ ...AUCUN, organisateur: true })).toBe(true);
    expect(aDroitAKoppaFootPlus({ ...AUCUN, gerant: true })).toBe(true);
  });

  it("sans titre, non : un joueur, un arbitre, un spectateur, un scoreur", () => {
    expect(aDroitAKoppaFootPlus(AUCUN)).toBe(false);
  });
});

describe("offreAffichee", () => {
  it("KOPPAFOOT+ pour qui gère, « Pas de pubs » pour les autres", () => {
    expect(offreAffichee({ ...AUCUN, manager: true })).toBe("pro");
    expect(offreAffichee({ ...AUCUN, gerant: true })).toBe("pro");
    expect(offreAffichee(titresDuCompte({ userType: "player", isOrganizer: true }))).toBe("pro");
    expect(offreAffichee(AUCUN)).toBe("sans_pub");
    expect(offreAffichee(titresDuCompte({ userType: "referee" }))).toBe("sans_pub");
    expect(offreAffichee(titresDuCompte(null))).toBe("sans_pub");
  });
});

describe("koppaFootPlusLeve", () => {
  it("à un manager : ses équipes et son club, rien d'autre", () => {
    const t = { ...AUCUN, manager: true };
    expect(koppaFootPlusLeve(t, "equipes")).toBe(true);
    expect(koppaFootPlusLeve(t, "club")).toBe(true);
    expect(koppaFootPlusLeve(t, "terrains")).toBe(false);
    expect(koppaFootPlusLeve(t, "competitions")).toBe(false);
    expect(koppaFootPlusLeve(t, "equipesParCompetition")).toBe(false);
  });

  it("à un organisateur : ses compétitions, rien d'autre", () => {
    const t = { ...AUCUN, organisateur: true };
    expect(koppaFootPlusLeve(t, "competitions")).toBe(true);
    expect(koppaFootPlusLeve(t, "equipesParCompetition")).toBe(true);
    expect(koppaFootPlusLeve(t, "equipes")).toBe(false);
    expect(koppaFootPlusLeve(t, "club")).toBe(false);
    expect(koppaFootPlusLeve(t, "terrains")).toBe(false);
  });

  it("à un propriétaire de terrain : ses terrains, rien d'autre", () => {
    const t = { ...AUCUN, gerant: true };
    expect(koppaFootPlusLeve(t, "terrains")).toBe(true);
    expect(koppaFootPlusLeve(t, "equipes")).toBe(false);
    expect(koppaFootPlusLeve(t, "competitions")).toBe(false);
  });

  it("les titres se cumulent", () => {
    const t = { manager: true, organisateur: false, gerant: true };
    expect(koppaFootPlusLeve(t, "equipes")).toBe(true);
    expect(koppaFootPlusLeve(t, "terrains")).toBe(true);
    expect(koppaFootPlusLeve(t, "competitions")).toBe(false);
  });

  it("sans titre, rien", () => {
    expect(koppaFootPlusLeve(AUCUN, "equipes")).toBe(false);
    expect(koppaFootPlusLeve(AUCUN, "club")).toBe(false);
  });
});
