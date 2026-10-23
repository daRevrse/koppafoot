import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { uidAppelant } from "@/lib/appelant";
import { coteHorsPlateforme } from "@/lib/logo-hors-plateforme";
import { effacerVisuels, stockerVisuel, type VisuelEnvoye } from "@/lib/visuel-serveur";

/**
 * POST /api/matches/[mid]/logo-adversaire { image } | { retirer: true }
 *
 * Le logo de l'équipe hors plateforme d'un amical (lib/logo-hors-plateforme),
 * posé sur son camp (`home_team_logo` ou `away_team_logo`). Le manager qui a
 * créé le match, ou l'administration qui l'a programmé.
 *
 * PAR LE SERVEUR : une règle Storage ne sait pas dire qui a créé un match,
 * et le navigateur ne doit pas écrire où il veut (voir lib/visuel-serveur).
 * L'image vit sous `matches/<mid>/adversaire-`, et en remplace une ancienne.
 */
const dossier = (mid: string) => `matches/${mid}/adversaire-`;

export async function POST(req: Request, { params }: { params: Promise<{ mid: string }> }) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { mid } = await params;
  const corps = (await req.json().catch(() => ({}))) as { image?: VisuelEnvoye | null; retirer?: boolean };

  try {
    const ref = adminDb.collection("matches").doc(mid);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
    const d = snap.data() ?? {};
    if (d.manager_id !== uid && !estSuperadmin((await adminDb.collection("users").doc(uid).get()).data())) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const cote = coteHorsPlateforme(d);
    if (!cote) return NextResponse.json({ error: "Ce match n'a pas d'adversaire hors plateforme." }, { status: 409 });

    if (corps.retirer) {
      await effacerVisuels(dossier(mid));
      await ref.update({ [`${cote}_team_logo`]: null, updated_at: FieldValue.serverTimestamp() });
      return NextResponse.json({ logo: null });
    }
    if (!corps.image) return NextResponse.json({ error: "Aucune image" }, { status: 400 });
    const logo = await stockerVisuel(dossier(mid), corps.image, dossier(mid));
    if (typeof logo !== "string") return NextResponse.json({ error: logo.erreur }, { status: 400 });
    await ref.update({ [`${cote}_team_logo`]: logo, updated_at: FieldValue.serverTimestamp() });
    return NextResponse.json({ logo });
  } catch (err) {
    console.error("POST /api/matches/[mid]/logo-adversaire", err);
    return NextResponse.json({ error: "Le logo n'a pas pu être enregistré." }, { status: 500 });
  }
}
