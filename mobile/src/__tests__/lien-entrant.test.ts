import { ecouterLesLiens, lienRetenu, oublierLeLien, retenirLeLien } from "~/lib/lien-entrant";
import { redirectSystemPath } from "~/app/+native-intent";

// Un lien du site touché ailleurs (WhatsApp, un e-mail) lance l'application. Le
// routeur ne connaît pas ces adresses : on les retient, et l'écran s'ouvre quand
// la navigation est prête (voir _layout).

beforeEach(() => oublierLeLien());

describe("redirectSystemPath", () => {
  it("retient un lien du site au lancement, et ouvre le Direct en dessous", () => {
    const route = redirectSystemPath({ path: "https://www.koppafoot.com/c/g2/matches/m1?via=partage", initial: true });
    expect(route).toBe("/");
    expect(lienRetenu()).toBe("/c/g2/matches/m1?via=partage");
  });

  it("ne bouscule pas la navigation quand l'application était déjà ouverte", () => {
    const route = redirectSystemPath({ path: "https://www.koppafoot.com/teams/club1", initial: false });
    expect(route).toBeNull();
    expect(lienRetenu()).toBe("/teams/club1");
  });

  it("laisse passer tout le reste : le lancement ordinaire, le client de développement", () => {
    for (const path of ["koppafoot:///", "exp+koppafoot://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"]) {
      expect(redirectSystemPath({ path, initial: true })).toBe(path);
    }
    expect(lienRetenu()).toBeNull();
  });
});

describe("le lien retenu", () => {
  it("prévient à chaque lien, même le même touché deux fois", () => {
    const prevenu = jest.fn();
    const arreter = ecouterLesLiens(prevenu);
    retenirLeLien("/teams/club1");
    oublierLeLien();
    retenirLeLien("/teams/club1");
    arreter();
    retenirLeLien("/teams/club2");
    expect(prevenu).toHaveBeenCalledTimes(3);
  });
});
