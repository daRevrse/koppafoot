import { TextInput } from "react-native";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { ChoixDuRole } from "~/components/evolution/ChoixDuRole";
import { prendreLeRoleVise, retenirLeRoleVise } from "~/lib/pile-des-roles";

// L'onglet Évolution d'un compte sans rôle : une pile de cartes qu'on
// feuillette (joueur, manager, arbitre), et la carte qui se retourne sur le
// formulaire d'activation. L'équipe nommée par un manager est créée après
// l'activation et avant la relecture du profil, qui ouvre l'onglet Manager.

const appels: string[] = [];
const mockActiver = jest.fn(async (..._a: unknown[]) => {
  appels.push("activer");
});
const mockCreer = jest.fn(async (..._a: unknown[]) => {
  appels.push("creer");
  return "t9";
});
const mockRafraichir = jest.fn(async () => {
  appels.push("rafraichir");
});
const mockPush = jest.fn();
let mockConnecte = true;
let mockReduit = false;

jest.mock("~/lib/direct-firestore", () => ({ activerLeRole: (...a: unknown[]) => mockActiver(...a) }));
jest.mock("~/lib/equipe-api", () => ({ creerEquipe: (...a: unknown[]) => mockCreer(...a) }));
jest.mock("~/lib/equipe-firestore", () => ({ equipesQueJeGere: async () => [] }));
jest.mock("~/lib/confirmer", () => ({ prevenir: () => {} }));
jest.mock("~/lib/retour", () => ({ retourImpact: () => {}, retourSelection: () => {} }));
jest.mock("~/hooks/useMouvementReduit", () => ({ useMouvementReduit: () => mockReduit }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a) }) }));
jest.mock("~/lib/auth", () => ({
  useAuth: () => ({
    utilisateur: mockConnecte ? { uid: "u1" } : null,
    profil: mockConnecte ? { gender: "female", locationCity: "Lomé" } : null,
    rafraichirProfil: () => mockRafraichir(),
  }),
}));

const texte = (n: ReactTestInstance | string): string =>
  typeof n === "string" ? n : n.children.map((c) => texte(c as ReactTestInstance | string)).join("");

/** Vrai quand un ancêtre retire ce nœud de l'accessibilité : la face cachée, une carte voisine. */
function cache(n: ReactTestInstance): boolean {
  for (let p: ReactTestInstance | null = n; p; p = p.parent) {
    if (p.props.accessibilityElementsHidden === true) return true;
  }
  return false;
}

/** L'affiche de la carte de devant, la seule qu'un lecteur d'écran voie. */
function carteDeDevant(r: ReactTestRenderer): string {
  const vues = r.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Affiche du rôle") && !cache(n));
  const libelles = [...new Set(vues.map((n) => n.props.accessibilityLabel as string))];
  expect(libelles).toHaveLength(1);
  return libelles[0];
}

/** Un élément touchable, visible, par son libellé d'accessibilité ou son texte. */
function touchable(r: ReactTestRenderer, libelle: string): ReactTestInstance | undefined {
  return r.root.findAll((n) => typeof n.props.onPress === "function" && !cache(n)
    && (n.props.accessibilityLabel === libelle || texte(n).includes(libelle)))[0];
}

async function toucher(r: ReactTestRenderer, libelle: string) {
  const cible = touchable(r, libelle);
  if (!cible) throw new Error(`rien à toucher : ${libelle}`);
  await act(async () => {
    cible.props.onPress();
  });
}

/** Le temps qu'une carte vienne devant : les flèches sont ignorées pendant. */
const attendreLAnimation = () => act(async () => {
  await new Promise((fin) => setTimeout(fin, 350));
});

function monter() {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<ChoixDuRole />);
  });
  return r;
}

beforeEach(() => {
  appels.length = 0;
  jest.clearAllMocks();
  mockConnecte = true;
  mockReduit = false;
  prendreLeRoleVise();
});

describe("la pile des rôles", () => {
  it("s'ouvre sur le joueur, et les flèches tournent", async () => {
    const r = monter();
    expect(carteDeDevant(r)).toBe("Affiche du rôle joueur");
    await toucher(r, "Rôle suivant");
    expect(carteDeDevant(r)).toBe("Affiche du rôle manager");
    await attendreLAnimation();
    await toucher(r, "Rôle précédent");
    await attendreLAnimation();
    await toucher(r, "Rôle précédent");
    expect(carteDeDevant(r)).toBe("Affiche du rôle arbitre");
  });

  it("ignore une flèche touchée pendant que la carte vient devant", async () => {
    // Le pilote natif simulé finit une animation au bout de 16 ms : les
    // horloges figées la tiennent en cours le temps du second toucher.
    jest.useFakeTimers();
    try {
      const r = monter();
      await toucher(r, "Rôle suivant");
      await toucher(r, "Rôle suivant");
      expect(carteDeDevant(r)).toBe("Affiche du rôle manager");
      act(() => {
        jest.advanceTimersByTime(400);
      });
      await toucher(r, "Rôle suivant");
      expect(carteDeDevant(r)).toBe("Affiche du rôle arbitre");
    } finally {
      jest.useRealTimers();
    }
  });

  it("ne se retourne pas pendant qu'une carte glissée sort, au lieu de laisser une carte vide", async () => {
    // Le pilote natif simulé finit une animation en 16 ms : horloges figées.
    jest.useFakeTimers();
    try {
      const r = monter();
      const carte = r.root.findAll((n) => typeof n.props.onResponderRelease === "function")[0];
      act(() => {
        carte.props.onStartShouldSetResponder({ nativeEvent: { pageX: 200, pageY: 300 } });
        carte.props.onResponderRelease({ nativeEvent: { pageX: 80, pageY: 302 } });
      });
      await toucher(r, "Devenir joueuse");
      act(() => {
        jest.advanceTimersByTime(800);
      });
      expect(carteDeDevant(r)).toBe("Affiche du rôle manager");
      expect(touchable(r, "Devenir manager")).toBeDefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it("se feuillette au lecteur d'écran : « augmenter » fait comme la flèche suivante", async () => {
    const r = monter();
    const pile = r.root.findAll((n) => n.props.accessibilityRole === "adjustable" && typeof n.props.onAccessibilityAction === "function")[0];
    await act(async () => {
      pile.props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } });
    });
    expect(carteDeDevant(r)).toBe("Affiche du rôle manager");
  });

  it("change de carte d'un coup quand le téléphone demande moins de mouvement", async () => {
    mockReduit = true;
    const r = monter();
    await toucher(r, "Rôle suivant");
    await toucher(r, "Rôle suivant");
    expect(carteDeDevant(r)).toBe("Affiche du rôle arbitre");
  });

  it("se rouvre sur le rôle visé avant la connexion", () => {
    retenirLeRoleVise("referee");
    const r = monter();
    expect(carteDeDevant(r)).toBe("Affiche du rôle arbitre");
  });
});

describe("devenir manager", () => {
  async function surLeManager() {
    const r = monter();
    await toucher(r, "Rôle suivant");
    await attendreLAnimation();
    return r;
  }

  it("retourne la carte sur son formulaire, et « Retour » la remet à l'endroit", async () => {
    const r = await surLeManager();
    expect(touchable(r, "ACTIVER MON ESPACE MANAGER")).toBeUndefined();
    await toucher(r, "Devenir manager");
    expect(touchable(r, "ACTIVER MON ESPACE MANAGER")).toBeDefined();
    expect(touchable(r, "Devenir manager")).toBeUndefined();
    await toucher(r, "Retour");
    expect(touchable(r, "ACTIVER MON ESPACE MANAGER")).toBeUndefined();
    expect(touchable(r, "Devenir manager")).toBeDefined();
  });

  it("sans compte, mène à la connexion et retient le rôle", async () => {
    mockConnecte = false;
    const r = await surLeManager();
    await toucher(r, "Devenir manager");
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/connexion", params: { raison: "role" } });
    expect(prendreLeRoleVise()).toBe("manager");
  });

  it("active le rôle puis crée l'équipe nommée, avant de relire le profil", async () => {
    const r = await surLeManager();
    await toucher(r, "Devenir manager");
    const champ = r.root.find((n) => n.type === TextInput && n.props.accessibilityLabel === "Nom de ton équipe (facultatif)");
    act(() => champ.props.onChangeText("FC Étoile"));
    await toucher(r, "ACTIVER MON ESPACE MANAGER");
    await act(async () => {
      await new Promise((fin) => setTimeout(fin, 0));
    });
    expect(mockActiver).toHaveBeenCalledWith("u1", expect.objectContaining({ evolution_role: "manager", team_name: "FC Étoile" }));
    expect(appels).toEqual(["activer", "creer", "rafraichir"]);
  });
});
