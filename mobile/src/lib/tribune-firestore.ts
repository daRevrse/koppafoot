import type { User } from "firebase/auth";
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, where, type Unsubscribe,
} from "firebase/firestore";
import { toComment, toPost } from "@/lib/post-mappers";
import {
  SYSTEM_AUTHOR_ID, SYSTEM_AUTHOR_NAME,
  type Comment, type FirestoreComment, type FirestorePost, type Post, type Team, type UserProfile,
} from "@/types";
import { API_URL } from "~/lib/config";
import { notifierCompte } from "~/lib/equipe-api";
import { lireEquipe } from "~/lib/equipe-firestore";
import { db } from "~/lib/firebase";
import type { Signature } from "~/lib/tribune";

// La Tribune, côté base : ce que lib/firestore du site fait pour /feed
// (onPosts, createPost, toggleLike…), avec les mêmes documents et les mêmes
// règles. Commenter et signaler passent par le serveur : lib/tribune-api.

/** Le fil : les trente dernières publications, comme le site. */
export const TAILLE_DU_FIL = 30;

type Auteur = { name: string; avatar: string };

/**
 * Le nom et la photo d'AUJOURD'HUI des auteurs, à la place de ceux recopiés
 * dans la publication le jour où elle a été écrite. Les profils des autres se
 * lisent par le serveur (/api/membres), donc avec un compte ; un visiteur
 * garde les valeurs recopiées. Le compte officiel n'a pas de profil : son
 * identité est dans settings/tribune, réglable depuis l'administration.
 */
async function rafraichirLesAuteurs(posts: Post[], utilisateur: User | null, connus: Map<string, Auteur>): Promise<void> {
  const manquants = [...new Set(posts.map((p) => p.authorId).filter((id) => id && id !== SYSTEM_AUTHOR_ID && !connus.has(id)))];
  if (utilisateur && manquants.length > 0) {
    try {
      const rep = await fetch(`${API_URL}/api/membres`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await utilisateur.getIdToken()}` },
        body: JSON.stringify({ uids: manquants.slice(0, 100) }),
      });
      if (rep.ok) {
        const { membres = [] } = (await rep.json()) as {
          membres?: { uid: string; first_name?: string; last_name?: string; profile_picture_url?: string | null }[];
        };
        for (const m of membres) {
          const name = `${m.first_name ?? ""} ${m.last_name ? `${m.last_name.charAt(0)}.` : ""}`.trim();
          connus.set(m.uid, { name, avatar: m.profile_picture_url ?? "" });
        }
      }
    } catch {
      // Le fil reste lisible avec les noms recopiés.
    }
  }
  if (posts.some((p) => p.authorId === SYSTEM_AUTHOR_ID) && !connus.has(SYSTEM_AUTHOR_ID)) {
    try {
      const d = (await getDoc(doc(db, "settings", "tribune"))).data();
      connus.set(SYSTEM_AUTHOR_ID, { name: d?.system_name || SYSTEM_AUTHOR_NAME, avatar: d?.system_avatar_url || "" });
    } catch {
      // Idem.
    }
  }
  for (const p of posts) {
    const frais = connus.get(p.authorId);
    if (!frais) continue;
    if (frais.name) p.authorName = frais.name;
    p.authorAvatar = frais.avatar;
  }
}

/**
 * Le fil, en direct. Il s'affiche tout de suite avec les valeurs rangées dans
 * les publications, puis se corrige une fois les auteurs relus : la Tribune
 * n'attend pas un second aller-retour pour paraître. Deux instantanés peuvent
 * se chevaucher pendant la relecture ; seul le plus récent arrive à l'écran.
 */
export function ecouterLaTribune(
  utilisateur: User | null,
  surFil: (posts: Post[]) => void,
  surErreur: () => void,
): Unsubscribe {
  const connus = new Map<string, Auteur>();
  let dernier = 0;
  return onSnapshot(
    query(collection(db, "posts"), orderBy("created_at", "desc"), limit(TAILLE_DU_FIL)),
    (snap) => {
      const tour = ++dernier;
      const posts = snap.docs.map((d) => toPost(d.id, d.data() as FirestorePost, utilisateur?.uid));
      surFil(posts);
      void rafraichirLesAuteurs(posts, utilisateur, connus).then(() => {
        if (tour === dernier) surFil([...posts]);
      });
    },
    surErreur,
  );
}

/** Publier : un texte signé de son auteur, et la citation d'une publication qu'on repartage. */
export async function publier(
  uid: string,
  s: Signature,
  contenu: string,
  citation?: { postId: string; authorName: string; content: string },
): Promise<string> {
  const ref = await addDoc(collection(db, "posts"), {
    author_id: uid, author_name: s.authorName, author_role: s.authorRole, author_avatar: s.authorAvatar,
    type: "text", content: contenu,
    metadata: citation ? { repost_of: { post_id: citation.postId, author_name: citation.authorName, content: citation.content } } : null,
    likes: [], comment_count: 0, media_urls: [],
    created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  return ref.id;
}

/** La photo, une fois envoyée, rejoint la publication : les règles laissent ce champ à l'auteur. */
export async function attacherLaPhoto(postId: string, url: string): Promise<void> {
  await updateDoc(doc(db, "posts", postId), { media_urls: [url], updated_at: serverTimestamp() });
}

export async function basculerLeJaime(postId: string, uid: string, aimait: boolean): Promise<void> {
  await updateDoc(doc(db, "posts", postId), { likes: aimait ? arrayRemove(uid) : arrayUnion(uid) });
}

export async function modifierLaPublication(postId: string, contenu: string): Promise<void> {
  await updateDoc(doc(db, "posts", postId), { content: contenu, updated_at: serverTimestamp() });
}

export async function supprimerLaPublication(postId: string): Promise<void> {
  await deleteDoc(doc(db, "posts", postId));
}

/** Les commentaires d'une publication, le plus récent d'abord. */
export async function lireLesCommentaires(postId: string): Promise<Comment[]> {
  const snap = await getDocs(query(collection(db, "posts", postId, "comments"), orderBy("created_at", "desc")));
  return snap.docs.map((d) => toComment(d.id, d.data() as FirestoreComment));
}

/** Ce que « Demander à rejoindre » a donné. */
export type IssueDeLaDemande =
  | { genre: "envoyee" }
  | { genre: "fermee" }
  | { genre: "membre"; equipe: string };

/**
 * Demander à rejoindre l'équipe d'une annonce de recrutement (CarteRecrutement
 * du site) : la même demande que le mercato. L'équipe d'AUJOURD'HUI, pas celle
 * de l'annonce : son manager a pu changer, et le joueur y est peut-être déjà.
 * Une demande en attente ne se double pas.
 */
export async function demanderARejoindre(u: User, profil: UserProfile, teamId: string, mot: string): Promise<IssueDeLaDemande> {
  const equipe: Team | null = await lireEquipe(teamId);
  if (!equipe || !equipe.isRecruiting) return { genre: "fermee" };
  if (equipe.memberIds.includes(u.uid)) return { genre: "membre", equipe: equipe.name };
  const enAttente = await getDocs(query(
    collection(db, "join_requests"),
    where("player_id", "==", u.uid), where("team_id", "==", teamId), where("status", "==", "pending"),
  ));
  if (!enAttente.empty) return { genre: "envoyee" };
  const nom = `${profil.firstName} ${profil.lastName}`.trim();
  await addDoc(collection(db, "join_requests"), {
    player_id: u.uid, player_name: nom,
    player_photo: profil.profilePictureUrl ?? null, team_logo: equipe.logoUrl ?? null,
    player_city: profil.locationCity ?? "", player_position: profil.position ?? "", player_level: profil.skillLevel ?? "",
    team_id: teamId, team_name: equipe.name, manager_id: equipe.managerId,
    message: mot, status: "pending",
    created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  void notifierCompte(u, {
    userId: equipe.managerId, type: "join_request", title: "Demande d'adhésion",
    body: `${nom} souhaite rejoindre ${equipe.name}`, link: "/teams",
  });
  return { genre: "envoyee" };
}
