import { auth } from "@/lib/firebase";

// ============================================
// Asking the server to announce a competition milestone in the Tribune.
//
// Deliberately best-effort: a failed announcement must never surface as a
// failure of the action that triggered it. Disqualifying a team is the real
// work; the post about it is not.
// ============================================

export type AnnounceEvent =
  | { kind: "registrations_open" }
  | { kind: "team_entered"; teamName: string }
  | {
      kind: "match_result";
      homeTeam: string; awayTeam: string;
      scoreHome: number; scoreAway: number;
      forfeit?: boolean;
    }
  | { kind: "team_disqualified"; teamName: string }
  | { kind: "competition_completed"; winner?: string | null };

export async function announce(cid: string, event: AnnounceEvent): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch("/api/tribune/announce", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ cid, event }),
    });
  } catch (err) {
    console.error("Tribune announcement failed:", err);
  }
}

/**
 * Commenter une publication. Le serveur signe le commentaire et prévient
 * l'auteur (voir /api/tribune/comments) ; le nom qu'il renvoie est celui
 * qu'il a écrit, à afficher tel quel.
 *
 * Contrairement à `announce`, l'échec remonte : ici le commentaire EST le
 * geste, et celui qui l'a tapé doit savoir qu'il n'est pas parti.
 */
export async function commenter(postId: string, content: string): Promise<{ id: string; authorName: string }> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Compte requis");
  const res = await fetch("/api/tribune/comments", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ postId, content }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; authorName?: string; error?: string };
  if (!res.ok || !data.id) throw new Error(data.error ?? `HTTP ${res.status}`);
  return { id: data.id, authorName: data.authorName ?? "" };
}

/**
 * Annoncer le recrutement d'une équipe dans la Tribune, sous le nom du
 * manager (voir /api/tribune/recruitment). L'échec remonte, avec la phrase du
 * serveur : « Ton annonce est déjà en ligne. »
 */
export async function annoncerRecrutement(
  teamId: string, postes: string[], message: string,
): Promise<{ postId: string; action: "publier" | "rouvrir" }> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Compte requis");
  const res = await fetch("/api/tribune/recruitment", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ teamId, action: "publier", postes, message }),
  });
  const data = (await res.json().catch(() => ({}))) as { postId?: string; action?: "publier" | "rouvrir"; error?: string };
  if (!res.ok || !data.postId) throw new Error(data.error ?? `HTTP ${res.status}`);
  return { postId: data.postId, action: data.action ?? "publier" };
}

/**
 * Le recrutement s'arrête : l'annonce se ferme. Sans conséquence si elle
 * échoue, comme `announce` : couper le recrutement est le vrai geste.
 */
export async function cloreAnnonceRecrutement(teamId: string): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch("/api/tribune/recruitment", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ teamId, action: "clore" }),
    });
  } catch (err) {
    console.error("Annonce de recrutement non fermée :", err);
  }
}
