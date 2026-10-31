import { FlatList } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { FriseDesJours } from "~/components/direct/FriseDesJours";

// « Aujourd'hui » doit arriver au centre de la frise. Centrer avant la mesure de la
// liste donnait un mauvais décalage (elle ne connaît pas encore sa largeur), et
// l'animation lancée à ce moment-là pouvait écraser le bon recentrage qui suivait :
// vu sur Android, « aujourd'hui » coupé au bord gauche de l'écran.

const JOURS = ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"];

let centrages: jest.SpyInstance;

function frise(jour: string) {
  return (
    <FriseDesJours jours={JOURS} jour={jour} aujourdhui="2026-10-31" avecMatchs={new Set()} actif onChange={() => {}} />
  );
}

function rendre(jour = "2026-10-31"): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(frise(jour));
  });
  return r;
}

const mesurer = (r: ReactTestRenderer) =>
  act(() => r.root.findByType(FlatList).props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 411, height: 70 } } }));

beforeEach(() => {
  centrages = jest.spyOn(FlatList.prototype, "scrollToIndex").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("FriseDesJours", () => {
  it("ne centre rien tant que la liste n'est pas mesurée", () => {
    rendre();
    expect(centrages).not.toHaveBeenCalled();
  });

  it("centre le jour choisi d'un coup, dès la mesure", () => {
    const r = rendre();
    mesurer(r);
    expect(centrages).toHaveBeenCalledTimes(1);
    expect(centrages).toHaveBeenCalledWith({ index: 2, viewPosition: 0.5, animated: false });
  });

  it("anime ensuite vers le jour qu'on choisit", () => {
    const r = rendre();
    mesurer(r);
    centrages.mockClear();
    act(() => r.update(frise("2026-11-01")));
    expect(centrages).toHaveBeenCalledTimes(1);
    expect(centrages).toHaveBeenCalledWith({ index: 3, viewPosition: 0.5, animated: true });
  });
});
