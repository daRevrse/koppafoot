import { toTeam } from "@/lib/equipe-mappers";
import type { FirestoreTeam, GhostPlayer, Invitation, JoinRequest } from "@/types";
import {
  aDesChangements, basculerTitulaire, brouillonDe, candidaturesParEtat, changerDossard, erreursEquipe, erreursFantome,
  invitationsEnAttente, lignesParPoste, nettoyerDossard, type IdentiteMembre,
} from "~/lib/mon-club";

// La logique de l'écran Mon club, sans écran : comment l'effectif se range,
// ce que le bouton Enregistrer enregistre, et ce que les formulaires refusent.

const equipe = (d: Partial<FirestoreTeam> = {}) =>
  toTeam("t1", {
    name: "FC Koppa", manager_id: "m", city: "Lomé", description: "", level: "amateur", max_members: 20, color: "emerald",
    member_ids: ["a", "b", "c"], squad_numbers: { m: "1", a: "9" }, lineup_ids: ["a"],
    staff: [{ uid: "b", name: "Bébé", title: "Adjoint", delegated: true }], staff_manager_ids: ["b"],
    ...d,
  } as FirestoreTeam);

const fantome = (g: Partial<GhostPlayer>): GhostPlayer => ({
  id: "g1", teamId: "t1", firstName: "Kodjo", lastName: "Mensah", position: "defender", squadNumber: undefined,
  goals: 0, assists: 0, matchesPlayed: 0, condition: null, photoUrl: null, photoConsentement: null,
  createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-01T10:00:00.000Z", ...g,
}) as GhostPlayer;

const identites = new Map<string, IdentiteMembre>([
  ["m", { nom: "Mo Manager", photo: null, poste: null }],
  ["a", { nom: "Ama Attaque", photo: "https://x/a.jpg", poste: "forward" }],
  ["b", { nom: "Bébé But", photo: null, poste: "goalkeeper" }],
]);

describe("nettoyerDossard", () => {
  it("ne garde que trois chiffres", () => {
    expect(nettoyerDossard("1a23x4")).toBe("123");
    expect(nettoyerDossard(" 7 ")).toBe("7");
    expect(nettoyerDossard("abc")).toBe("");
  });
});

describe("lignesParPoste", () => {
  it("met le manager en tête, puis les postes du but vers l'attaque, puis les sans-poste", () => {
    const t = equipe();
    const groupes = lignesParPoste(t, identites, [fantome({})], brouillonDe(t), new Map());
    expect(groupes.map((g) => g.titre)).toEqual(["Manager", "Gardiens", "Défenseurs", "Attaquants", "Sans poste"]);
    expect(groupes[0].lignes).toEqual([
      expect.objectContaining({ genre: "compte", id: "m", nom: "Mo Manager", dossard: "1", manager: true }),
    ]);
    expect(groupes[2].lignes).toEqual([
      expect.objectContaining({ genre: "fantome", id: "g1", nom: "Kodjo Mensah", poste: "defender", titulaire: false }),
    ]);
    expect(groupes[3].lignes).toEqual([
      expect.objectContaining({ genre: "compte", id: "a", nom: "Ama Attaque", photo: "https://x/a.jpg", dossard: "9", titulaire: true, manager: false }),
    ]);
  });

  it("un membre sans identité prend le nom de secours, sinon « Joueur », et va dans « Sans poste »", () => {
    const t = equipe({ member_ids: ["c", "d"] });
    const groupes = lignesParPoste(t, identites, [], brouillonDe(t), new Map([["c", "Céline Candidate"]]));
    const sansPoste = groupes.find((g) => g.titre === "Sans poste");
    expect(sansPoste?.poste).toBeNull();
    expect(sansPoste?.lignes.map((l) => l.nom)).toEqual(["Céline Candidate", "Joueur"]);
  });

  it("ne liste pas deux fois un manager qui est aussi dans l'effectif", () => {
    const t = equipe({ member_ids: ["m", "a"] });
    const lignes = lignesParPoste(t, identites, [], brouillonDe(t), new Map()).flatMap((g) => g.lignes);
    expect(lignes.filter((l) => l.id === "m")).toHaveLength(1);
  });

  it("dit qui est du staff, et quel numéro d'un joueur sans compte un compte porte déjà", () => {
    const t = equipe();
    const lignes = lignesParPoste(t, identites, [fantome({ squadNumber: "9" }), fantome({ id: "g2", squadNumber: "5" })], brouillonDe(t), new Map())
      .flatMap((g) => g.lignes);
    expect(lignes.find((l) => l.id === "b")?.staff).toBe(true);
    expect(lignes.find((l) => l.id === "a")?.staff).toBe(false);
    expect(lignes.find((l) => l.id === "g1")).toMatchObject({ dossard: "9", dossardPris: true });
    expect(lignes.find((l) => l.id === "g2")).toMatchObject({ dossard: "5", dossardPris: false });
  });

  it("lit le brouillon, pas l'équipe : ce que le manager tape se voit avant d'enregistrer", () => {
    const t = equipe();
    const b = basculerTitulaire(changerDossard(brouillonDe(t), "a", "10"), "a");
    const a = lignesParPoste(t, identites, [], b, new Map()).flatMap((g) => g.lignes).find((l) => l.id === "a");
    expect(a).toMatchObject({ dossard: "10", titulaire: false });
  });

  it("range par nom dans un même poste", () => {
    const t = equipe({ member_ids: [] });
    const groupes = lignesParPoste(t, identites, [fantome({ id: "g2", firstName: "Zak" }), fantome({ id: "g3", firstName: "Abdou" })], brouillonDe(t), new Map());
    expect(groupes.find((g) => g.titre === "Défenseurs")?.lignes.map((l) => l.id)).toEqual(["g3", "g2"]);
  });
});

describe("le brouillon de l'effectif", () => {
  it("part de l'équipe telle qu'elle est enregistrée", () => {
    expect(brouillonDe(equipe())).toEqual({ dossards: { m: "1", a: "9" }, titulaires: ["a"] });
  });

  it("aDesChangements : faux au départ, vrai après une bascule, faux une fois rebasculé", () => {
    const t = equipe();
    const b0 = brouillonDe(t);
    expect(aDesChangements(t, b0)).toBe(false);
    const b1 = basculerTitulaire(b0, "c");
    expect(b1.titulaires).toEqual(["a", "c"]);
    expect(aDesChangements(t, b1)).toBe(true);
    expect(aDesChangements(t, basculerTitulaire(b1, "c"))).toBe(false);
  });

  it("aDesChangements : l'ordre des titulaires ne compte pas", () => {
    const t = equipe({ lineup_ids: ["a", "c"] });
    expect(aDesChangements(t, basculerTitulaire(basculerTitulaire(brouillonDe(t), "a"), "a"))).toBe(false);
  });

  it("aDesChangements : un dossard vidé qui n'existait pas n'est pas un changement", () => {
    const t = equipe();
    expect(aDesChangements(t, changerDossard(brouillonDe(t), "c", ""))).toBe(false);
    expect(aDesChangements(t, changerDossard(brouillonDe(t), "c", "4"))).toBe(true);
    expect(aDesChangements(t, changerDossard(brouillonDe(t), "a", "9x"))).toBe(false);
  });
});

const demande = (id: string, status: JoinRequest["status"], createdAt: unknown): JoinRequest => ({
  id, playerId: `p-${id}`, playerName: id, playerPhoto: null, teamLogo: null, playerCity: "Lomé", playerPosition: "forward",
  playerLevel: "amateur", teamId: "t1", teamName: "FC Koppa", managerId: "m", message: "", status,
  createdAt: createdAt as string, updatedAt: "",
});

describe("candidaturesParEtat", () => {
  it("sépare les demandes en attente, les plus récentes d'abord, des réponses passées", () => {
    const { enAttente, passees } = candidaturesParEtat([
      demande("ancienne", "pending", "2026-10-01T10:00:00.000Z"),
      demande("refusee", "rejected", "2026-10-05T10:00:00.000Z"),
      // Le document porte un horodatage Firestore, pas une chaine (toJoinRequest le laisse tel quel).
      demande("recente", "pending", { seconds: Date.parse("2026-11-01T10:00:00.000Z") / 1000, nanoseconds: 0 }),
      demande("acceptee", "accepted", "2026-10-20T10:00:00.000Z"),
    ]);
    expect(enAttente.map((d) => d.id)).toEqual(["recente", "ancienne"]);
    expect(passees.map((d) => d.id)).toEqual(["acceptee", "refusee"]);
  });
});

const invitation = (id: string, teamId: string, status: Invitation["status"], createdAt: string) =>
  ({ id, teamId, status, createdAt }) as Invitation;

describe("invitationsEnAttente", () => {
  it("garde celles de l'équipe qui attendent une réponse, les plus récentes d'abord", () => {
    const liste = invitationsEnAttente([
      invitation("i1", "t1", "pending", "2026-10-01T10:00:00.000Z"),
      invitation("i2", "t2", "pending", "2026-10-02T10:00:00.000Z"),
      invitation("i3", "t1", "accepted", "2026-10-03T10:00:00.000Z"),
      invitation("i4", "t1", "pending", "2026-10-04T10:00:00.000Z"),
    ], "t1");
    expect(liste.map((i) => i.id)).toEqual(["i4", "i1"]);
  });
});

describe("erreursFantome", () => {
  it("demande un prénom et un nom, de 40 caractères au plus", () => {
    expect(erreursFantome({ prenom: " ", nom: "", poste: "forward", dossard: "" })).toEqual({
      prenom: "Le prénom est requis.", nom: "Le nom est requis.",
    });
    expect(erreursFantome({ prenom: "a".repeat(41), nom: "Mensah", poste: "forward", dossard: "" })).toEqual({
      prenom: "40 caractères au plus.",
    });
    expect(erreursFantome({ prenom: "Kodjo", nom: "Mensah", poste: "forward", dossard: "5" })).toEqual({});
  });
});

describe("erreursEquipe", () => {
  const champs = { name: "FC Koppa", city: "Lomé", level: "amateur", category: "men" as const, color: "emerald", description: "", maxMembers: 14 };

  it("demande un nom et une ville, de 80 caractères au plus", () => {
    expect(erreursEquipe({ ...champs, name: "", city: "  " })).toEqual({ name: "Le nom est requis.", city: "La ville est requise." });
    expect(erreursEquipe({ ...champs, city: "x".repeat(81) })).toEqual({ city: "80 caractères au plus." });
    expect(erreursEquipe(champs)).toEqual({});
  });

  it("garde le nombre de joueurs entre 5 et 25, comme le site", () => {
    expect(erreursEquipe({ ...champs, maxMembers: 4 })).toEqual({ maxMembers: "Entre 5 et 25 joueurs." });
    expect(erreursEquipe({ ...champs, maxMembers: 26 })).toEqual({ maxMembers: "Entre 5 et 25 joueurs." });
  });
});
