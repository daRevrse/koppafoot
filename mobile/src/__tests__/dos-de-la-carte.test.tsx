import { Text, TextInput } from "react-native";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { CarteDuRole } from "~/components/evolution/CarteDuRole";
import { DosDeLaCarte } from "~/components/evolution/DosDeLaCarte";

// Le dos de la carte du rôle : le formulaire d'activation d'aujourd'hui, sorti
// de ChoixDuRole sans changer de comportement. L'équipe nommée par un manager
// est créée après l'activation et avant la relecture du profil (c'est la
// relecture qui ouvre l'onglet Manager).

const appels: string[] = [];
const mockActiver = jest.fn(async (..._a: unknown[]) => {
  appels.push("activer");
});
const mockCreer = jest.fn(async (..._a: unknown[]) => {
  appels.push("creer");
  return "t9";
});
const mockEquipes = jest.fn(async (..._a: unknown[]) => [] as { name: string }[]);
const mockRafraichir = jest.fn(async () => {
  appels.push("rafraichir");
});
const mockPrevenir = jest.fn();

jest.mock("~/lib/direct-firestore", () => ({ activerLeRole: (...a: unknown[]) => mockActiver(...a) }));
jest.mock("~/lib/equipe-api", () => ({ creerEquipe: (...a: unknown[]) => mockCreer(...a) }));
jest.mock("~/lib/equipe-firestore", () => ({ equipesQueJeGere: (...a: unknown[]) => mockEquipes(...a) }));
jest.mock("~/lib/confirmer", () => ({ prevenir: (...a: unknown[]) => mockPrevenir(...a) }));
jest.mock("~/lib/retour", () => ({ retourImpact: () => {}, retourSelection: () => {} }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: () => {} }) }));
jest.mock("~/lib/auth", () => ({
  useAuth: () => ({
    utilisateur: { uid: "u1" },
    profil: { gender: "female", locationCity: "Lomé" },
    rafraichirProfil: () => mockRafraichir(),
  }),
}));

const texte = (n: ReactTestInstance | string): string =>
  typeof n === "string" ? n : n.children.map((c) => texte(c as ReactTestInstance | string)).join("");

const pressable = (r: ReactTestRenderer, libelle: string) =>
  r.root.findAll((n) => typeof n.props.onPress === "function" && texte(n).includes(libelle))[0];

async function toucher(r: ReactTestRenderer, libelle: string) {
  const cible = pressable(r, libelle);
  await act(async () => {
    cible.props.onPress();
  });
}

function saisir(r: ReactTestRenderer, etiquette: string, valeur: string) {
  const champ = r.root.find((n) => n.type === TextInput && n.props.accessibilityLabel === etiquette);
  act(() => champ.props.onChangeText(valeur));
}

const attendre = () => act(async () => {
  await new Promise((fin) => setTimeout(fin, 0));
});

function monter(onRetour = () => {}) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<DosDeLaCarte role="manager" onRetour={onRetour} />);
  });
  return r;
}

async function activerManager(equipe: string, ville?: string) {
  const r = monter();
  if (equipe) saisir(r, "Nom de ton équipe (facultatif)", equipe);
  if (ville !== undefined) saisir(r, "Ta ville", ville);
  await toucher(r, "ACTIVER MON ESPACE MANAGER");
  await attendre();
  return r;
}

beforeEach(() => {
  appels.length = 0;
  jest.clearAllMocks();
  mockEquipes.mockResolvedValue([]);
});

describe("le dos de la carte, pour un manager", () => {
  it("montre le formulaire du rôle", () => {
    const r = monter();
    expect(texte(r.root)).toContain("TON PROFIL DE MANAGER");
    expect(texte(r.root)).toContain("Tout se modifie plus tard dans ton profil.");
  });

  it("crée l'équipe nommée, après l'activation et avant de relire le profil", async () => {
    await activerManager("FC Étoile");
    expect(mockActiver).toHaveBeenCalledWith("u1", expect.objectContaining({ evolution_role: "manager", team_name: "FC Étoile" }));
    expect(mockCreer).toHaveBeenCalledWith(
      { uid: "u1" },
      { name: "FC Étoile", city: "Lomé", level: "amateur", category: "women", color: "emerald", description: "", maxMembers: 14 },
    );
    expect(appels).toEqual(["activer", "creer", "rafraichir"]);
  });

  it("ne crée rien sans nom d'équipe", async () => {
    await activerManager("");
    expect(mockCreer).not.toHaveBeenCalled();
    expect(appels).toEqual(["activer", "rafraichir"]);
  });

  it("ne refait pas une équipe qu'on gère déjà", async () => {
    mockEquipes.mockResolvedValue([{ name: "FC Étoile" }]);
    await activerManager("FC Étoile");
    expect(mockCreer).not.toHaveBeenCalled();
  });

  it("demande la ville avant d'activer, au lieu d'activer à moitié", async () => {
    const r = await activerManager("FC Étoile", "");
    expect(mockActiver).not.toHaveBeenCalled();
    expect(texte(r.root)).toContain("Ta ville est nécessaire pour créer ton équipe.");
  });

  it("garde le rôle activé et le dit quand l'équipe ne se crée pas", async () => {
    mockCreer.mockRejectedValueOnce(new Error("Tu gères déjà 2 équipes, le maximum de l'offre gratuite. KoppaFoot+ lève cette limite."));
    await activerManager("FC Étoile");
    expect(mockPrevenir).toHaveBeenCalledWith("Ton rôle est activé, pas ton équipe", expect.stringContaining("Tu gères déjà 2 équipes"));
    expect(appels).toEqual(["activer", "rafraichir"]);
  });

  it("n'active qu'une fois quand on touche deux fois « Activer »", async () => {
    const r = monter();
    const bouton = pressable(r, "ACTIVER MON ESPACE MANAGER");
    await act(async () => {
      bouton.props.onPress();
      bouton.props.onPress();
    });
    await attendre();
    expect(mockActiver).toHaveBeenCalledTimes(1);
  });

  it("« Retour » remet la carte à l'endroit", async () => {
    const onRetour = jest.fn();
    const r = monter(onRetour);
    await toucher(r, "Retour");
    expect(onRetour).toHaveBeenCalledTimes(1);
  });
});

describe("la carte retournée", () => {
  it("cache l'affiche aux lecteurs d'écran", () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<CarteDuRole role="manager" retournee mouvementReduit dos={<Text>le dos</Text>} />);
    });
    const affiche = r.root.find((n) => n.props.accessibilityLabel === "Affiche du rôle manager");
    let cachee = false;
    for (let n: ReactTestInstance | null = affiche; n; n = n.parent) {
      if (n.props.accessibilityElementsHidden === true && n.props.importantForAccessibility === "no-hide-descendants") cachee = true;
    }
    expect(cachee).toBe(true);
  });
});
