import type { LigneJoueurPubliee } from "@/lib/classement";
import {
  chargerClassement, messageVide, pageDuClassement, PAR_PAGE, triDOuverture,
} from "~/lib/classement-joueurs";

/** Une ligne publiée : classée à la note au rang `n`, aux buts et passes au rang `n` aussi. */
const ligne = (n: number, p: Partial<LigneJoueurPubliee> = {}): LigneJoueurPubliee => ({
  cle: `uid:u${n}`, nom: `Joueur ${n}`, uid: `u${n}`, gardien: false, equipe: null,
  matchs: 5, buts: 0, passes: 0, total: 0, arrets: 0, cleanSheets: 0,
  notes: [7, 7, 7, null, null], note: 7,
  rangNote: n, rangContribution: n, mouvementNote: null, mouvementContribution: null,
  ...p,
});

describe("triDOuverture", () => {
  it("ouvre sur la note dès que quelqu'un y est classé", () => {
    expect(triDOuverture([ligne(1)])).toBe("note");
  });

  it("ouvre sur les buts et passes tant que personne n'a assez de matchs notés", () => {
    expect(triDOuverture([ligne(1, { rangNote: null, note: null })])).toBe("contribution");
  });

  it("garde la note quand le classement est vide", () => {
    expect(triDOuverture([])).toBe("note");
  });
});

describe("pageDuClassement", () => {
  const cent = Array.from({ length: 25 }, (_, i) => ligne(i + 1, { gardien: (i + 1) % 4 === 0 }));

  it("rend dix lignes par page, dans l'ordre du tri", () => {
    const p = pageDuClassement(cent, "note", "tous", 1);
    expect(PAR_PAGE).toBe(10);
    expect(p.lignes.map((l) => l.rangNote)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(p).toMatchObject({ total: 25, page: 1, pages: 3, premier: 11, dernier: 20 });
  });

  it("montre les gardiens entre eux avec leur rang dans la liste commune", () => {
    const p = pageDuClassement(cent, "note", "gardiens", 0);
    expect(p.lignes.map((l) => l.rangNote)).toEqual([4, 8, 12, 16, 20, 24]);
    expect(p.pages).toBe(1);
    expect(pageDuClassement(cent, "note", "joueurs", 0).lignes.every((l) => !l.gardien)).toBe(true);
  });

  it("ramène une page hors bornes sur la dernière plutôt que de vider l'écran", () => {
    const p = pageDuClassement(cent, "note", "tous", 7);
    expect(p.page).toBe(2);
    expect(p.lignes.map((l) => l.rangNote)).toEqual([21, 22, 23, 24, 25]);
    expect(pageDuClassement(cent, "note", "tous", -3).page).toBe(0);
  });

  it("écarte d'un tri ceux qui n'y sont pas classés", () => {
    const lignes = [ligne(1), ligne(2, { rangNote: null }), ligne(3, { rangNote: 2 })];
    expect(pageDuClassement(lignes, "note", "tous", 0).lignes.map((l) => l.cle)).toEqual(["uid:u1", "uid:u3"]);
    expect(pageDuClassement(lignes, "contribution", "tous", 0).total).toBe(3);
  });

  it("compte une page même quand il n'y a personne", () => {
    expect(pageDuClassement([], "note", "tous", 0)).toMatchObject({ lignes: [], total: 0, page: 0, pages: 1 });
  });
});

describe("messageVide", () => {
  it("dit que le classement se remplit quand personne n'y est encore", () => {
    expect(messageVide(0, "note")).toEqual(["Le classement se remplit à la fin de chaque match.", "Personne n'y figure encore."]);
  });

  it("propose l'autre tri ou un autre filtre quand c'est la sélection qui est vide", () => {
    expect(messageVide(12, "note")).toEqual(["Personne ici n'a encore 3 matchs notés.", "Essaie l'autre tri, ou un autre filtre."]);
    expect(messageVide(12, "contribution")[0]).toBe("Personne ici n'a encore marqué ni fait marquer.");
  });
});

describe("chargerClassement", () => {
  const fetchOrigine = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = fetchOrigine;
  });

  it("lit les joueurs de GET /api/rankings", async () => {
    const appels: string[] = [];
    globalThis.fetch = jest.fn(async (url: string) => {
      appels.push(url);
      return { ok: true, json: async () => ({ joueurs: [ligne(1)], matchsRetenus: 4, calculeLe: null }) };
    }) as unknown as typeof fetch;
    const joueurs = await chargerClassement();
    expect(appels[0]).toMatch(/\/api\/rankings$/);
    expect(joueurs.map((l) => l.cle)).toEqual(["uid:u1"]);
  });

  it("lève quand la route répond une erreur", async () => {
    globalThis.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(chargerClassement()).rejects.toThrow("/api/rankings : 500");
  });
});
