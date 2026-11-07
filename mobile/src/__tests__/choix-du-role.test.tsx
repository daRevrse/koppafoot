import { TextInput } from "react-native";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { ChoixDuRole } from "~/components/evolution/ChoixDuRole";

// Activer le rôle manager avec un nom d'équipe crée l'équipe : avant, le nom
// n'allait que dans `team_name` du profil, et l'onglet Manager disait « Tu ne
// diriges pas encore d'équipe ». L'équipe doit exister AVANT que le profil soit
// relu, puisque c'est la relecture qui ouvre l'onglet.

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
jest.mock("~/lib/retour", () => ({ retourImpact: () => {} }));
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

/** Touche l'élément pressable qui contient ce texte. */
async function toucher(r: ReactTestRenderer, libelle: string) {
  const cible = r.root.findAll((n) => typeof n.props.onPress === "function" && texte(n).includes(libelle))[0];
  await act(async () => {
    cible.props.onPress();
  });
}

function saisir(r: ReactTestRenderer, etiquette: string, valeur: string) {
  const champ = r.root.find((n) => n.type === TextInput && n.props.accessibilityLabel === etiquette);
  act(() => champ.props.onChangeText(valeur));
}

async function activerManager(equipe: string, ville?: string) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<ChoixDuRole />);
  });
  await toucher(r, "MANAGER");
  if (equipe) saisir(r, "Nom de ton équipe (facultatif)", equipe);
  if (ville !== undefined) saisir(r, "Ta ville", ville);
  await toucher(r, "ACTIVER MON ESPACE MANAGER");
  await act(async () => {
    await new Promise((fin) => setTimeout(fin, 0));
  });
  return r;
}

beforeEach(() => {
  appels.length = 0;
  jest.clearAllMocks();
  mockEquipes.mockResolvedValue([]);
});

describe("activer le rôle manager", () => {
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
    expect(mockPrevenir).toHaveBeenCalledWith(
      "Ton rôle est activé, pas ton équipe",
      expect.stringContaining("Tu gères déjà 2 équipes"),
    );
    expect(appels).toEqual(["activer", "rafraichir"]);
  });
});
