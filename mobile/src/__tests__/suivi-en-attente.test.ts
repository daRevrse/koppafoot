import {
  appliquerSuiviEnAttente, mettreEnAttente, oublierEnAttente, prendreEnAttente,
} from "~/lib/suivi-en-attente";

const T0 = 1_000_000;

afterEach(() => oublierEnAttente());

it("rend la compétition en attente, une seule fois", () => {
  mettreEnAttente("coupe", T0);
  expect(prendreEnAttente(T0 + 1000)).toBe("coupe");
  expect(prendreEnAttente(T0 + 2000)).toBeNull();
});

it("expire après dix minutes", () => {
  mettreEnAttente("coupe", T0);
  expect(prendreEnAttente(T0 + 10 * 60_000 + 1)).toBeNull();
});

it("appliquerSuiviEnAttente suit la compétition une fois connecté", async () => {
  const suivre = jest.fn().mockResolvedValue(undefined);
  mettreEnAttente("coupe", T0);
  await expect(appliquerSuiviEnAttente("uid-1", suivre, T0 + 5000)).resolves.toBe(true);
  expect(suivre).toHaveBeenCalledWith("uid-1", "coupe", true);
});

it("appliquerSuiviEnAttente sans rien en attente ne fait rien", async () => {
  const suivre = jest.fn();
  await expect(appliquerSuiviEnAttente("uid-1", suivre, T0)).resolves.toBe(false);
  expect(suivre).not.toHaveBeenCalled();
});
