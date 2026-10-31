// Le football mondial du Direct (src/lib/world-board) quand football-data.org ne
// répond pas. Le plan gratuit limite à dix requêtes par minute : un 429 pendant la
// régénération de la page mettait en cache un tableau sans le monde, sur le site comme
// dans l'application, et l'écran disait « Aucun match ce jour-là ».

type Groupe = { competition: { id: string; name: string }; matches: { id: string; status: string }[] };

// Ce que fait le vrai unstable_cache (next/dist/server/web/spec-extension/unstable-cache.js) :
// un calcul réussi remplace le résultat gardé ; un calcul qui lève laisse le résultat
// gardé en place ; sans résultat gardé, l'erreur remonte. Un essai de bout en bout sur
// le vrai Next est dans la description de la PR.
const mockGarde: { valeur?: string } = {};

jest.mock("next/cache", () => ({
  unstable_cache: (calcul: () => Promise<unknown>) => async () => {
    try {
      mockGarde.valeur = JSON.stringify(await calcul());
    } catch (erreur) {
      if (mockGarde.valeur === undefined) throw erreur;
    }
    return JSON.parse(mockGarde.valeur as string);
  },
}));

// `require`, et non `import` : le module tire next/cache, dont la vérification de
// types de l'application mobile n'a pas les types.
const { getWorldBoard } = require("@/lib/world-board") as { getWorldBoard: () => Promise<Groupe[]> };
const { getFeaturedCompetitions } = require("@/lib/football-data") as {
  getFeaturedCompetitions: () => Promise<{ code: string }[]>;
};

const reseau = jest.fn();

const reponse = (status: number, corps: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => corps,
});

const matchs = (...ids: number[]) => ({
  matches: ids.map((id) => ({
    id,
    utcDate: "2026-10-31T15:00:00Z",
    status: "FINISHED",
    competition: { name: "Premier League", code: "PL", emblem: null },
    homeTeam: { name: "Chelsea", crest: null },
    awayTeam: { name: "Man United", crest: null },
    score: { fullTime: { home: 2, away: 0 } },
  })),
});

const idsDesMatchs = (board: Groupe[]) => board.flatMap((g) => g.matches.map((m) => m.id));

const JETON = process.env.FOOTBALL_DATA_TOKEN;

beforeEach(() => {
  delete mockGarde.valeur;
  reseau.mockReset();
  globalThis.fetch = reseau as unknown as typeof fetch;
  process.env.FOOTBALL_DATA_TOKEN = "jeton-d-essai";
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  if (JETON === undefined) delete process.env.FOOTBALL_DATA_TOKEN;
  else process.env.FOOTBALL_DATA_TOKEN = JETON;
});

describe("getWorldBoard", () => {
  it("groupe les matchs reçus par compétition", async () => {
    reseau.mockResolvedValue(reponse(200, matchs(1, 2)));
    const board = await getWorldBoard();
    expect(board.map((g) => g.competition.name)).toEqual(["Premier League"]);
    expect(idsDesMatchs(board)).toEqual(["1", "2"]);
  });

  it.each([
    ["un quota dépassé", () => Promise.resolve(reponse(429, { message: "You reached your request limit." }))],
    ["une panne du fournisseur", () => Promise.resolve(reponse(500, {}))],
    ["un réseau coupé", () => Promise.reject(new Error("fetch failed"))],
  ])("garde le dernier tableau sur %s", async (_cas, panne) => {
    reseau.mockResolvedValueOnce(reponse(200, matchs(1, 2)));
    await getWorldBoard();
    reseau.mockImplementationOnce(panne);
    expect(idsDesMatchs(await getWorldBoard())).toEqual(["1", "2"]);
  });

  it("garde le dernier tableau si le jeton disparaît", async () => {
    reseau.mockResolvedValueOnce(reponse(200, matchs(1)));
    await getWorldBoard();
    delete process.env.FOOTBALL_DATA_TOKEN;
    expect(idsDesMatchs(await getWorldBoard())).toEqual(["1"]);
  });

  it("repart du fournisseur dès qu'il répond de nouveau", async () => {
    reseau.mockResolvedValueOnce(reponse(200, matchs(1)));
    await getWorldBoard();
    reseau.mockResolvedValueOnce(reponse(429, {}));
    await getWorldBoard();
    reseau.mockResolvedValueOnce(reponse(200, matchs(7)));
    expect(idsDesMatchs(await getWorldBoard())).toEqual(["7"]);
  });

  it("vide le tableau quand le fournisseur dit qu'il n'y a pas de match : ce n'est pas une panne", async () => {
    reseau.mockResolvedValueOnce(reponse(200, matchs(1)));
    await getWorldBoard();
    reseau.mockResolvedValueOnce(reponse(200, matchs()));
    expect(await getWorldBoard()).toEqual([]);
  });

  it("donne un monde vide sans lever quand il n'a encore rien de gardé", async () => {
    reseau.mockResolvedValue(reponse(429, {}));
    await expect(getWorldBoard()).resolves.toEqual([]);
  });

  it("donne un monde vide sans jeton, ce qui ne doit pas casser la construction du site", async () => {
    delete process.env.FOOTBALL_DATA_TOKEN;
    await expect(getWorldBoard()).resolves.toEqual([]);
    expect(reseau).not.toHaveBeenCalled();
  });

  it("ne montre plus un tableau trop vieux : ses matchs « en direct » seraient finis depuis longtemps", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-31T15:00:00Z") });
    reseau.mockResolvedValueOnce(reponse(200, matchs(1)));
    await getWorldBoard();
    reseau.mockResolvedValue(reponse(429, {}));

    jest.setSystemTime(new Date("2026-10-31T17:59:00Z"));
    expect(idsDesMatchs(await getWorldBoard())).toEqual(["1"]);

    jest.setSystemTime(new Date("2026-10-31T18:01:00Z"));
    expect(await getWorldBoard()).toEqual([]);
  });
});

describe("les autres lectures de football-data", () => {
  it("continuent de dégrader en liste vide, sans lever", async () => {
    reseau.mockResolvedValue(reponse(429, {}));
    await expect(getFeaturedCompetitions()).resolves.toEqual([]);
  });

  it("continuent de rendre ce que le fournisseur donne", async () => {
    reseau.mockResolvedValue(reponse(200, { competitions: [{ id: 1, code: "PL", name: "Premier League" }] }));
    expect((await getFeaturedCompetitions()).map((c) => c.code)).toEqual(["PL"]);
  });
});
