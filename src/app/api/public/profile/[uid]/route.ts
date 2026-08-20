import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/public/profile/[uid], la fiche publique d'un joueur.
 *
 * Pourquoi cette route existe : `users/{uid}` est fermé aux visiteurs dans
 * firestore.rules, et pour une bonne raison écrite sur place, le document
 * porte l'email et le numéro de téléphone du compte, donc world-readable
 * signifiait que n'importe qui pouvait parcourir la collection et récolter
 * les coordonnées de toute la plateforme.
 *
 * Ouvrir la règle aurait rendu la page publique au prix de cette fuite. On
 * lit donc avec le SDK admin et on ne renvoie qu'une PROJECTION : la liste
 * blanche ci-dessous, et rien d'autre. Ajouter un champ ici est une décision
 * de publication, email, téléphone, rôles internes et jetons n'y entrent pas.
 */

export const revalidate = 300;

/** Les seuls champs qui sortent. Tout le reste est ignoré. */
const PUBLIC_FIELDS = [
  "first_name", "last_name", "profile_picture_url", "cover_photo_url",
  "bio", "location_city", "position", "skill_level", "strong_foot",
  "height", "weight", "date_of_birth", "user_type", "evolution_role",
  "jersey_number", "gallery_urls",
] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const { uid } = await params;
  if (!uid) return NextResponse.json({ profile: null }, { status: 404 });

  try {
    const snap = await adminDb.collection("users").doc(uid).get();
    if (!snap.exists) return NextResponse.json({ profile: null }, { status: 404 });

    const data = snap.data() as Record<string, unknown>;
    const out: Record<string, unknown> = { uid };
    for (const key of PUBLIC_FIELDS) {
      if (data[key] !== undefined) out[key] = data[key];
    }

    // Ses equipes. Elles vivent dans `teams`, ferme aux visiteurs par les
    // regles, d'ou une fiche publique qui annoncait « Equipes (0) » a tout
    // le monde. On les lit ici avec le SDK admin, en ne publiant que ce qui
    // s'affiche : nom, ville, couleur, ecusson et bilan.
    //
    // Deux appartenances : etre dans l'effectif, ou etre le manager. Les deux
    // comptent, un manager-joueur ne doit pas voir son equipe disparaitre.
    const [asMember, asManager] = await Promise.all([
      adminDb.collection("teams").where("member_ids", "array-contains", uid).get(),
      adminDb.collection("teams").where("manager_id", "==", uid).get(),
    ]);

    const seen = new Set<string>();
    const teams = [...asMember.docs, ...asManager.docs].flatMap((d) => {
      if (seen.has(d.id)) return [];
      seen.add(d.id);
      const t = d.data();
      return [{
        id: d.id,
        name: t.name ?? "",
        city: t.city ?? null,
        color: t.color ?? null,
        logoUrl: t.logo_url ?? null,
        wins: t.wins ?? 0,
        draws: t.draws ?? 0,
        losses: t.losses ?? 0,
        matchesPlayed: t.matches_played ?? 0,
        isManager: t.manager_id === uid,
      }];
    });

    return NextResponse.json({ profile: out, teams });
  } catch (err) {
    console.error("GET public profile failed:", err);
    return NextResponse.json({ profile: null }, { status: 500 });
  }
}
