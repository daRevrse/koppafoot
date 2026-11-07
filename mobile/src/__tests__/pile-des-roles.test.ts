import { contraste } from "@/lib/couleurs-equipe";
import {
  apresGlisse, estUnGlisseHorizontal, indexInitial, PRESENTATION, prendreLeRoleVise, retenirLeRoleVise, voisins,
} from "~/lib/pile-des-roles";
import { ROLES } from "~/lib/roles";
import { palettes } from "~/theme";

// La pile des rôles de l'onglet Évolution : l'ordre qui tourne, le glissé
// qui change de carte, le rôle visé qui survit à la connexion, et des
// couleurs de rôle lisibles sur les deux thèmes.

describe("voisins", () => {
  it("tourne : le premier a le dernier pour précédent, le dernier le premier pour suivant", () => {
    expect(voisins(0, 3)).toEqual({ precedent: 2, suivant: 1 });
    expect(voisins(2, 3)).toEqual({ precedent: 1, suivant: 0 });
  });
});

describe("le glissé", () => {
  it("passe au suivant vers la gauche, au précédent vers la droite, et reste sous le seuil", () => {
    expect(apresGlisse(0, -60, 3)).toBe(1);
    expect(apresGlisse(0, 60, 3)).toBe(2);
    expect(apresGlisse(1, 30, 3)).toBe(1);
  });

  it("ne prend la main que sur un geste horizontal franc : faire défiler ne change pas de rôle", () => {
    expect(estUnGlisseHorizontal(40, 10)).toBe(true);
    expect(estUnGlisseHorizontal(10, 40)).toBe(false);
    expect(estUnGlisseHorizontal(6, 0)).toBe(false);
  });
});

describe("le rôle visé", () => {
  it("est rendu une fois, puis oublié", () => {
    retenirLeRoleVise("manager");
    expect(prendreLeRoleVise()).toBe("manager");
    expect(prendreLeRoleVise()).toBeNull();
  });

  it("ouvre la pile sur sa carte, la première sinon", () => {
    expect(indexInitial("referee")).toBe(2);
    expect(indexInitial(null)).toBe(0);
  });
});

describe("la présentation des rôles", () => {
  const ACCROCHES = { player: "Tu joues, on tient le compte", manager: "Tu tiens l'effectif", referee: "Tu tiens le sifflet" };

  it.each(ROLES.map((r) => r.role))("%s : son accroche, et des couleurs lisibles sur les deux thèmes", (role) => {
    const p = PRESENTATION[role];
    expect(p.accroche).toBe(ACCROCHES[role]);
    expect(contraste(p.couleurs.accentClair, palettes.clair.fond)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(p.couleurs.accentSombre, palettes.sombre.fond)).toBeGreaterThanOrEqual(4.5);
    expect(contraste("#FFFFFF", p.couleurs.bouton)).toBeGreaterThanOrEqual(4.5);
  });
});
