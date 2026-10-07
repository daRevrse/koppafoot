import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { uidAppelant } from "@/lib/appelant";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { peutGererEquipeServeur } from "@/lib/team-access-server";
import {
  dossierPhotoSansCompte, effacerVisuels, stockerVisuel, type VisuelEnvoye,
} from "@/lib/visuel-serveur";

/**
 * La photo d'un joueur sans compte.
 *
 * POST   { image: { data, contentType } } , la poser ou la remplacer.
 * DELETE                                 , la retirer.
 *
 * IL N'A PAS DE COMPTE POUR LA METTRE LUI-MÊME : ce sont ceux qui gèrent
 * l'équipe qui la posent — son manager, le staff qui a ses droits — et
 * l'administration. La fenêtre qui l'envoie rappelle qu'il faut son accord,
 * et celui de ses parents s'il est mineur : la photo paraît sur la fiche
 * publique du club et sur les feuilles de match.
 *
 * PAR LE SERVEUR, comme l'écusson d'un club ou le visuel d'un partenaire :
 * une règle Storage ne sait pas vérifier qu'on gère une équipe (voir
 * storage.rules, /branding/tribune).
 *
 * JAMAIS SUR UNE ÉQUIPE HORS PLATEFORME. Ses joueurs sont ceux d'un
 * adversaire, saisis par l'autre camp (voir FirestoreGhostPlayer) : y mettre
 * un visage, ce serait publier la photo de quelqu'un que personne de son
 * club n'a consulté.
 */

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; gid: string }> };

/** La fiche du joueur, si l'appelant a le droit d'en changer la photo. */
async function fiche(
  req: Request,
  teamId: string,
  ghostId: string,
): Promise<FirebaseFirestore.DocumentReference | NextResponse> {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const equipe = await adminDb.collection("teams").doc(teamId).get();
  if (!equipe.exists) return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });

  let autorise = await peutGererEquipeServeur(teamId, uid);
  if (!autorise) {
    const appelant = await adminDb.collection("users").doc(uid).get();
    autorise = appelant.exists && estSuperadmin(appelant.data());
  }
  if (!autorise) {
    return NextResponse.json({ error: "Seuls ceux qui gèrent l'équipe peuvent changer cette photo." }, { status: 403 });
  }
  if (equipe.data()?.is_ghost === true) {
    return NextResponse.json({ error: "Les joueurs d'une équipe hors plateforme n'ont pas de photo." }, { status: 400 });
  }

  const ref = equipe.ref.collection("ghost_players").doc(ghostId);
  if (!(await ref.get()).exists) return NextResponse.json({ error: "Joueur introuvable" }, { status: 404 });
  return ref;
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id, gid } = await params;
    const ref = await fiche(req, id, gid);
    if (ref instanceof NextResponse) return ref;

    const { image } = (await req.json().catch(() => ({}))) as { image?: VisuelEnvoye };
    if (!image?.data) return NextResponse.json({ error: "Aucune image reçue." }, { status: 400 });

    // Un seul fichier par joueur : l'ancien part avant que le nouveau arrive.
    const dossier = dossierPhotoSansCompte(id, gid);
    const url = await stockerVisuel(`${dossier}photo-`, image, dossier);
    if (typeof url !== "string") return NextResponse.json({ error: url.erreur }, { status: 400 });

    await ref.update({ photo_url: url, updated_at: new Date().toISOString() });
    return NextResponse.json({ ok: true, photoUrl: url });
  } catch (err) {
    console.error("[ghost-players photo POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id, gid } = await params;
    const ref = await fiche(req, id, gid);
    if (ref instanceof NextResponse) return ref;

    await effacerVisuels(dossierPhotoSansCompte(id, gid));
    await ref.update({ photo_url: null, updated_at: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ghost-players photo DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
