import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { uidAppelant } from "@/lib/appelant";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { effacerVisuelParAdresse } from "@/lib/visuel-serveur";
import { cheminDeLAdresse, photoDeLaCompetition } from "@/lib/photos-sans-compte";
import type { CompPlayer, FirestoreCompetition } from "@/types";

/**
 * DELETE { url } — effacer la photo d'un joueur d'une équipe de compétition,
 * une fois la ligne réécrite sans elle (retrait, remplacement, suppression du
 * joueur ; voir `CompPlayer.photo_url`).
 *
 * PAR LE SERVEUR, PARCE QUE LE NAVIGATEUR NE PEUT PAS. La règle Storage des
 * compétitions n'autorise que l'envoi d'une image (voir storage.rules) : un
 * effacement n'en est pas un, et il était refusé sans bruit. Une photo
 * retirée restait donc en ligne à son adresse — celle d'un mineur, parfois.
 *
 * CE QUI EST VÉRIFIÉ : l'appelant organise la compétition, l'administre ou
 * dirige l'une de ses équipes ; le fichier est rangé chez CETTE compétition ;
 * et plus aucune ligne de la compétition ne le montre. Ce dernier point dit
 * à lui seul que l'effacement ne retire rien à personne.
 */

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: Promise<{ cid: string }> }) {
  try {
    const uid = await uidAppelant(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { cid } = await params;

    const { url } = (await req.json().catch(() => ({}))) as { url?: string };
    if (!url || !photoDeLaCompetition(cid, url)) {
      return NextResponse.json({ error: "Cette adresse n'est pas une photo de joueur de la compétition." }, { status: 400 });
    }

    const competition = await adminDb.collection("competitions").doc(cid).get();
    if (!competition.exists) return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    const equipes = await competition.ref.collection("comp_teams").get();

    let autorise = ((competition.data() as FirestoreCompetition).organizer_ids ?? []).includes(uid)
      || equipes.docs.some((d) => d.get("claimed_by_manager_id") === uid);
    if (!autorise) {
      const appelant = await adminDb.collection("users").doc(uid).get();
      autorise = appelant.exists && estSuperadmin(appelant.data());
    }
    if (!autorise) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const chemin = cheminDeLAdresse(url);
    const encoreMontree = equipes.docs.some((d) =>
      ((d.get("players") ?? []) as CompPlayer[]).some((p) => cheminDeLAdresse(p.photo_url) === chemin),
    );
    if (encoreMontree) {
      return NextResponse.json({ error: "Cette photo est encore sur une ligne de l'effectif." }, { status: 409 });
    }

    await effacerVisuelParAdresse(url);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[photos-joueurs DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
