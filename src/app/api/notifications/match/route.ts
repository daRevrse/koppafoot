import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { sendPushToUser } from "@/lib/fcm-server";

/**
 * POST /api/notifications/match
 *
 * Diffuse un événement de match — coup d'envoi, but, fin — à ceux qui suivent
 * CE match (collection `match_follows`, voir lib/suivi-match).
 *
 * Body : { mid, cid?, title, body, link? }
 *
 * QUI A LE DROIT D'ÉCRIRE À CES GENS : celui qui tient la console de ce
 * match, et personne d'autre. La vérification se fait sur les documents
 * chargés ici, jamais sur ce que le client affirme — sans quoi n'importe quel
 * compte pourrait envoyer un faux but à tous les abonnés d'une affiche.
 *
 * Pour une rencontre de compétition, ce sont ses organisateurs et modérateurs.
 * Pour un amical, les deux managers et les modérateurs désignés. Le superadmin
 * passe partout, comme ailleurs.
 *
 * Le plafond est le même que pour les compétitions : au-delà, une diffusion
 * n'est plus un envoi, c'est une campagne, et elle doit passer par les outils
 * qui en portent le nom.
 */

const MAX_ABONNES = 500;

export async function POST(req: NextRequest) {
  try {
    const entete = req.headers.get("authorization");
    if (!entete?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    let appelant: string;
    try {
      appelant = (await adminAuth.verifyIdToken(entete.split("Bearer ")[1])).uid;
    } catch {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const { mid, cid, title, body, link } = (await req.json()) as {
      mid?: string; cid?: string | null; title?: string; body?: string; link?: string;
    };
    if (!mid || !title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "mid, title et body sont requis" }, { status: 400 });
    }

    // --- Qui tient ce match ? -------------------------------------------------
    let autorise = false;

    if (cid) {
      const comp = await adminDb.collection("competitions").doc(cid).get();
      const c = comp.data();
      autorise = comp.exists && (
        (Array.isArray(c?.organizer_ids) && c!.organizer_ids.includes(appelant))
        || (Array.isArray(c?.moderator_ids) && c!.moderator_ids.includes(appelant))
      );
    } else {
      const m = await adminDb.collection("matches").doc(mid).get();
      const d = m.data();
      autorise = m.exists && (
        d?.manager_id === appelant
        || d?.away_manager_id === appelant
        || (Array.isArray(d?.moderator_ids) && d!.moderator_ids.includes(appelant))
      );
    }

    if (!autorise) {
      const profil = await adminDb.collection("users").doc(appelant).get();
      autorise = profil.exists && estSuperadmin(profil.data());
    }
    if (!autorise) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // --- Les abonnés de CE match ---------------------------------------------
    const abonnes = await adminDb
      .collection("match_follows")
      .where("match_id", "==", mid)
      .limit(MAX_ABONNES)
      .get();

    // `allSettled` : un jeton mort chez l'un ne doit pas priver les autres.
    const sorts = await Promise.allSettled(
      abonnes.docs.map((d) =>
        sendPushToUser(String(d.data().user_id), {
          title: title.trim(),
          body: body.trim(),
          link,
          category: "competitions",
        }),
      ),
    );

    return NextResponse.json({
      ok: true,
      abonnes: abonnes.size,
      envoyes: sorts.filter((s) => s.status === "fulfilled").length,
    });
  } catch (err) {
    console.error("[notifications/match]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
