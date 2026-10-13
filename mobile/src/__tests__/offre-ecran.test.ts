import { ecranOffre } from "@/lib/offre-ecran";
import type { FormuleEnVente } from "@/lib/paiement";

// Le module vit côté site (src/lib/offre-ecran) ; il est pur, et c'est ici
// que la suite de tests des modules partagés tourne. Il décide ce que la page
// de l'offre montre : la page elle-même ne fait que le dessiner.

const AUCUN = { manager: false, organisateur: false, gerant: false };
const MANAGER = { ...AUCUN, manager: true };
const PLUS_MOIS: FormuleEnVente = { id: "pro_mois", droit: "pro", mois: 1, prix: 500 };
const PLUS_AN: FormuleEnVente = { id: "pro_an", droit: "pro", mois: 12, prix: 5000 };
const SANS_PUB_MOIS: FormuleEnVente = { id: "sans_pub_mois", droit: "sans_pub", mois: 1, prix: 200 };

const ecran = (p: Partial<Parameters<typeof ecranOffre>[0]> = {}) =>
  ecranOffre({ titres: AUCUN, plusActif: false, sansPubActif: false, formules: [], ...p });

describe("ecranOffre : un compte qui ne gère rien", () => {
  it("ne voit que « Pas de pubs » : ni KoppaFoot+, ni plafonds, ni club", () => {
    expect(ecran({ formules: [SANS_PUB_MOIS] })).toEqual({
      titre: "sans_pub",
      plus: null,
      jauges: false,
      club: false,
      sansPub: { etat: "a_vendre", formules: [SANS_PUB_MOIS] },
    });
  });

  it("tant que « Pas de pubs » n'a pas de prix, la page le dit : pas en vente, aucune formule", () => {
    expect(ecran().sansPub).toEqual({ etat: "pas_en_vente", formules: [] });
  });

  it("« Pas de pubs » en cours : son état, et de quoi le prolonger", () => {
    expect(ecran({ sansPubActif: true, formules: [SANS_PUB_MOIS] }).sansPub).toEqual({ etat: "actif", formules: [SANS_PUB_MOIS] });
  });

  it("« Pas de pubs » sans échéance : son état, rien à vendre", () => {
    expect(ecran({ sansPubActif: true }).sansPub).toEqual({ etat: "actif", formules: [] });
  });

  it("avec un KoppaFoot+ d'avant la règle : son état et rien d'autre, tant qu'il court", () => {
    expect(ecran({ plusActif: true })).toEqual({
      titre: "sans_pub",
      plus: { etat: "actif", formules: [], horsProfil: true },
      jauges: false,
      club: false,
      sansPub: null,
    });
  });
});

describe("ecranOffre : un compte qui gère", () => {
  it("voit KoppaFoot+ d'abord, ses plafonds, puis « Pas de pubs »", () => {
    expect(ecran({ titres: MANAGER, formules: [PLUS_MOIS, PLUS_AN, SANS_PUB_MOIS] })).toEqual({
      titre: "pro",
      plus: { etat: "a_vendre", formules: [PLUS_MOIS, PLUS_AN], horsProfil: false },
      jauges: true,
      club: false,
      sansPub: { etat: "a_vendre", formules: [SANS_PUB_MOIS] },
    });
  });

  it("KoppaFoot+ sans prix : il se présente, sans rien à acheter", () => {
    expect(ecran({ titres: MANAGER, formules: [SANS_PUB_MOIS] }).plus).toEqual({ etat: "pas_en_vente", formules: [], horsProfil: false });
  });

  it("KoppaFoot+ actif : il se prolonge, et « Pas de pubs » disparaît", () => {
    const e = ecran({ titres: MANAGER, plusActif: true, formules: [PLUS_MOIS] });
    expect(e.plus).toEqual({ etat: "actif", formules: [PLUS_MOIS], horsProfil: false });
    expect(e.sansPub).toBeNull();
  });

  it("le club ne se propose qu'à un manager qui a KoppaFoot+", () => {
    expect(ecran({ titres: MANAGER, plusActif: true }).club).toBe(true);
    expect(ecran({ titres: MANAGER }).club).toBe(false);
    expect(ecran({ titres: { ...AUCUN, organisateur: true }, plusActif: true }).club).toBe(false);
    expect(ecran({ titres: { ...AUCUN, gerant: true }, plusActif: true }).club).toBe(false);
  });

  it("un organisateur et un propriétaire ont le titre KOPPAFOOT+ et leurs plafonds", () => {
    for (const titres of [{ ...AUCUN, organisateur: true }, { ...AUCUN, gerant: true }]) {
      expect(ecran({ titres })).toMatchObject({ titre: "pro", jauges: true });
    }
  });
});
