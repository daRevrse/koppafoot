// Le mock d'abord : babel-jest remonte jest.mock au-dessus des imports, et sa
// fabrique s'exécute dès l'import d'AsyncStorage — le mock doit déjà être chargé.
import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import { act, create } from "react-test-renderer";
import { ApparenceProvider, preferenceLue, schemaAffiche, useApparence } from "~/lib/apparence";
import { palettes, useCouleurs, type Couleurs } from "~/theme";

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

// Le réglage du téléphone, et de quoi le faire basculer.
let telephone: "light" | "dark" = "dark";
const abonnes = new Set<() => void>();
function basculerLeTelephone(t: "light" | "dark") {
  telephone = t;
  abonnes.forEach((f) => f());
}

beforeEach(() => {
  telephone = "dark";
  abonnes.clear();
  jest.spyOn(Appearance, "getColorScheme").mockImplementation(() => telephone);
  jest.spyOn(Appearance, "addChangeListener").mockImplementation((f) => {
    const prevenir = () => f({ colorScheme: telephone });
    abonnes.add(prevenir);
    return { remove: () => abonnes.delete(prevenir) } as ReturnType<typeof Appearance.addChangeListener>;
  });
});

beforeEach(() => AsyncStorage.clear());

describe("preferenceLue", () => {
  it("garde un choix explicite", () => {
    expect(preferenceLue("clair")).toBe("clair");
    expect(preferenceLue("sombre")).toBe("sombre");
  });

  it("rien, ou autre chose (la valeur du site, « light »), suit le téléphone", () => {
    expect(preferenceLue(null)).toBe("systeme");
    expect(preferenceLue("light")).toBe("systeme");
  });
});

describe("schemaAffiche", () => {
  it("le choix l'emporte sur le téléphone", () => {
    expect(schemaAffiche("clair", "dark")).toBe("clair");
    expect(schemaAffiche("sombre", "light")).toBe("sombre");
  });

  it("sans choix, le réglage du téléphone", () => {
    expect(schemaAffiche("systeme", "light")).toBe("clair");
    expect(schemaAffiche("systeme", "dark")).toBe("sombre");
  });

  it("un téléphone qui ne dit rien garde le sombre de toujours", () => {
    expect(schemaAffiche("systeme", null)).toBe("sombre");
    expect(schemaAffiche("systeme", "unspecified")).toBe("sombre");
  });
});

describe("ApparenceProvider", () => {
  let etat: ReturnType<typeof useApparence>;
  let palette: Couleurs;
  function Sonde() {
    etat = useApparence();
    palette = useCouleurs();
    return null;
  }

  async function monter() {
    await act(async () => {
      create(
        <ApparenceProvider>
          <Sonde />
        </ApparenceProvider>,
      );
    });
  }

  it("reprend le choix gardé sur le téléphone, et sa palette", async () => {
    await AsyncStorage.setItem("kf:theme", "clair");
    await monter();
    expect(etat).toMatchObject({ pret: true, preference: "clair", schema: "clair" });
    expect(palette).toBe(palettes.clair);
  });

  it("sans choix, suit le téléphone, et en direct quand il bascule", async () => {
    telephone = "light";
    await monter();
    expect(etat).toMatchObject({ preference: "systeme", schema: "clair" });

    act(() => basculerLeTelephone("dark"));
    expect(etat.schema).toBe("sombre");
    expect(palette).toBe(palettes.sombre);
  });

  it("un choix tient quand le téléphone bascule", async () => {
    await AsyncStorage.setItem("kf:theme", "clair");
    await monter();
    act(() => basculerLeTelephone("dark"));
    expect(etat.schema).toBe("clair");
  });

  it("garde un choix, et l'oublie pour revenir au téléphone", async () => {
    await monter();
    expect(etat).toMatchObject({ preference: "systeme", schema: "sombre" });

    await act(async () => etat.choisir("clair"));
    expect(palette).toBe(palettes.clair);
    await expect(AsyncStorage.getItem("kf:theme")).resolves.toBe("clair");

    await act(async () => etat.choisir("systeme"));
    expect(etat.schema).toBe("sombre");
    await expect(AsyncStorage.getItem("kf:theme")).resolves.toBeNull();
  });

  it("une lecture qui échoue suit le téléphone plutôt que de rester sur l'écran de lancement", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disque"));
    await monter();
    expect(etat).toMatchObject({ pret: true, preference: "systeme" });
  });
});
