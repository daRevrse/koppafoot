import { ageLe, ficheDepuisLaRoute } from "~/lib/fiche-joueur";

const MAINTENANT = new Date("2026-10-22T12:00:00");

describe("ficheDepuisLaRoute", () => {
  it("lit la fiche publique : identité, chiffres, équipes, avec les libellés du site", () => {
    const fiche = ficheDepuisLaRoute("u1", {
      profile: {
        uid: "u1", first_name: "Kossi", last_name: "Mensah", profile_picture_url: "https://x/p.jpg",
        location_city: "Lomé", position: "forward", jersey_number: 9, strong_foot: "left", skill_level: "advanced",
        height: 178, date_of_birth: "2000-11-03", user_type: "player", followers_count: 12, bio: "Buteur",
        gallery_urls: ["https://x/1.jpg", 42], matches_played: 14, goals: 9, assists: 3,
      },
      teams: [{ id: "t1", name: "Alpha", city: "Lomé", logoUrl: null, wins: 5, draws: 2, losses: 1, matchesPlayed: 8, isManager: false }],
    }, MAINTENANT);
    expect(fiche).toMatchObject({
      genre: "fiche", nom: "Kossi Mensah", photo: "https://x/p.jpg", ville: "Lomé",
      role: "Joueur", poste: "Attaquant", numero: "9", pied: "Pied gauche", niveau: "Confirmé",
      taille: 178, age: 25, abonnes: 12, matchs: 14, buts: 9, passes: 3, galerie: ["https://x/1.jpg"],
    });
    expect(fiche?.genre === "fiche" && fiche.equipes[0]).toEqual({
      id: "t1", nom: "Alpha", ville: "Lomé", logo: null, victoires: 5, nuls: 2, defaites: 1, joues: 8, dirige: false,
    });
  });

  it("accorde le rôle et le poste d'une joueuse", () => {
    const fiche = ficheDepuisLaRoute("u2", {
      profile: { uid: "u2", first_name: "Ama", last_name: "", user_type: "player", gender: "female", position: "goalkeeper" },
      teams: [],
    }, MAINTENANT);
    expect(fiche).toMatchObject({ role: "Joueuse", poste: "Gardienne" });
  });

  it("lit un compte sans fiche publique : le nom et la photo, rien d'autre", () => {
    expect(ficheDepuisLaRoute("u3", {
      profile: null, teams: [], sansProfilPublic: { uid: "u3", first_name: "Yao", last_name: "K.", profile_picture_url: null },
    }, MAINTENANT)).toEqual({ genre: "sans-fiche", uid: "u3", nom: "Yao K.", photo: null });
  });

  it("ne lit rien d'une réponse vide", () => {
    expect(ficheDepuisLaRoute("u4", { profile: null }, MAINTENANT)).toBeNull();
    expect(ficheDepuisLaRoute("u4", null, MAINTENANT)).toBeNull();
  });
});

describe("ageLe", () => {
  it("compte les anniversaires passés", () => {
    expect(ageLe("2000-10-22", MAINTENANT)).toBe(26);
    expect(ageLe("2000-10-23", MAINTENANT)).toBe(25);
    expect(ageLe("pas une date", MAINTENANT)).toBeNull();
    expect(ageLe(null, MAINTENANT)).toBeNull();
  });
});
