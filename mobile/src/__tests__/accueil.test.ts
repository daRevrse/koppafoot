// Le mock d'abord : babel-jest remonte jest.mock au-dessus des imports, et sa
// fabrique s'exécute dès l'import d'AsyncStorage — le mock doit déjà être chargé.
import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { accueilDejaVu, marquerAccueilVu } from "~/lib/accueil";

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

beforeEach(() => AsyncStorage.clear());

it("un premier lancement n'a pas vu l'accueil", async () => {
  await expect(accueilDejaVu()).resolves.toBe(false);
});

it("une fois marqué, l'accueil est vu", async () => {
  await marquerAccueilVu();
  await expect(accueilDejaVu()).resolves.toBe(true);
});

it("une lecture qui échoue remontre l'accueil plutôt que de planter", async () => {
  jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disque"));
  await expect(accueilDejaVu()).resolves.toBe(false);
});
