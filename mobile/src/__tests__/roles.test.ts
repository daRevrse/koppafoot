import { CHAMPS_DU_ROLE, equipeDeLActivation, patchDActivation, titreDeLOnglet } from "~/lib/roles";

describe("titreDeLOnglet", () => {
  it("s'appelle Évolution tant que le compte n'a pas de rôle", () => {
    expect(titreDeLOnglet(null)).toBe("Évolution");
    expect(titreDeLOnglet({ evolutionRole: null, gender: null })).toBe("Évolution");
  });

  it("prend le nom du rôle, accordé", () => {
    expect(titreDeLOnglet({ evolutionRole: "player", gender: "male" })).toBe("Joueur");
    expect(titreDeLOnglet({ evolutionRole: "player", gender: "female" })).toBe("Joueuse");
    expect(titreDeLOnglet({ evolutionRole: "manager", gender: null })).toBe("Manager");
    expect(titreDeLOnglet({ evolutionRole: "referee", gender: null })).toBe("Arbitre");
  });
});

describe("patchDActivation", () => {
  const base = { genre: "female" as const, ville: " Lomé ", poste: "forward", pied: "left", equipe: "FC Étoile", licence: "regional", numero: " TG-1 " };

  it("écrit le rôle, le type de compte, la ville et le genre, puis ce que le rôle demande", () => {
    expect(patchDActivation("player", base)).toEqual({
      evolution_role: "player", user_type: "player", location_city: "Lomé", gender: "female", position: "forward", strong_foot: "left",
    });
    expect(patchDActivation("referee", base)).toEqual({
      evolution_role: "referee", user_type: "referee", location_city: "Lomé", gender: "female", license_level: "regional", license_number: "TG-1",
    });
    expect(patchDActivation("manager", base)).toEqual({
      evolution_role: "manager", user_type: "manager", location_city: "Lomé", gender: "female", team_name: "FC Étoile",
    });
  });

  it("n'écrit que des champs que les règles laissent au titulaire (isRoleEvolution)", () => {
    for (const role of ["player", "manager", "referee"] as const) {
      for (const cle of Object.keys(patchDActivation(role, base))) expect(CHAMPS_DU_ROLE).toContain(cle);
    }
  });

  it("laisse de côté un champ vide", () => {
    expect(patchDActivation("player", { ...base, poste: "", pied: "" })).not.toHaveProperty("position");
  });
});

describe("equipeDeLActivation", () => {
  // Activer le rôle manager avec un nom d'équipe doit créer l'équipe : avant,
  // le nom n'allait que dans `team_name` du profil, et « Mon club » restait vide.
  const champs = { genre: "female" as const, ville: " Lomé ", poste: "", pied: "", equipe: " FC Étoile ", licence: "", numero: "" };

  it("crée l'équipe d'un manager qui l'a nommée, avec les réglages par défaut du formulaire du site", () => {
    expect(equipeDeLActivation("manager", champs, [])).toEqual({
      genre: "creer",
      champs: { name: "FC Étoile", city: "Lomé", level: "amateur", category: "women", color: "emerald", description: "", maxMembers: 14 },
    });
    expect(equipeDeLActivation("manager", { ...champs, genre: "male" }, [])).toMatchObject({ champs: { category: "men" } });
  });

  it("ne crée rien sans nom d'équipe, ni pour un joueur ou un arbitre", () => {
    expect(equipeDeLActivation("manager", { ...champs, equipe: "  " }, [])).toEqual({ genre: "rien" });
    expect(equipeDeLActivation("player", champs, [])).toEqual({ genre: "rien" });
    expect(equipeDeLActivation("referee", champs, [])).toEqual({ genre: "rien" });
  });

  it("ne crée pas de doublon d'une équipe qu'on gère déjà, quelle que soit la casse ou les espaces", () => {
    expect(equipeDeLActivation("manager", champs, ["fc  étoile"])).toEqual({ genre: "deja", nom: "FC Étoile" });
  });

  it("demande une ville : le serveur refuse une équipe sans ville", () => {
    expect(equipeDeLActivation("manager", { ...champs, ville: " " }, [])).toEqual({ genre: "sans-ville" });
  });
});
