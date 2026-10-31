// Le mock d'abord : babel-jest remonte jest.mock au-dessus des imports, et sa
// fabrique s'exécute dès l'import d'AsyncStorage — le mock doit déjà être chargé.
import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { CompetitionFeed } from "@/lib/direct-shared";
import { useDirect } from "~/hooks/useDirect";

// Le Direct sur un vrai réseau : il s'ouvre sur le dernier tableau gardé, se répare
// seul quand la connexion revient, et n'empile pas les essais.

const mockCharger = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);
jest.mock("~/hooks/usePremierPlan", () => ({ usePremierPlan: () => true }));
jest.mock("~/lib/direct-firestore", () => ({
  ecouterAmicauxEnCours: () => () => {},
  ecouterMatchsCompetition: () => () => {},
}));
jest.mock("~/lib/direct-api", () => ({
  ...jest.requireActual("~/lib/direct-api"),
  chargerDirect: () => mockCharger(),
}));

const CLE = "koppafoot:direct";
const tableau = (id: string) => [{ competition: { id }, matches: [] }] as unknown as CompetitionFeed[];
const jamais = () => new Promise<never>(() => {});

type Etat = ReturnType<typeof useDirect>;

function Sonde({ surEtat }: { surEtat: (e: Etat) => void }) {
  surEtat(useDirect());
  return null;
}

let etat: Etat;
const retenirEtat = (e: Etat) => {
  etat = e;
};

let rendu: ReactTestRenderer;
async function ouvrir() {
  await act(async () => {
    rendu = create(<Sonde surEtat={retenirEtat} />);
    await jest.advanceTimersByTimeAsync(0);
  });
}

const attendre = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  mockCharger.mockReset();
});

afterEach(() => {
  act(() => rendu?.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("useDirect", () => {
  it("montre le tableau gardé sans attendre le réseau", async () => {
    await AsyncStorage.setItem(CLE, JSON.stringify({ board: tableau("garde"), majA: Date.now() - 3_600_000 }));
    mockCharger.mockImplementation(jamais);
    await ouvrir();
    expect(etat.feed?.[0].competition.id).toBe("garde");
    expect(etat.majA?.getTime()).toBeLessThan(Date.now());
    expect(etat.horsLigne).toBe(false);
  });

  it("ne dit que ça se met à jour que si le réseau tarde : pas de bandeau qui clignote", async () => {
    await AsyncStorage.setItem(CLE, JSON.stringify({ board: tableau("garde"), majA: Date.now() }));
    mockCharger.mockImplementation(jamais);
    await ouvrir();
    expect(etat.miseAJourLente).toBe(false);
    await attendre(5000);
    expect(etat.miseAJourLente).toBe(true);
  });

  it("remplace le tableau gardé par celui du réseau, et garde ce dernier", async () => {
    await AsyncStorage.setItem(CLE, JSON.stringify({ board: tableau("garde"), majA: 1000 }));
    mockCharger.mockResolvedValue(tableau("frais"));
    await ouvrir();
    await attendre(0);
    expect(etat.feed?.[0].competition.id).toBe("frais");
    expect(etat.miseAJourLente).toBe(false);
    const garde = JSON.parse((await AsyncStorage.getItem(CLE)) as string);
    expect(garde.board[0].competition.id).toBe("frais");
    expect(garde.majA).toBeGreaterThan(1000);
  });

  it("n'écrase pas une réponse du réseau par une lecture du téléphone arrivée après", async () => {
    let rendre!: (brut: string) => void;
    jest.spyOn(AsyncStorage, "getItem").mockImplementationOnce(
      () => new Promise<string | null>((r) => { rendre = r as (brut: string) => void; }),
    );
    mockCharger.mockResolvedValue(tableau("frais"));
    await ouvrir();
    expect(etat.feed?.[0].competition.id).toBe("frais");
    await act(async () => {
      rendre(JSON.stringify({ board: tableau("garde"), majA: Date.now() - 1000 }));
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(etat.feed?.[0].competition.id).toBe("frais");
  });

  it("garde le tableau gardé à l'écran quand le réseau manque, et le dit", async () => {
    await AsyncStorage.setItem(CLE, JSON.stringify({ board: tableau("garde"), majA: Date.now() - 1000 }));
    mockCharger.mockRejectedValue(new Error("pas de réseau"));
    await ouvrir();
    expect(etat.feed?.[0].competition.id).toBe("garde");
    expect(etat.horsLigne).toBe(true);
  });

  it("se répare seul quand la connexion revient, sans toucher à l'écran", async () => {
    mockCharger.mockRejectedValueOnce(new Error("pas de réseau"));
    await ouvrir();
    expect(etat.feed).toBeNull();
    expect(etat.horsLigne).toBe(true);
    mockCharger.mockResolvedValue(tableau("frais"));
    await attendre(15_000);
    expect(etat.feed?.[0].competition.id).toBe("frais");
    expect(etat.horsLigne).toBe(false);
  });

  it("espace les essais tant que ça échoue", async () => {
    mockCharger.mockRejectedValue(new Error("pas de réseau"));
    await ouvrir();
    expect(mockCharger).toHaveBeenCalledTimes(1);
    await attendre(15_000);
    expect(mockCharger).toHaveBeenCalledTimes(2);
    await attendre(15_000);
    expect(mockCharger).toHaveBeenCalledTimes(2);
    await attendre(15_000);
    expect(mockCharger).toHaveBeenCalledTimes(3);
  });

  it("n'empile pas un deuxième chargement sur celui en cours", async () => {
    mockCharger.mockImplementation(jamais);
    await ouvrir();
    await act(async () => {
      void etat.rafraichir();
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(mockCharger).toHaveBeenCalledTimes(1);
  });
});
