import { normaliserVille } from "@/lib/villes";
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, where, writeBatch, type Unsubscribe,
} from "firebase/firestore";
import { toGhostPlayer, toInvitation, toJoinRequest, toTeam } from "@/lib/equipe-mappers";
import type { Poste } from "@/lib/postes";
import type {
  FirestoreGhostPlayer, FirestoreInvitation, FirestoreJoinRequest, FirestoreTeam, GhostPlayer, Invitation,
  JoinRequest, Team,
} from "@/types";
import type { JoueurTrouve } from "~/lib/equipe-api";
import { db } from "~/lib/firebase";

// L'effectif d'un club, lu et écrit comme le fait le site (src/lib/firestore) :
// mêmes champs, mêmes requêtes, mêmes règles. Ce module n'appelle pas le
// serveur : les notifications et la création d'équipe sont dans equipe-api,
// et c'est l'écran qui enchaîne les deux.
//
// UNE DIFFÉRENCE VOULUE : accepter une candidature n'envoie pas d'invitation
// en plus. Le site le fait encore, alors que le joueur est déjà membre (voir
// docs/plans/2026-11-06-app-mobile-gerer-son-equipe-design.md).

/** Un joueur sans compte, tel que le formulaire le saisit. */
export type ChampsFantome = { prenom: string; nom: string; poste: Poste; dossard: string };

/** Ce que le manager change sur l'effectif avant d'enregistrer. */
export type Brouillon = { dossards: Record<string, string>; titulaires: string[] };

type SurErreur = (e: Error) => void;

const signaler = (ecouteur: string, surErreur?: SurErreur) => (e: Error) => {
  if (surErreur) surErreur(e);
  else console.warn(`[equipe-firestore] ${ecouteur} :`, e.message);
};

/**
 * Les équipes qu'on gère : les siennes, et celles dont on est le délégué.
 * Deux requêtes, Firestore ne sachant pas faire de OU entre deux champs ; les
 * équipes hors plateforme (adversaires d'un amical) n'en sont pas.
 */
export async function equipesQueJeGere(uid: string): Promise<Team[]> {
  const [miennes, deleguees] = await Promise.all([
    getDocs(query(collection(db, "teams"), where("manager_id", "==", uid))),
    getDocs(query(collection(db, "teams"), where("staff_manager_ids", "array-contains", uid))),
  ]);
  const parId = new Map<string, Team>();
  for (const d of [...miennes.docs, ...deleguees.docs]) {
    const t = toTeam(d.id, d.data() as FirestoreTeam);
    if (!t.isGhost) parId.set(t.id, t);
  }
  return [...parId.values()];
}

/** Un club, une fois : l'écran d'invitation en a besoin pour son nom et son logo. */
export async function lireEquipe(teamId: string): Promise<Team | null> {
  const s = await getDoc(doc(db, "teams", teamId));
  return s.exists() ? toTeam(s.id, s.data() as FirestoreTeam) : null;
}

export function ecouterEquipe(teamId: string, cb: (t: Team | null) => void, surErreur?: SurErreur): Unsubscribe {
  return onSnapshot(
    doc(db, "teams", teamId),
    (s) => cb(s.exists() ? toTeam(s.id, s.data() as FirestoreTeam) : null),
    signaler("ecouterEquipe", surErreur),
  );
}

export function ecouterFantomes(teamId: string, cb: (g: GhostPlayer[]) => void, surErreur?: SurErreur): Unsubscribe {
  return onSnapshot(
    collection(db, "teams", teamId, "ghost_players"),
    (s) => cb(s.docs.map((d) => toGhostPlayer(d.id, teamId, d.data() as FirestoreGhostPlayer))),
    signaler("ecouterFantomes", surErreur),
  );
}

/**
 * Les candidatures de l'équipe. Le manager de l'équipe dans la requête, comme
 * le site : c'est l'index qui existe, et le délégué y passe par la règle.
 */
export function ecouterCandidatures(
  teamId: string,
  managerId: string,
  cb: (d: JoinRequest[]) => void,
  surErreur?: SurErreur,
): Unsubscribe {
  const q = query(
    collection(db, "join_requests"),
    where("team_id", "==", teamId),
    where("manager_id", "==", managerId),
    orderBy("created_at", "desc"),
  );
  return onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => toJoinRequest(d.id, d.data() as FirestoreJoinRequest))),
    signaler("ecouterCandidatures", surErreur),
  );
}

/** Les invitations qu'on a envoyées, toutes équipes : les règles n'en montrent pas d'autres. */
export function ecouterInvitationsEnvoyees(uid: string, cb: (i: Invitation[]) => void, surErreur?: SurErreur): Unsubscribe {
  const q = query(collection(db, "invitations"), where("sender_id", "==", uid), orderBy("created_at", "desc"));
  return onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => toInvitation(d.id, d.data() as FirestoreInvitation))),
    signaler("ecouterInvitationsEnvoyees", surErreur),
  );
}

/** Dossards et titulaires en une écriture : un seul bouton Enregistrer. */
export async function enregistrerEffectif(teamId: string, b: Brouillon): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), {
    squad_numbers: b.dossards,
    lineup_ids: b.titulaires,
    updated_at: serverTimestamp(),
  });
}

/**
 * Retire un membre de l'effectif. Sortir de l'effectif, c'est sortir du
 * staff : sans ça, un joueur écarté garderait les droits du manager. Mais les
 * règles ne laissent que le propriétaire toucher au staff : pour un délégué,
 * seul l'effectif change.
 */
export async function retirerMembre(team: Team, uid: string, appelant: string): Promise<void> {
  const champs: Record<string, unknown> = { member_ids: arrayRemove(uid), updated_at: serverTimestamp() };
  const actuel = team.staff ?? [];
  if (appelant === team.managerId && actuel.some((m) => m.uid === uid)) {
    const staff = actuel.filter((m) => m.uid !== uid);
    champs.staff = staff;
    champs.staff_manager_ids = staff.filter((m) => m.delegated).map((m) => m.uid);
  }
  await updateDoc(doc(db, "teams", team.id), champs);
}

const champsFantome = (f: ChampsFantome) => ({
  first_name: f.prenom.trim(),
  last_name: f.nom.trim(),
  position: f.poste,
  squad_number: f.dossard.trim() || null,
});

/** Un joueur sans compte, pour préremplir sa modification ; null s'il n'existe plus. */
export async function lireFantome(teamId: string, gid: string): Promise<GhostPlayer | null> {
  const s = await getDoc(doc(db, "teams", teamId, "ghost_players", gid));
  return s.exists() ? toGhostPlayer(s.id, teamId, s.data() as FirestoreGhostPlayer) : null;
}

/** Les dates d'un joueur sans compte sont des chaines ISO, comme sur le site. */
export async function creerFantome(teamId: string, f: ChampsFantome): Promise<string> {
  const maintenant = new Date().toISOString();
  const ref = await addDoc(collection(db, "teams", teamId, "ghost_players"), {
    ...champsFantome(f),
    goals: 0,
    assists: 0,
    matches_played: 0,
    created_at: maintenant,
    updated_at: maintenant,
  });
  return ref.id;
}

export async function modifierFantome(teamId: string, gid: string, f: ChampsFantome): Promise<void> {
  await updateDoc(doc(db, "teams", teamId, "ghost_players", gid), {
    ...champsFantome(f),
    updated_at: new Date().toISOString(),
  });
}

/** Sa photo, s'il en a une, se retire d'abord par le serveur (equipe-api, retirerPhotoFantome). */
export async function supprimerFantome(teamId: string, gid: string): Promise<void> {
  await deleteDoc(doc(db, "teams", teamId, "ghost_players", gid));
}

/** Répond à une candidature ; acceptée, le joueur entre dans l'effectif, dans le même lot. */
export async function repondreCandidature(d: JoinRequest, acceptee: boolean): Promise<void> {
  const lot = writeBatch(db);
  lot.update(doc(db, "join_requests", d.id), {
    status: acceptee ? "accepted" : "rejected",
    updated_at: serverTimestamp(),
  });
  if (acceptee) {
    lot.update(doc(db, "teams", d.teamId), { member_ids: arrayUnion(d.playerId), updated_at: serverTimestamp() });
  }
  await lot.commit();
}

/** Invite un joueur trouvé par la recherche ; rend l'identifiant de l'invitation. */
export async function inviterJoueur(e: {
  team: Team;
  expediteur: { uid: string; nom: string };
  joueur: JoueurTrouve;
  message: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, "invitations"), {
    sender_id: e.expediteur.uid,
    sender_name: e.expediteur.nom,
    receiver_id: e.joueur.uid,
    receiver_name: `${e.joueur.prenom} ${e.joueur.nom}`.trim(),
    receiver_photo: e.joueur.photo ?? null,
    team_logo: e.team.logoUrl ?? null,
    receiver_city: normaliserVille(e.joueur.ville),
    receiver_position: e.joueur.poste,
    receiver_level: e.joueur.niveau,
    team_id: e.team.id,
    team_name: e.team.name,
    message: e.message,
    status: "pending",
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return ref.id;
}

export async function annulerInvitation(id: string): Promise<void> {
  await deleteDoc(doc(db, "invitations", id));
}
