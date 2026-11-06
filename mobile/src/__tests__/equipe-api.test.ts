/**
 * @jest-environment node
 */
import type { User } from "firebase/auth";
import { API_URL } from "~/lib/config";
import { chercherJoueurs, creerEquipe, notifierActiviteEquipe, retirerPhotoFantome } from "~/lib/equipe-api";

// Les routes du site que l'écran du club appelle avec le jeton du compte :
// l'adresse, la méthode, le corps, et le message d'erreur de la route, montré
// tel quel.

jest.mock("~/lib/firebase", () => ({ db: {} }));

const compte = { uid: "m", getIdToken: async () => "jeton" } as unknown as User;
const reponse = (ok: boolean, corps: unknown = {}) => ({ ok, json: async () => corps }) as Response;
const entete = (init: RequestInit) => (init.headers as Record<string, string>).Authorization;

let appels: [string, RequestInit][] = [];
let suivante: Response;
beforeEach(() => {
  appels = [];
  suivante = reponse(true);
  globalThis.fetch = jest.fn(async (url: string, init: RequestInit) => {
    appels.push([url, init]);
    return suivante;
  }) as unknown as typeof fetch;
});

const CHAMPS = { name: "FC Koppa", city: "Lomé", level: "amateur", category: "men" as const, color: "emerald", description: "", maxMembers: 14 };

describe("creerEquipe", () => {
  it("crée l'équipe par la route du site et rend son identifiant", async () => {
    suivante = reponse(true, { id: "t9" });
    await expect(creerEquipe(compte, CHAMPS)).resolves.toBe("t9");
    const [url, init] = appels[0];
    expect(url).toBe(`${API_URL}/api/teams`);
    expect(init.method).toBe("POST");
    expect(entete(init)).toBe("Bearer jeton");
    expect(JSON.parse(init.body as string)).toEqual(CHAMPS);
  });

  it("rend le refus de la route tel qu'elle l'écrit", async () => {
    suivante = reponse(false, { error: "L'offre gratuite gère une équipe. Passe à KoppaFoot+ pour en gérer plus." });
    await expect(creerEquipe(compte, CHAMPS)).rejects.toThrow("L'offre gratuite gère une équipe. Passe à KoppaFoot+ pour en gérer plus.");
  });

  it("dit quelque chose même quand la route ne dit rien", async () => {
    suivante = { ok: false, json: async () => { throw new Error("pas du JSON"); } } as unknown as Response;
    await expect(creerEquipe(compte, CHAMPS)).rejects.toThrow("La création de l'équipe a échoué.");
  });
});

describe("chercherJoueurs", () => {
  it("cherche parmi les joueurs, avec le texte, la ville et le jeton", async () => {
    suivante = reponse(true, {
      membres: [
        { uid: "p", first_name: "Pita", last_name: "Kossi", profile_picture_url: "https://x/p.jpg", location_city: "Lomé", position: "forward", skill_level: "amateur" },
        { uid: "q" },
      ],
    });
    const trouves = await chercherJoueurs(compte, { texte: " pita ", ville: "Lomé" });
    const [url, init] = appels[0];
    const u = new URL(url);
    expect(`${u.origin}${u.pathname}`).toBe(`${API_URL}/api/membres/recherche`);
    expect(u.searchParams.get("role")).toBe("joueur");
    expect(u.searchParams.get("texte")).toBe("pita");
    expect(u.searchParams.get("ville")).toBe("Lomé");
    expect(entete(init)).toBe("Bearer jeton");
    expect(trouves).toEqual([
      { uid: "p", prenom: "Pita", nom: "Kossi", photo: "https://x/p.jpg", ville: "Lomé", poste: "forward", niveau: "amateur" },
      { uid: "q", prenom: "", nom: "", photo: null, ville: "", poste: "", niveau: "" },
    ]);
  });

  it("n'envoie pas les filtres vides", async () => {
    suivante = reponse(true, { membres: [] });
    await chercherJoueurs(compte, { texte: "  ", ville: "" });
    const u = new URL(appels[0][0]);
    expect([...u.searchParams.keys()]).toEqual(["role"]);
  });

  it("lève quand la route refuse", async () => {
    suivante = reponse(false, { error: "Non autorisé" });
    await expect(chercherJoueurs(compte, {})).rejects.toThrow("Non autorisé");
  });
});

describe("notifierActiviteEquipe", () => {
  it("annonce le mouvement à la route de l'équipe, sans attendre", async () => {
    notifierActiviteEquipe(compte, { teamId: "t1", event: "member_left", playerId: "a" });
    await new Promise((r) => setTimeout(r, 0));
    const [url, init] = appels[0];
    expect(url).toBe(`${API_URL}/api/notifications/team-activity`);
    expect(entete(init)).toBe("Bearer jeton");
    expect(JSON.parse(init.body as string)).toEqual({ teamId: "t1", event: "member_left", playerId: "a" });
  });

  it("avale un échec : la notification est un bonus", async () => {
    globalThis.fetch = jest.fn(async () => { throw new Error("hors ligne"); }) as unknown as typeof fetch;
    expect(() => notifierActiviteEquipe(compte, { teamId: "t1", event: "member_joined", playerId: "p" })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe("retirerPhotoFantome", () => {
  it("demande au serveur de retirer la photo du joueur sans compte", async () => {
    await retirerPhotoFantome(compte, "t 1", "g1");
    const [url, init] = appels[0];
    expect(url).toBe(`${API_URL}/api/teams/t%201/ghost-players/g1/photo`);
    expect(init.method).toBe("DELETE");
    expect(entete(init)).toBe("Bearer jeton");
  });

  it("rend le refus de la route", async () => {
    suivante = reponse(false, { error: "Accès refusé" });
    await expect(retirerPhotoFantome(compte, "t1", "g1")).rejects.toThrow("Accès refusé");
  });
});
