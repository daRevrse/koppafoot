import { act, create } from "react-test-renderer";
import { usePolicesPretes } from "~/lib/polices";

// L'écran de lancement attend les polices (voir _layout). Une police qui ne charge
// pas ne doit pas l'y laisser pour toujours : l'application s'ouvre sans elle.

let mockChargement: [boolean, Error | null] = [false, null];

jest.mock("@expo-google-fonts/outfit", () => ({
  useFonts: () => mockChargement,
  Outfit_700Bold: 1,
  Outfit_900Black: 2,
}));
jest.mock("@expo-google-fonts/dm-sans", () => ({
  DMSans_400Regular: 3,
  DMSans_500Medium: 4,
  DMSans_600SemiBold: 5,
  DMSans_700Bold: 6,
  DMSans_900Black: 7,
}));

function lire(): boolean {
  let pretes = false;
  function Sonde() {
    pretes = usePolicesPretes();
    return null;
  }
  act(() => {
    create(<Sonde />);
  });
  return pretes;
}

describe("usePolicesPretes", () => {
  it("attend tant que les polices se chargent", () => {
    mockChargement = [false, null];
    expect(lire()).toBe(false);
  });

  it("est prêt une fois les polices chargées", () => {
    mockChargement = [true, null];
    expect(lire()).toBe(true);
  });

  it("ne bloque pas l'application quand une police ne charge pas", () => {
    mockChargement = [false, new Error("ERR_DOWNLOAD")];
    expect(lire()).toBe(true);
  });
});
