import { LIMITES_GRATUIT } from "@/lib/offre";
import { montant, vueDuCompte, vueVisiteur, type OffreDuCompte } from "~/lib/offre-app";

const PRIX = { pro_mois: 1200, pro_an: 13000, sans_pub_mois: 500, sans_pub_an: 5000 };
const sansEspaces = (s: string) => s.replace(/\s/g, " ");

const offre = (p: Partial<OffreDuCompte> = {}): OffreDuCompte => ({
  estPro: false,
  pro: null,
  sansPub: null,
  limitesDepuis: null,
  limitesActives: false,
  limites: LIMITES_GRATUIT,
  usage: { equipes: 1, terrains: 0, competitions: 0 },
  casquettes: { manager: false, organisateur: false, gerant: false },
  leve: { equipes: false, terrains: false, competitions: false, equipesParCompetition: false },
  ...p,
});

describe("montant", () => {
  it("écrit les francs CFA avec les milliers séparés", () => {
    expect(sansEspaces(montant(13000))).toBe("13 000 FCFA");
    expect(sansEspaces(montant(500))).toBe("500 FCFA");
  });

  it("n'emploie pas l'espace fine, absente de la police des titres", () => {
    expect(montant(13000)).not.toMatch(/\u202f/);
  });
});

describe("vueVisiteur", () => {
  it("présente les deux offres, tout ce que KoppaFoot+ peut ouvrir, et leurs tarifs", () => {
    const v = vueVisiteur(PRIX);
    expect(v.titre).toBe("Offres");
    expect(v.plus?.avantages).toHaveLength(5);
    expect(v.plus?.tarifs).toEqual({ mois: 1200, an: 13000 });
    expect(v.sansPub?.tarifs).toEqual({ mois: 500, an: 5000 });
    expect(v.plus?.actif).toBe(false);
    expect(v.jauges).toBeNull();
  });

  it("n'invente pas de tarif quand le site n'en a pas fixé", () => {
    const v = vueVisiteur({ pro_mois: 1200, sans_pub_mois: "gratuit" });
    expect(v.plus?.tarifs).toEqual({ mois: 1200, an: null });
    expect(v.sansPub?.tarifs).toEqual({ mois: null, an: null });
  });
});

describe("vueDuCompte", () => {
  it("à un joueur, seulement « Pas de pubs »", () => {
    const v = vueDuCompte(offre(), PRIX);
    expect(v.titre).toBe("Pas de pubs");
    expect(v.plus).toBeNull();
    expect(v.sansPub).toMatchObject({ actif: false, jusquAu: null, tarifs: { mois: 500, an: 5000 } });
    expect(v.jauges).toBeNull();
  });

  it("à un manager, KoppaFoot+ avec ce qu'il lui ouvre, ses jauges, puis « Pas de pubs »", () => {
    const v = vueDuCompte(offre({ casquettes: { manager: true, organisateur: false, gerant: false } }), PRIX);
    expect(v.titre).toBe("KoppaFoot+");
    expect(v.plus?.avantages).toEqual([
      "Club multi-équipes : réunis tes équipes sous un même club, avec sa page et son encadrement",
      "Équipes illimitées",
      "Aucune publicité",
    ]);
    expect(v.jauges).toEqual([{ libelle: "Équipes que tu gères", usage: 1, max: 2, illimite: false }]);
    expect(v.sansPub).not.toBeNull();
  });

  it("KoppaFoot+ en cours : son échéance, les plafonds levés, et plus de « Pas de pubs » à part", () => {
    const v = vueDuCompte(offre({
      estPro: true,
      pro: { actif: true, jusquAu: "2026-12-31" },
      casquettes: { manager: false, organisateur: true, gerant: false },
      leve: { equipes: false, terrains: false, competitions: true, equipesParCompetition: true },
      usage: { equipes: 0, terrains: 0, competitions: 3 },
    }), PRIX);
    expect(v.plus).toMatchObject({ actif: true, jusquAu: "2026-12-31", horsProfil: false });
    expect(v.sansPub).toBeNull();
    expect(v.jauges).toEqual([
      { libelle: "Compétitions en cours", usage: 3, max: 1, illimite: true },
      { libelle: "Équipes par compétition", usage: null, max: 16, illimite: true },
    ]);
  });

  it("« Pas de pubs » en cours, avec son échéance", () => {
    const v = vueDuCompte(offre({ sansPub: { actif: true, jusquAu: "2026-11-30" } }), PRIX);
    expect(v.sansPub).toMatchObject({ actif: true, jusquAu: "2026-11-30" });
  });
});
