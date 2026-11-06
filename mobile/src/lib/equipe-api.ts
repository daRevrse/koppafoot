import type { User } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import type { Categorie } from "@/lib/genre";
import { API_URL } from "~/lib/config";
import { db } from "~/lib/firebase";

// Ce que l'écran du club demande au site, avec le jeton du compte : créer une
// équipe (l'offre plafonne leur nombre, une règle ne sait pas compter),
// chercher des joueurs (les profils des autres passent par le serveur), et
// prévenir les intéressés. Les notifications sont un bonus : elles ne lèvent
// jamais, le geste a déjà abouti quand on arrive ici.

/** Le formulaire de création, champ pour champ celui du site. */
export type ChampsEquipe = {
  name: string;
  city: string;
  level: string;
  category: Categorie | null;
  color: string;
  description: string;
  maxMembers: number;
};

/** Un joueur rendu par la recherche du site (liste blanche, sans e-mail ni numéro). */
export type JoueurTrouve = {
  uid: string;
  prenom: string;
  nom: string;
  photo: string | null;
  ville: string;
  poste: string;
  niveau: string;
};

const jeton = async (u: User) => ({ Authorization: `Bearer ${await u.getIdToken()}` });

/** Le message de la route quand elle en donne un : c'est ce qu'on montre. */
async function refus(rep: Response, parDefaut: string): Promise<Error> {
  const data = (await rep.json().catch(() => ({}))) as { error?: string };
  return new Error(data.error ?? parDefaut);
}

/** POST /api/teams : le manager est l'appelant ; rend l'identifiant de l'équipe. */
export async function creerEquipe(u: User, c: ChampsEquipe): Promise<string> {
  const rep = await fetch(`${API_URL}/api/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await jeton(u)) },
    body: JSON.stringify(c),
  });
  if (!rep.ok) throw await refus(rep, "La création de l'équipe a échoué.");
  return ((await rep.json()) as { id: string }).id;
}

/** GET /api/membres/recherche?role=joueur : les joueurs du mercato, filtrés par nom et par ville. */
export async function chercherJoueurs(u: User, f: { texte?: string; ville?: string }): Promise<JoueurTrouve[]> {
  const p = new URLSearchParams({ role: "joueur" });
  const texte = f.texte?.trim();
  const ville = f.ville?.trim();
  if (texte) p.set("texte", texte);
  if (ville) p.set("ville", ville);
  const rep = await fetch(`${API_URL}/api/membres/recherche?${p.toString()}`, { headers: await jeton(u) });
  if (!rep.ok) throw await refus(rep, "La recherche a échoué.");
  const { membres = [] } = (await rep.json()) as { membres?: Record<string, unknown>[] };
  const chaine = (v: unknown) => (typeof v === "string" ? v : "");
  return membres.map((m) => ({
    uid: chaine(m.uid),
    prenom: chaine(m.first_name),
    nom: chaine(m.last_name),
    photo: chaine(m.profile_picture_url) || null,
    ville: chaine(m.location_city),
    poste: chaine(m.position),
    niveau: chaine(m.skill_level),
  }));
}

/** Annonce une arrivée ou un départ à l'effectif et aux abonnés ; n'attend rien. */
export function notifierActiviteEquipe(
  u: User,
  e: { teamId: string; event: "member_joined" | "member_left"; playerId: string },
): void {
  void (async () => {
    try {
      await fetch(`${API_URL}/api/notifications/team-activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await jeton(u)) },
        body: JSON.stringify(e),
      });
    } catch {
      // Un bonus : le mouvement est déjà enregistré.
    }
  })();
}

/**
 * Prévient un compte : la notification est écrite signée (`from_uid`, exigé
 * par les règles), puis le push est demandé par son identifiant — la route
 * relit le document au lieu de croire l'appelant.
 */
export async function notifierCompte(
  u: User,
  n: { userId: string; type: "invitation" | "join_request"; title: string; body: string; link: string },
): Promise<void> {
  try {
    const ref = await addDoc(collection(db, "notifications"), {
      user_id: n.userId,
      from_uid: u.uid,
      type: n.type,
      title: n.title.slice(0, 120),
      body: n.body.slice(0, 300),
      link: n.link,
      read: false,
      created_at: serverTimestamp(),
    });
    await fetch(`${API_URL}/api/notifications/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await jeton(u)) },
      body: JSON.stringify({ notificationId: ref.id }),
    });
  } catch {
    // Voir plus haut : rien à dire au manager.
  }
}

/**
 * Retire la photo d'un joueur sans compte, avant de le supprimer : seul le
 * serveur écrit dans son dossier Storage, et sans ce passage le fichier
 * resterait en ligne sans plus rien qui le montre.
 */
export async function retirerPhotoFantome(u: User, teamId: string, gid: string): Promise<void> {
  const rep = await fetch(
    `${API_URL}/api/teams/${encodeURIComponent(teamId)}/ghost-players/${encodeURIComponent(gid)}/photo`,
    { method: "DELETE", headers: await jeton(u) },
  );
  if (!rep.ok) throw await refus(rep, "La photo n'a pas pu être retirée.");
}
