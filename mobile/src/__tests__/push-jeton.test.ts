// Le mock d'abord : babel-jest remonte jest.mock au-dessus des imports, et sa
// fabrique s'exécute dès l'import d'AsyncStorage — le mock doit déjà être chargé.
import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { reposerLeJeton, suivreLeJeton } from "~/lib/push";

// Le jeton de ce téléphone à l'ouverture de l'application (mobile/src/lib/push).
// L'interrupteur du Compte lit une trace locale : si le compte a perdu le jeton,
// il reste allumé sur un téléphone qui ne sonne plus. L'ouverture répare ça.

/** La clé de la trace : elle vit sur les téléphones, elle ne se renomme pas. */
const TRACE = "koppafoot:push-token";

let mockPermission = { granted: true, canAskAgain: true };
let mockJeton = "j1";
const mockUpdateDoc = jest.fn(async (_compte: string, _champs: unknown) => {});

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);
jest.mock("expo-notifications", () => ({
  setNotificationHandler: () => {},
  getPermissionsAsync: async () => mockPermission,
  getDevicePushTokenAsync: async () => ({ type: "android", data: mockJeton }),
  addPushTokenListener: () => ({ remove: () => {} }),
}));
jest.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...chemin: string[]) => chemin.join("/"),
  updateDoc: (compte: string, champs: unknown) => mockUpdateDoc(compte, champs),
  arrayUnion: (jeton: string) => ({ ajoute: jeton }),
  arrayRemove: (jeton: string) => ({ retire: jeton }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("~/lib/firebase", () => ({ db: {} }));
jest.mock("~/lib/fiche-firestore", () => ({ cidDuSlug: jest.fn() }));
jest.mock("~/lib/navigateur", () => ({ ouvrirSurLeSite: jest.fn() }));

beforeEach(async () => {
  await AsyncStorage.clear();
  mockUpdateDoc.mockClear();
  mockPermission = { granted: true, canAskAgain: true };
  mockJeton = "j1";
  jest.replaceProperty(Platform, "OS", "android");
});

afterEach(() => jest.restoreAllMocks());

describe("reposerLeJeton", () => {
  it("redépose le jeton : le serveur a pu le retirer du compte", async () => {
    await AsyncStorage.setItem(TRACE, "j1");
    await reposerLeJeton("u1");
    expect(mockUpdateDoc.mock.calls).toEqual([["users/u1", { fcm_tokens: { ajoute: "j1" } }]]);
  });

  it("remplace un jeton qui a changé pendant que l'application était fermée", async () => {
    await AsyncStorage.setItem(TRACE, "ancien");
    mockJeton = "neuf";
    await reposerLeJeton("u1");
    expect(mockUpdateDoc.mock.calls).toEqual([
      ["users/u1", { fcm_tokens: { retire: "ancien" } }],
      ["users/u1", { fcm_tokens: { ajoute: "neuf" } }],
    ]);
    expect(await AsyncStorage.getItem(TRACE)).toBe("neuf");
  });

  it("n'inscrit pas un téléphone qui n'a pas choisi les notifications", async () => {
    await reposerLeJeton("u1");
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("n'inscrit pas un téléphone qui a retiré la permission", async () => {
    await AsyncStorage.setItem(TRACE, "j1");
    mockPermission = { granted: false, canAskAgain: false };
    await reposerLeJeton("u1");
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("ne fait rien sur un iPhone : son jeton natif n'est pas un jeton FCM", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    await AsyncStorage.setItem(TRACE, "j1");
    await reposerLeJeton("u1");
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

describe("suivreLeJeton", () => {
  it("redépose le jeton dès que le compte est connu", async () => {
    await AsyncStorage.setItem(TRACE, "j1");
    const arreter = suivreLeJeton("u1");
    await new Promise((fin) => setTimeout(fin, 0));
    arreter();
    expect(mockUpdateDoc).toHaveBeenCalledWith("users/u1", { fcm_tokens: { ajoute: "j1" } });
  });
});
