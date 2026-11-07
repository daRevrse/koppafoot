import { equipeDeLActivation } from "@/lib/equipe-activation";

// Le site : activer le rôle manager avec un nom d'équipe (components/roles/
// ChoixDuRole) doit créer l'équipe. Le nom n'allait que dans `team_name` du
// profil, et l'espace manager restait sans équipe.

const champs = { equipe: " FC Étoile ", ville: " Lomé ", genre: "female" as const };

describe("equipeDeLActivation", () => {
  it("crée l'équipe d'un manager qui l'a nommée, avec les réglages par défaut du formulaire de création", () => {
    expect(equipeDeLActivation("manager", champs, [])).toEqual({
      genre: "creer",
      champs: { name: "FC Étoile", city: "Lomé", level: "amateur", category: "women", color: "emerald", description: "", maxMembers: 14 },
    });
    expect(equipeDeLActivation("manager", { ...champs, genre: "male" }, [])).toMatchObject({ champs: { category: "men" } });
    expect(equipeDeLActivation("manager", { ...champs, genre: null }, [])).toMatchObject({ champs: { category: "men" } });
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
