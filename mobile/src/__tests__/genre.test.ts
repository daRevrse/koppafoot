import {
  accorder, compatible, genreDuJoueur, genreRequis, lireCategorie, lireGenre, titre, categorieAffichee,
} from "@/lib/genre";
import { libellePoste, nomDuPoste, normaliserPoste } from "@/lib/postes";
import { effectifParPoste } from "@/lib/fiche-club";
import { formaterNote } from "@/lib/notes";

// Les modules vivent côté site (src/lib) ; ils sont purs, et c'est ici que la
// suite de tests des modules partagés tourne.

describe("le genre et la catégorie, lus en base", () => {
  it("ne garde que les valeurs connues", () => {
    expect(lireGenre("female")).toBe("female");
    expect(lireGenre("F")).toBeNull();
    expect(lireGenre(undefined)).toBeNull();
    expect(lireCategorie("women")).toBe("women");
    expect(lireCategorie("feminin")).toBeNull();
  });
});

describe("accorder", () => {
  it("prend le féminin pour une femme, le masculin sinon", () => {
    expect(accorder("female", "convoqué", "convoquée")).toBe("convoquée");
    expect(accorder("male", "convoqué", "convoquée")).toBe("convoqué");
    // Pas déclaré : le masculin, ce que le produit écrivait jusqu'ici.
    expect(accorder(null, "convoqué", "convoquée")).toBe("convoqué");
  });

  it("nomme les rôles", () => {
    expect(titre("player", "female")).toBe("Joueuse");
    expect(titre("organizer", "female")).toBe("Organisatrice");
    expect(titre("scorer", "female")).toBe("Scoreuse");
    expect(titre("referee", "female")).toBe("Arbitre");
    expect(titre("player", "female", "en")).toBe("Player");
  });
});

describe("le genre d'une ligne d'effectif", () => {
  it("prend celui de la personne, sinon celui d'une équipe féminine", () => {
    expect(genreDuJoueur("male", "women")).toBe("male");
    expect(genreDuJoueur(null, "women")).toBe("female");
    expect(genreDuJoueur(null, "mixed")).toBeNull();
    expect(genreDuJoueur(undefined, null)).toBeNull();
  });
});

describe("genre et catégorie", () => {
  it("ne ferme rien quand on ne sait pas", () => {
    expect(compatible("male", "women")).toBe(false);
    expect(compatible("female", "women")).toBe(true);
    expect(compatible("female", "mixed")).toBe(true);
    expect(compatible(null, "women")).toBe(true);
    expect(compatible("male", null)).toBe(true);
  });

  it("n'affiche un badge que pour le féminin et le mixte", () => {
    expect(categorieAffichee("women")).toBe(true);
    expect(categorieAffichee("mixed")).toBe(true);
    expect(categorieAffichee("men")).toBe(false);
    expect(categorieAffichee(null)).toBe(false);
  });
});

describe("genreRequis", () => {
  it("le demande à un compte à rôle ou à casquette qui ne l'a pas dit", () => {
    expect(genreRequis({ evolutionRole: "player" })).toBe(true);
    expect(genreRequis({ isOrganizer: true })).toBe(true);
    expect(genreRequis({ evolutionRole: "manager", gender: "female" })).toBe(false);
    // Un spectateur n'a rien à déclarer.
    expect(genreRequis({ evolutionRole: null })).toBe(false);
    expect(genreRequis(null)).toBe(false);
  });
});

describe("les postes au féminin", () => {
  it("accorde le libellé", () => {
    expect(nomDuPoste("goalkeeper", "fr", "female")).toBe("Gardienne");
    expect(nomDuPoste("defender", "fr", "female")).toBe("Défenseure");
    expect(nomDuPoste("forward", "fr", "female")).toBe("Attaquante");
    expect(nomDuPoste("midfielder", "fr", "female")).toBe("Milieu");
    expect(nomDuPoste("goalkeeper", "fr", null)).toBe("Gardien");
    expect(libellePoste("attaquant", "en", "female")).toBe("Forward");
  });

  it("relit les saisies au féminin", () => {
    expect(normaliserPoste("Gardienne")).toBe("goalkeeper");
    expect(normaliserPoste("défenseure")).toBe("defender");
    expect(normaliserPoste("Défenseuse")).toBe("defender");
    expect(normaliserPoste("attaquante")).toBe("forward");
  });

  it("titre l'effectif d'une équipe féminine", () => {
    const groupes = effectifParPoste(
      [{ nom: "A", poste: "goalkeeper" }, { nom: "B", poste: "forward" }],
      "fr",
      true,
    );
    expect(groupes.map((g) => g.titre)).toEqual(["Gardiennes", "Attaquantes"]);
    expect(effectifParPoste([{ nom: "A", poste: "goalkeeper" }], "fr").map((g) => g.titre)).toEqual(["Gardiens"]);
  });
});

describe("la note reste lisible dans les deux langues", () => {
  it("n'a pas bougé", () => {
    expect(formaterNote(7.26, "fr")).toBe("7,3");
  });
});
