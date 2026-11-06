/**
 * @jest-environment node
 */
import type { User } from "firebase/auth";
import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { toJoinRequest, toTeam } from "@/lib/equipe-mappers";
import type { FirestoreJoinRequest, FirestoreTeam, Invitation, JoinRequest, Team } from "@/types";
import { notifierCompte } from "~/lib/equipe-api";
import {
  annulerInvitation, creerFantome, ecouterCandidatures, ecouterInvitationsEnvoyees, enregistrerEffectif,
  equipesQueJeGere, inviterJoueur, lireFantome, modifierFantome, repondreCandidature, retirerMembre, supprimerFantome,
} from "~/lib/equipe-firestore";
import { EMULATEUR, connecterEnAdmin, connecterEnTantQue, fermer, viderLaBase } from "../test-aides/emulateur";

// L'effectif d'un club lu et écrit par l'application, contre l'émulateur et le
// vrai firestore.rules (mobile/outils/emulateurs/LISEZMOI.md) : le manager, son
// délégué (staff_manager_ids) et un inconnu. Ignoré sans émulateur.

let mockDb: Firestore | undefined;
jest.mock("~/lib/firebase", () => ({
  get db() {
    return mockDb;
  },
}));

const suite = EMULATEUR ? describe : describe.skip;

const enTantQue = (uid: string) => {
  mockDb = connecterEnTantQue(uid);
};
const lire = async (chemin: string) => (await getDoc(doc(connecterEnAdmin(), chemin))).data();
const poser = (chemin: string, data: Record<string, unknown>) => setDoc(doc(connecterEnAdmin(), chemin), data);

const EQUIPE = {
  name: "FC Koppa", manager_id: "m", city: "Lomé", description: "", level: "amateur", max_members: 20, color: "emerald",
  member_ids: ["a", "d"], squad_numbers: { a: "9" }, lineup_ids: [],
  staff: [
    { uid: "d", name: "Dédé", title: "Adjoint", delegated: true },
    { uid: "a", name: "Ama", title: "Capitaine", delegated: false },
  ],
  staff_manager_ids: ["d"],
};
const equipe = (): Team => toTeam("t1", EQUIPE as unknown as FirestoreTeam);

const DEMANDE = {
  player_id: "p", player_name: "Pita", player_city: "Lomé", player_position: "forward", player_level: "amateur",
  team_id: "t1", team_name: "FC Koppa", manager_id: "m", message: "", status: "pending",
  created_at: "2026-11-01T10:00:00.000Z", updated_at: "2026-11-01T10:00:00.000Z",
};
const demande = (): JoinRequest => toJoinRequest("j1", DEMANDE as FirestoreJoinRequest);

const JOUEUR = { uid: "p", prenom: "Pita", nom: "Kossi", photo: null, ville: "Lomé", poste: "forward", niveau: "amateur" };

/** La première liste qu'un écouteur rend. */
function premiereListe<T>(ecouter: (cb: (l: T[]) => void, err: (e: Error) => void) => () => void): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const arreter = ecouter(
      (l) => { arreter(); resolve(l); },
      (e) => reject(e),
    );
  });
}

suite("l'effectif d'un club dans Firestore", () => {
  beforeEach(async () => {
    await viderLaBase();
    mockDb = undefined;
    await poser("teams/t1", EQUIPE);
  });

  // Un client neuf par cas : celui d'un compte garde en cache ce qu'il a écrit,
  // et un écouteur le rendrait encore après que la base a été vidée.
  afterEach(fermer);

  describe("equipesQueJeGere", () => {
    beforeEach(async () => {
      await poser("teams/t2", { ...EQUIPE, name: "AS Dédé", manager_id: "d", staff: [], staff_manager_ids: [] });
      await poser("teams/tg", { ...EQUIPE, name: "Adversaire", is_ghost: true, staff: [], staff_manager_ids: [] });
    });

    it("rend les équipes du manager, sans les équipes hors plateforme", async () => {
      enTantQue("m");
      expect((await equipesQueJeGere("m")).map((t) => t.id)).toEqual(["t1"]);
    });

    it("ajoute celles dont on est le délégué", async () => {
      enTantQue("d");
      expect((await equipesQueJeGere("d")).map((t) => t.id).sort()).toEqual(["t1", "t2"]);
    });

    it("ne rend rien à qui ne gère rien", async () => {
      enTantQue("x");
      expect(await equipesQueJeGere("x")).toEqual([]);
    });
  });

  describe("enregistrerEffectif", () => {
    it("écrit les dossards et les titulaires d'un coup", async () => {
      enTantQue("m");
      await enregistrerEffectif("t1", { dossards: { a: "10", d: "4" }, titulaires: ["a"] });
      const t = await lire("teams/t1");
      expect(t?.squad_numbers).toEqual({ a: "10", d: "4" });
      expect(t?.lineup_ids).toEqual(["a"]);
    });

    it("laisse faire le délégué", async () => {
      enTantQue("d");
      await enregistrerEffectif("t1", { dossards: { a: "7" }, titulaires: [] });
      expect((await lire("teams/t1"))?.squad_numbers).toEqual({ a: "7" });
    });

    it("refuse un inconnu", async () => {
      enTantQue("x");
      await expect(enregistrerEffectif("t1", { dossards: {}, titulaires: [] })).rejects.toThrow(/permission/i);
    });
  });

  describe("retirerMembre", () => {
    it("le manager retire un membre, et du staff avec lui", async () => {
      enTantQue("m");
      await retirerMembre(equipe(), "d", "m");
      const t = await lire("teams/t1");
      expect(t?.member_ids).toEqual(["a"]);
      expect(t?.staff.map((s: { uid: string }) => s.uid)).toEqual(["a"]);
      expect(t?.staff_manager_ids).toEqual([]);
    });

    it("un délégué retire un membre du staff : l'effectif change, le staff non, sans erreur", async () => {
      enTantQue("d");
      await expect(retirerMembre(equipe(), "a", "d")).resolves.toBeUndefined();
      const t = await lire("teams/t1");
      expect(t?.member_ids).toEqual(["d"]);
      expect(t?.staff).toHaveLength(2);
    });

    it("refuse un inconnu", async () => {
      enTantQue("x");
      await expect(retirerMembre(equipe(), "a", "x")).rejects.toThrow(/permission/i);
    });
  });

  describe("candidatures", () => {
    beforeEach(() => poser("join_requests/j1", DEMANDE));

    it("accepter ajoute le joueur et passe la demande à accepted", async () => {
      enTantQue("m");
      await repondreCandidature(demande(), true);
      expect((await lire("teams/t1"))?.member_ids).toEqual(["a", "d", "p"]);
      expect((await lire("join_requests/j1"))?.status).toBe("accepted");
    });

    it("refuser passe la demande à rejected sans toucher l'équipe", async () => {
      enTantQue("m");
      await repondreCandidature(demande(), false);
      expect((await lire("teams/t1"))?.member_ids).toEqual(["a", "d"]);
      expect((await lire("join_requests/j1"))?.status).toBe("rejected");
    });

    it("le délégué lit les candidatures de l'équipe et y répond", async () => {
      enTantQue("d");
      const liste = await premiereListe<JoinRequest>((cb, err) => ecouterCandidatures("t1", "m", cb, err));
      expect(liste.map((d) => d.id)).toEqual(["j1"]);
      await repondreCandidature(liste[0], true);
      expect((await lire("teams/t1"))?.member_ids).toContain("p");
    });

    it("refuse un inconnu", async () => {
      enTantQue("x");
      await expect(repondreCandidature(demande(), true)).rejects.toThrow(/permission/i);
    });
  });

  describe("joueurs sans compte", () => {
    it("créer, modifier, supprimer", async () => {
      enTantQue("m");
      const id = await creerFantome("t1", { prenom: " Kodjo ", nom: "Mensah ", poste: "defender", dossard: "5" });
      let g = await lire(`teams/t1/ghost_players/${id}`);
      expect(g).toMatchObject({ first_name: "Kodjo", last_name: "Mensah", position: "defender", squad_number: "5", goals: 0, assists: 0, matches_played: 0 });

      await modifierFantome("t1", id, { prenom: "Kodjo", nom: "Mensah", poste: "midfielder", dossard: "" });
      g = await lire(`teams/t1/ghost_players/${id}`);
      expect(g).toMatchObject({ position: "midfielder", squad_number: null, goals: 0 });

      await supprimerFantome("t1", id);
      expect(await lire(`teams/t1/ghost_players/${id}`)).toBeUndefined();
    });

    it("relit un joueur pour le modifier, et rend null s'il n'existe plus", async () => {
      enTantQue("m");
      const id = await creerFantome("t1", { prenom: "Kodjo", nom: "Mensah", poste: "goalkeeper", dossard: "1" });
      expect(await lireFantome("t1", id)).toMatchObject({ id, teamId: "t1", firstName: "Kodjo", position: "goalkeeper", squadNumber: "1" });
      await supprimerFantome("t1", id);
      expect(await lireFantome("t1", id)).toBeNull();
    });

    it("refuse un inconnu", async () => {
      enTantQue("x");
      await expect(creerFantome("t1", { prenom: "A", nom: "B", poste: "forward", dossard: "" })).rejects.toThrow(/permission/i);
    });
  });

  describe("invitations", () => {
    it("inviter crée un document pending que le joueur lit", async () => {
      enTantQue("m");
      const id = await inviterJoueur({ team: equipe(), expediteur: { uid: "m", nom: "Mo Manager" }, joueur: JOUEUR, message: "Viens" });
      const lu = (await getDoc(doc(connecterEnTantQue("p"), `invitations/${id}`))).data();
      expect(lu).toMatchObject({
        status: "pending", sender_id: "m", sender_name: "Mo Manager", receiver_id: "p", receiver_name: "Pita Kossi",
        receiver_city: "Lomé", receiver_position: "forward", receiver_level: "amateur", team_id: "t1", team_name: "FC Koppa",
        message: "Viens", team_logo: null, receiver_photo: null,
      });
    });

    it("le manager suit ses invitations et en annule une", async () => {
      enTantQue("m");
      const id = await inviterJoueur({ team: equipe(), expediteur: { uid: "m", nom: "Mo" }, joueur: JOUEUR, message: "" });
      const liste = await premiereListe<Invitation>((cb, err) => ecouterInvitationsEnvoyees("m", cb, err));
      expect(liste.map((i) => i.id)).toEqual([id]);
      await annulerInvitation(id);
      expect(await lire(`invitations/${id}`)).toBeUndefined();
    });

    it("refuse un inconnu", async () => {
      enTantQue("m");
      const id = await inviterJoueur({ team: equipe(), expediteur: { uid: "m", nom: "Mo" }, joueur: JOUEUR, message: "" });
      enTantQue("x");
      await expect(annulerInvitation(id)).rejects.toThrow(/permission/i);
      await expect(
        inviterJoueur({ team: equipe(), expediteur: { uid: "m", nom: "Mo" }, joueur: JOUEUR, message: "" }),
      ).rejects.toThrow(/permission/i);
    });
  });

  describe("notifierCompte", () => {
    const compte = { uid: "m", getIdToken: async () => "jeton" } as unknown as User;
    let appels: [string, RequestInit][] = [];

    beforeEach(() => {
      appels = [];
      globalThis.fetch = jest.fn(async (url: string, init: RequestInit) => {
        appels.push([url, init]);
        return { ok: true, json: async () => ({}) } as Response;
      }) as unknown as typeof fetch;
    });

    it("écrit la notification signée, puis demande le push par son identifiant", async () => {
      enTantQue("m");
      await notifierCompte(compte, { userId: "p", type: "invitation", title: "Nouvelle invitation", body: "Mo t'invite", link: "/mercato" });
      const [url, init] = appels[0];
      expect(url).toMatch(/\/api\/notifications\/push$/);
      const { notificationId } = JSON.parse(init.body as string) as { notificationId: string };
      expect(await lire(`notifications/${notificationId}`)).toMatchObject({
        user_id: "p", from_uid: "m", type: "invitation", title: "Nouvelle invitation", read: false, link: "/mercato",
      });
    });

    it("ne lève pas quand le push échoue", async () => {
      enTantQue("m");
      globalThis.fetch = jest.fn(async () => { throw new Error("hors ligne"); }) as unknown as typeof fetch;
      await expect(
        notifierCompte(compte, { userId: "p", type: "join_request", title: "Candidature acceptée", body: "Bienvenue", link: "/teams/t1" }),
      ).resolves.toBeUndefined();
    });
  });
});
