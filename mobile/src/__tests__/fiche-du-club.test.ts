import { ficheDuClubDepuisLaRoute } from "~/lib/fiche-du-club";

describe("ficheDuClubDepuisLaRoute", () => {
  it("lit la fiche publique d'un club, la forme du plus ancien au plus récent", () => {
    const fiche = ficheDuClubDepuisLaRoute({
      team: {
        id: "c1", name: "Koppa F.C.", city: "Lomé", slogan: "Ensemble", logo_url: "https://x/l.png", banner_url: null,
        color: "emerald", level: "amateur", is_recruiting: true, followers_count: 3, member_count: 18,
        matches_played: 4, wins: 2, draws: 1, losses: 1, goals_for: 9, goals_against: 5, clean_sheets: 1,
        form: ["V", "D", "N"],
        effectif: [{ id: "u1", nom: "Ama", numero: "9", poste: "forward", photo: null, uid: "u1" }],
        manager: { uid: "m1", nom: "Kossi", photo: null },
        staff: [{ nom: "Yao", titre: "Entraîneur" }],
        matchs: [], competitions: [], meneurs: { buteurs: [], passeurs: [] },
      },
    });
    expect(fiche).toMatchObject({
      genre: "fiche", id: "c1", nom: "Koppa F.C.", ville: "Lomé", slogan: "Ensemble", logo: "https://x/l.png",
      niveau: "Amateur", recrute: true, abonnes: 3, membres: 18,
      bilan: { joues: 4, gagnes: 2, nuls: 1, perdus: 1, butsPour: 9, butsContre: 5, sansEncaisser: 1 },
      forme: ["N", "D", "V"],
      manager: { uid: "m1", nom: "Kossi", photo: null },
    });
    expect(fiche?.genre === "fiche" && fiche.effectif).toHaveLength(1);
  });

  it("lit un club fantôme : son nom, sans fiche", () => {
    expect(ficheDuClubDepuisLaRoute({ team: { id: "g1", name: "Les Inconnus", is_ghost: true } }))
      .toEqual({ genre: "fantome", id: "g1", nom: "Les Inconnus", logo: null });
  });

  it("ne lit rien d'une réponse vide", () => {
    expect(ficheDuClubDepuisLaRoute({ team: null })).toBeNull();
    expect(ficheDuClubDepuisLaRoute(null)).toBeNull();
  });
});
