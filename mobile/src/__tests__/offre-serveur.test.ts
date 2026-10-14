import { base, vider } from "../test-aides/faux-firestore";

// L'offre côté serveur (src/lib/offre-server), jouée contre le faux
// Firestore : c'est ici que tient « KoppaFoot+ n'agit que pour ce que le
// compte est ». Avoir le droit ne suffit plus : il faut le titre qui va avec.

type Doc = Record<string, unknown>;
type Limite = { code: string; cle: string; max: number } | null;

jest.mock("next/server", () => ({
  NextResponse: { json: (corps: unknown, init?: { status?: number }) => ({ corps, status: init?.status ?? 200 }) },
}));
jest.mock("@/lib/firebase-admin", () => ({ adminDb: require("../test-aides/faux-firestore").adminDb }));
jest.mock("@/lib/appelant", () => ({ uidAppelant: jest.fn() }));

// `require`, et non `import` : le module tire firebase-admin et next/server,
// dont la vérification de types de l'application mobile n'a pas les types.
const { limiteDeCreation, limiteEquipesDeCompetition, plusLeve, estManager } = require("@/lib/offre-server") as {
  limiteDeCreation: (uid: string, cle: "equipes" | "terrains" | "competitions") => Promise<Limite>;
  limiteEquipesDeCompetition: (cid: string, competition: Doc, ajout?: number) => Promise<Limite>;
  plusLeve: (uid: string, avantage: string, jour?: string) => Promise<boolean>;
  estManager: (uid: string) => Promise<boolean>;
};

const UID = "compte1";
/** Un KoppaFoot+ sans échéance : actif, quel que soit le jour où la suite tourne. */
const PLUS = { pro: { depuis: "2026-01-01", jusqu_au: null, source: "admin", accorde_par: "admin1", motif: null } };

const profil = (p: Doc) => base.set(`users/${UID}`, { first_name: "Ama", ...p });
const equipes = (n: number, manager = UID) => {
  for (let i = 0; i < n; i += 1) base.set(`teams/equipe${manager}${i}`, { name: `Équipe ${i}`, manager_id: manager });
};

beforeEach(() => {
  vider();
  // Les plafonds sont en vigueur depuis longtemps.
  base.set("settings/offre", { limites_depuis: "2026-01-01" });
});

describe("limiteDeCreation : le plafond d'équipes", () => {
  it("tient pour un manager sans KoppaFoot+", async () => {
    profil({ user_type: "manager" });
    equipes(2);
    expect(await limiteDeCreation(UID, "equipes")).toEqual({ code: "limite_offre", cle: "equipes", max: 2 });
  });

  it("laisse créer tant qu'on est sous le plafond", async () => {
    profil({ user_type: "manager" });
    equipes(1);
    expect(await limiteDeCreation(UID, "equipes")).toBeNull();
  });

  it("se lève pour un manager qui a KoppaFoot+", async () => {
    profil({ user_type: "manager" });
    base.set(`droits/${UID}`, PLUS);
    equipes(5);
    expect(await limiteDeCreation(UID, "equipes")).toBeNull();
  });

  it("ne se lève pas pour un joueur organisateur : son KoppaFoot+ ne couvre que ses compétitions", async () => {
    profil({ user_type: "player", is_organizer: true });
    base.set(`droits/${UID}`, PLUS);
    equipes(2);
    expect(await limiteDeCreation(UID, "equipes")).toEqual({ code: "limite_offre", cle: "equipes", max: 2 });
  });

  it("ne se lève pas pour un joueur qui a KoppaFoot+ sans aucun titre", async () => {
    profil({ user_type: "player" });
    base.set(`droits/${UID}`, PLUS);
    equipes(2);
    expect(await limiteDeCreation(UID, "equipes")).not.toBeNull();
  });

  it("ne tient pas avant l'entrée en vigueur des plafonds", async () => {
    base.set("settings/offre", { limites_depuis: "2099-01-01" });
    profil({ user_type: "manager" });
    equipes(9);
    expect(await limiteDeCreation(UID, "equipes")).toBeNull();
  });
});

describe("limiteDeCreation : chaque plafond a son titre", () => {
  const competitions = (n: number) => {
    for (let i = 0; i < n; i += 1) base.set(`competitions/comp${i}`, { created_by: UID, status: "active" });
  };

  it("le plafond de compétitions se lève pour un organisateur, pas pour un manager", async () => {
    base.set(`droits/${UID}`, PLUS);
    competitions(1);

    profil({ user_type: "player", is_organizer: true });
    expect(await limiteDeCreation(UID, "competitions")).toBeNull();

    profil({ user_type: "manager" });
    expect(await limiteDeCreation(UID, "competitions")).toEqual({ code: "limite_offre", cle: "competitions", max: 1 });
  });

  it("le plafond de terrains se lève pour un propriétaire, pas pour un manager", async () => {
    base.set(`droits/${UID}`, PLUS);
    base.set("venues/terrain1", { owner_id: UID });

    profil({ user_type: "user", is_venue_owner: true });
    expect(await limiteDeCreation(UID, "terrains")).toBeNull();

    profil({ user_type: "manager" });
    expect(await limiteDeCreation(UID, "terrains")).toEqual({ code: "limite_offre", cle: "terrains", max: 1 });
  });

  it("les titres se cumulent : un manager propriétaire a les deux", async () => {
    base.set(`droits/${UID}`, PLUS);
    profil({ user_type: "manager", is_venue_owner: true });
    equipes(4);
    base.set("venues/terrain1", { owner_id: UID });

    expect(await limiteDeCreation(UID, "equipes")).toBeNull();
    expect(await limiteDeCreation(UID, "terrains")).toBeNull();
  });
});

describe("limiteEquipesDeCompetition", () => {
  const COMPETITION = { organizer_ids: ["orga1"], created_at: "2026-06-01T10:00:00.000Z" };
  const inscrire = (n: number) => {
    for (let i = 0; i < n; i += 1) base.set(`competitions/coupe/comp_teams/equipe${i}`, { name: `Équipe ${i}` });
  };

  beforeEach(() => {
    base.set("competitions/coupe", COMPETITION);
    inscrire(16);
  });

  it("tient à 16 équipes sans KoppaFoot+", async () => {
    base.set("users/orga1", { is_organizer: true });
    expect(await limiteEquipesDeCompetition("coupe", COMPETITION)).toEqual({ code: "limite_offre", cle: "equipesParCompetition", max: 16 });
  });

  it("se lève quand un organisateur de la compétition a KoppaFoot+", async () => {
    base.set("users/orga1", { is_organizer: true });
    base.set("droits/orga1", PLUS);
    expect(await limiteEquipesDeCompetition("coupe", COMPETITION)).toBeNull();
  });

  it("ne se lève pas par le KoppaFoot+ de quelqu'un qui n'a pas la casquette", async () => {
    base.set("users/orga1", { user_type: "manager" });
    base.set("droits/orga1", PLUS);
    expect(await limiteEquipesDeCompetition("coupe", COMPETITION)).not.toBeNull();
  });

  it("ne compte que les équipes de cette compétition", async () => {
    base.set("users/orga1", { is_organizer: true });
    base.set("competitions/autre", COMPETITION);
    base.set("competitions/autre/comp_teams/x", { name: "X" });
    expect(await limiteEquipesDeCompetition("autre", COMPETITION)).toBeNull();
  });
});

describe("plusLeve : le Club multi-équipes", () => {
  it("s'ouvre à un manager qui a KoppaFoot+", async () => {
    profil({ user_type: "manager" });
    base.set(`droits/${UID}`, PLUS);
    expect(await plusLeve(UID, "club")).toBe(true);
  });

  it("reste fermé à un manager sans KoppaFoot+", async () => {
    profil({ user_type: "manager" });
    expect(await plusLeve(UID, "club")).toBe(false);
  });

  it("reste fermé à un joueur, à un organisateur, à un propriétaire qui ont KoppaFoot+", async () => {
    base.set(`droits/${UID}`, PLUS);
    for (const p of [{ user_type: "player" }, { user_type: "player", is_organizer: true }, { user_type: "user", is_venue_owner: true }]) {
      profil(p);
      expect(await plusLeve(UID, "club")).toBe(false);
    }
  });

  it("se referme quand KoppaFoot+ est terminé", async () => {
    profil({ user_type: "manager" });
    base.set(`droits/${UID}`, { pro: { ...PLUS.pro, jusqu_au: "2026-01-31" } });
    expect(await plusLeve(UID, "club", "2026-02-01")).toBe(false);
    expect(await plusLeve(UID, "club", "2026-01-31")).toBe(true);
  });
});

describe("estManager : qui peut créer une équipe", () => {
  it("un manager, par l'un ou l'autre champ", async () => {
    profil({ user_type: "manager" });
    expect(await estManager(UID)).toBe(true);
    profil({ user_type: "user", evolution_role: "manager" });
    expect(await estManager(UID)).toBe(true);
  });

  it("ni un joueur, ni un arbitre, ni un organisateur", async () => {
    for (const p of [{ user_type: "player" }, { user_type: "referee" }, { user_type: "player", is_organizer: true }]) {
      profil(p);
      expect(await estManager(UID)).toBe(false);
    }
  });

  it("ni un joueur membre du staff d'une équipe, ni un compte qui a une équipe à son nom sans le rôle", async () => {
    profil({ user_type: "player" });
    base.set("teams/equipe1", { manager_id: "quelqu-un-d-autre", staff_manager_ids: [UID] });
    expect(await estManager(UID)).toBe(false);
    equipes(1);
    expect(await estManager(UID)).toBe(false);
  });

  it("ni un compte sans profil", async () => {
    expect(await estManager("fantome")).toBe(false);
  });
});
