import type { User } from "firebase/auth";
import { couvrirAmical, repondreALaDemande } from "~/lib/casquette-api";
import { API_URL } from "~/lib/config";

// Le contrat des deux routes du site : la méthode, l'adresse, le jeton, le
// corps ; et le message d'erreur de la route, montré tel quel.

const compte = { getIdToken: async () => "jeton" } as unknown as User;
const reponse = (ok: boolean, corps: unknown = {}) => ({ ok, json: async () => corps }) as Response;

let appels: [string, RequestInit][] = [];
beforeEach(() => {
  appels = [];
  globalThis.fetch = jest.fn(async (url: string, init: RequestInit) => {
    appels.push([url, init]);
    return reponse(true);
  }) as unknown as typeof fetch;
});

describe("couvrirAmical", () => {
  it("prend le match par la route du scoreur, avec le jeton du compte", async () => {
    await couvrirAmical(compte, "m 1");
    const [url, init] = appels[0];
    expect(url).toBe(`${API_URL}/api/matches/m%201/couvrir`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jeton");
  });

  it("rend le refus de la route tel qu'elle l'écrit", async () => {
    globalThis.fetch = jest.fn(async () => reponse(false, { error: "Ce match a déjà un scoreur." })) as unknown as typeof fetch;
    await expect(couvrirAmical(compte, "m1")).rejects.toThrow("Ce match a déjà un scoreur.");
  });
});

describe("repondreALaDemande", () => {
  it("envoie le geste du propriétaire à la route de la réservation", async () => {
    await repondreALaDemande(compte, "r1", "refuser");
    const [url, init] = appels[0];
    expect(url).toBe(`${API_URL}/api/bookings/r1`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ action: "refuser" });
  });

  it("dit quelque chose même quand la route ne dit rien", async () => {
    globalThis.fetch = jest.fn(async () => ({ ok: false, json: async () => { throw new Error("pas du JSON"); } })) as unknown as typeof fetch;
    await expect(repondreALaDemande(compte, "r1", "confirmer")).rejects.toThrow("La réponse n'a pas été enregistrée.");
  });
});
