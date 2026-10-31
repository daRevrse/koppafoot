// Le mock d'abord : babel-jest remonte jest.mock au-dessus des imports, et sa
// fabrique s'exécute dès l'import d'AsyncStorage — le mock doit déjà être chargé.
import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CompetitionFeed } from "@/lib/direct-shared";
import { garderDirect, lireDirectGarde, VALIDITE_DU_DIRECT_GARDE } from "~/lib/direct-garde";

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

const BOARD = [{ competition: { id: "c1" }, matches: [] }] as unknown as CompetitionFeed[];
const CLE = "koppafoot:direct";

beforeEach(() => AsyncStorage.clear());

describe("le dernier tableau, gardé sur le téléphone", () => {
  it("se relit tel qu'il a été reçu, avec son heure", async () => {
    await garderDirect(BOARD, 1000);
    expect(await lireDirectGarde(2000)).toEqual({ board: BOARD, majA: 1000 });
  });

  it("n'existe pas au tout premier lancement", async () => {
    expect(await lireDirectGarde()).toBeNull();
  });

  it("ne sert plus au-delà de sa validité : il ne raconterait plus aujourd'hui", async () => {
    await garderDirect(BOARD, 1000);
    expect(await lireDirectGarde(1000 + VALIDITE_DU_DIRECT_GARDE)).not.toBeNull();
    expect(await lireDirectGarde(1000 + VALIDITE_DU_DIRECT_GARDE + 1)).toBeNull();
  });

  it("ignore un contenu illisible sans lever", async () => {
    await AsyncStorage.setItem(CLE, "{pas du json");
    expect(await lireDirectGarde()).toBeNull();
    await AsyncStorage.setItem(CLE, JSON.stringify({ board: "non", majA: 1 }));
    expect(await lireDirectGarde()).toBeNull();
  });

  it("n'échoue pas si le téléphone refuse d'écrire : un tableau pas gardé n'empêche rien", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("plein"));
    await expect(garderDirect(BOARD, 1000)).resolves.toBeUndefined();
  });
});
