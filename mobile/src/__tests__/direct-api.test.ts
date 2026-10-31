import { chargerDirect, DELAI_DU_DIRECT, delaiDuNouvelEssai } from "~/lib/direct-api";

// `fetch` n'a aucun délai maximal : sur un réseau qui rame, le squelette du Direct
// restait affiché indéfiniment, sans message ni bouton.

const reseau = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  reseau.mockReset();
  globalThis.fetch = reseau as unknown as typeof fetch;
});

afterEach(() => jest.useRealTimers());

describe("chargerDirect", () => {
  it("rend le tableau de la route", async () => {
    reseau.mockResolvedValue({ ok: true, json: async () => ({ board: [{ competition: { id: "c1" } }] }) });
    await expect(chargerDirect()).resolves.toEqual([{ competition: { id: "c1" } }]);
  });

  it("abandonne quand le réseau ne répond pas dans le délai", async () => {
    // Le vrai fetch rejette quand on l'interrompt.
    reseau.mockImplementation((_url: string, { signal }: { signal: AbortSignal }) =>
      new Promise((_, rejeter) => signal.addEventListener("abort", () => rejeter(new Error("interrompu")))),
    );
    const attente = chargerDirect();
    const verdict = expect(attente).rejects.toThrow("interrompu");
    await jest.advanceTimersByTimeAsync(DELAI_DU_DIRECT);
    await verdict;
  });

  it("n'interrompt rien une fois la réponse arrivée", async () => {
    let signal!: AbortSignal;
    reseau.mockImplementation(async (_url: string, options: { signal: AbortSignal }) => {
      signal = options.signal;
      return { ok: true, json: async () => ({ board: [] }) };
    });
    await chargerDirect();
    await jest.advanceTimersByTimeAsync(DELAI_DU_DIRECT * 2);
    expect(signal.aborted).toBe(false);
  });
});

describe("delaiDuNouvelEssai", () => {
  it("espace les essais : le forfait compte", () => {
    expect(delaiDuNouvelEssai(1)).toBe(15_000);
    expect(delaiDuNouvelEssai(2)).toBe(30_000);
    expect(delaiDuNouvelEssai(3)).toBe(60_000);
  });

  it("ne dépasse jamais cinq minutes", () => {
    expect(delaiDuNouvelEssai(20)).toBe(300_000);
  });
});
