import {
  cheminDeLAdresse, cleDeLigneDeCompetition, cleSansCompte, ligneDuClub, lireCleSansCompte,
  photoDeLaCompetition, photoDeLaLigne,
} from "@/lib/photos-sans-compte";

// Le module vit côté site (src/lib/photos-sans-compte) ; il est pur, et c'est
// ici que la suite de tests des modules partagés tourne.

describe("cleSansCompte", () => {
  it("désigne la fiche d'un joueur sans compte sous son club", () => {
    expect(cleSansCompte("clubA1", "g7Xk2")).toBe("clubA1:g7Xk2");
  });

  it("refuse ce qui pourrait sortir du chemin de la fiche", () => {
    expect(cleSansCompte("club/../users", "g1")).toBeNull();
    expect(cleSansCompte("club", "g1:autre")).toBeNull();
    expect(cleSansCompte(null, "g1")).toBeNull();
    expect(cleSansCompte("club", "")).toBeNull();
  });
});

describe("cleDeLigneDeCompetition", () => {
  it("retrouve la fiche d'une ligne copiée de l'effectif du club", () => {
    expect(cleDeLigneDeCompetition("clubA1", ligneDuClub("g7Xk2"))).toBe("clubA1:g7Xk2");
  });

  it("ignore une ligne tapée par l'organisateur, ou celle d'un compte", () => {
    expect(cleDeLigneDeCompetition("clubA1", "p_17")).toBeNull();
    expect(cleDeLigneDeCompetition("clubA1", "u_uid42")).toBeNull();
  });

  it("ne devine rien d'une équipe qui ne représente aucun club", () => {
    expect(cleDeLigneDeCompetition(null, ligneDuClub("g7Xk2"))).toBeNull();
  });
});

describe("lireCleSansCompte", () => {
  it("relit une clé bien formée", () => {
    expect(lireCleSansCompte("clubA1:g7Xk2")).toEqual({ clubId: "clubA1", ghostId: "g7Xk2" });
  });

  it("écarte le reste", () => {
    for (const cle of ["", "clubA1", "a:b:c", "a/b:c", ":g1", "club:"]) {
      expect(lireCleSansCompte(cle)).toBeNull();
    }
  });
});

describe("photoDeLaLigne", () => {
  const comptes = { u1: "https://x/compte.webp", u2: null };
  const club = { "clubA1:g7": "https://x/club.webp" };

  it("montre la photo du compte qui porte la ligne", () => {
    expect(photoDeLaLigne({ id: "u_u1", user_id: "u1", photo_url: "https://x/orga.webp" }, "clubA1", comptes, club))
      .toBe("https://x/compte.webp");
  });

  it("et rien d'autre quand ce compte n'en a pas : c'est lui qui choisit", () => {
    expect(photoDeLaLigne({ id: "u_u2", user_id: "u2", photo_url: "https://x/orga.webp" }, "clubA1", comptes, club))
      .toBeNull();
  });

  it("préfère la photo posée sur la ligne à celle de la fiche du club", () => {
    expect(photoDeLaLigne({ id: ligneDuClub("g7"), photo_url: "https://x/orga.webp" }, "clubA1", comptes, club))
      .toBe("https://x/orga.webp");
    expect(photoDeLaLigne({ id: ligneDuClub("g7") }, "clubA1", comptes, club)).toBe("https://x/club.webp");
  });

  it("rend null pour une ligne tapée à la main, sans photo", () => {
    expect(photoDeLaLigne({ id: "p_17" }, "clubA1", comptes, club)).toBeNull();
  });
});

describe("photoDeLaCompetition", () => {
  const adresse = (chemin: string) =>
    `https://firebasestorage.googleapis.com/v0/b/koppafoot.appspot.com/o/${encodeURIComponent(chemin)}?alt=media&token=t`;

  it("relit le chemin d'une adresse de téléchargement", () => {
    expect(cheminDeLAdresse(adresse("competitions/c1/joueurs/1-a.webp"))).toBe("competitions/c1/joueurs/1-a.webp");
    expect(cheminDeLAdresse("https://exemple.net/x.png")).toBeNull();
  });

  it("ne reconnaît que les photos rangées chez cette compétition", () => {
    expect(photoDeLaCompetition("c1", adresse("competitions/c1/joueurs/1-a.webp"))).toBe(true);
    // Une édition dupliquée garde les fichiers de la précédente.
    expect(photoDeLaCompetition("c2", adresse("competitions/c1/joueurs/1-a.webp"))).toBe(false);
    expect(photoDeLaCompetition("c1", adresse("competitions/c1/logo/logo.png"))).toBe(false);
    expect(photoDeLaCompetition("c1", null)).toBe(false);
  });
});
