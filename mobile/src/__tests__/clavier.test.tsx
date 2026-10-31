import { Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { DefilementClavier } from "~/components/DefilementClavier";
import { margeSousLeClavier, remonteePourLeChamp } from "~/lib/clavier";

// Android ne redimensionne plus l'écran sous le clavier : en affichage bord à bord,
// `adjustResize` ne fait rien. Vu sur Android 16 : le champ qu'on remplit passe
// dessous, et le bouton du formulaire devient inatteignable.

type Ecoute = (e: { endCoordinates: { screenY: number; height: number } }) => void;

const ecoutes: Record<string, Ecoute | undefined> = {};
const scrollTo = ScrollView.prototype.scrollTo as unknown as jest.Mock;

function rendre(props: Record<string, unknown> = {}): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<DefilementClavier {...props}><Text>Le formulaire</Text></DefilementClavier>);
  });
  return r;
}

const cadre = (r: ReactTestRenderer) => r.root.findAllByType(View)[0];
const defilement = (r: ReactTestRenderer) => r.root.findByType(ScrollView);
const marge = (r: ReactTestRenderer) => StyleSheet.flatten(cadre(r).props.style).paddingBottom ?? 0;

/** Le clavier s'ouvre : l'écran finit à `bas`, le clavier commence à `haut`. */
function ouvrir(r: ReactTestRenderer, bas: number, haut: number) {
  (cadre(r).instance.measureInWindow as jest.Mock).mockImplementation(
    (cb: (x: number, y: number, l: number, h: number) => void) => cb(0, 100, 400, bas - 100),
  );
  act(() => ecoutes.keyboardDidShow?.({ endCoordinates: { screenY: haut, height: bas - haut } }));
}

/** Le champ qui a le focus, en position `y`, haut de 50. */
function champEn(y: number) {
  jest.spyOn(TextInput.State, "currentlyFocusedInput").mockReturnValue({
    measureInWindow: (cb: (x: number, y: number, l: number, h: number) => void) => cb(0, y, 400, 50),
  } as never);
}

const ecranReduit = (r: ReactTestRenderer) =>
  act(() => defilement(r).props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 400 } } }));

beforeEach(() => {
  scrollTo.mockClear();
  jest.replaceProperty(Platform, "OS", "android");
  jest.spyOn(Keyboard, "addListener").mockImplementation(((nom: string, f: Ecoute) => {
    ecoutes[nom] = f;
    return { remove: () => { ecoutes[nom] = undefined; } };
  }) as never);
});

afterEach(() => jest.restoreAllMocks());

describe("margeSousLeClavier", () => {
  it("réserve ce que le clavier recouvre de l'écran", () => {
    expect(margeSousLeClavier(800, 500)).toBe(300);
  });

  it("ne réserve rien quand l'écran finit au-dessus du clavier", () => {
    expect(margeSousLeClavier(400, 500)).toBe(0);
  });
});

describe("remonteePourLeChamp", () => {
  it("remonte un champ que le clavier cache, avec un peu d'air", () => {
    expect(remonteePourLeChamp(520, 500)).toBeGreaterThan(20);
  });

  it("ne bouge pas un champ déjà bien visible", () => {
    expect(remonteePourLeChamp(200, 500)).toBe(0);
  });
});

describe("DefilementClavier", () => {
  it("réduit l'écran quand le clavier s'ouvre, et le rend à la fermeture", () => {
    const r = rendre();
    expect(marge(r)).toBe(0);
    ouvrir(r, 800, 500);
    expect(marge(r)).toBe(300);
    act(() => ecoutes.keyboardDidHide?.({ endCoordinates: { screenY: 800, height: 0 } }));
    expect(marge(r)).toBe(0);
  });

  it("amène le champ au-dessus du clavier, une fois l'écran réduit", () => {
    const r = rendre();
    champEn(470);
    act(() => defilement(r).props.onScroll({ nativeEvent: { contentOffset: { y: 100 } } }));
    ouvrir(r, 800, 500);
    // Trop tôt : tant que l'écran n'est pas réduit, il n'a pas de quoi défiler.
    expect(scrollTo).not.toHaveBeenCalled();
    ecranReduit(r);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    const y = scrollTo.mock.calls[0][0].y;
    expect(y).toBe(100 + remonteePourLeChamp(520, 500));
  });

  it("ne fait pas défiler pour un champ déjà visible", () => {
    const r = rendre();
    champEn(150);
    ouvrir(r, 800, 500);
    ecranReduit(r);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("amène le champ même si l'écran n'a pas à se réduire", () => {
    const r = rendre();
    champEn(470);
    ouvrir(r, 450, 500);
    expect(marge(r)).toBe(0);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("laisse passer les réglages de l'écran qui s'en sert", () => {
    const onScroll = jest.fn();
    const onLayout = jest.fn();
    const r = rendre({ onScroll, onLayout, stickyHeaderIndices: [1], scrollEventThrottle: 32 });
    expect(defilement(r).props.stickyHeaderIndices).toEqual([1]);
    expect(defilement(r).props.scrollEventThrottle).toBe(32);
    act(() => defilement(r).props.onScroll({ nativeEvent: { contentOffset: { y: 10 } } }));
    expect(onScroll).toHaveBeenCalledTimes(1);
    ecranReduit(r);
    expect(onLayout).toHaveBeenCalledTimes(1);
  });

  it("n'écoute rien sur iPhone : le système s'en charge", () => {
    jest.replaceProperty(Platform, "OS", "ios");
    rendre();
    expect(Keyboard.addListener).not.toHaveBeenCalled();
  });
});
