import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { lienInterne, sendPushToUsers } from "@/lib/fcm-server";
import type { FirestoreCompetition, FirestoreStaffGrant } from "@/types";

/**
 * POST /api/notifications/match
 *
 * Diffuse un événement de match — coup d'envoi, but, fin — à ceux qui le
 * suivent : les abonnés de CE match (`match_follows`, voir lib/suivi-match)
 * et, pour une rencontre de compétition, les abonnés de la compétition
 * (`users.followed_competition_ids`).
 *
 * Body : { mid, cid?, title, body, link? }
 *
 * UNE SEULE DIFFUSION. Il y avait deux routes, une par liste, et la console
 * appelait les deux : quelqu'un qui suivait la compétition ET le match
 * recevait chaque but deux fois. Les deux listes sont réunies ici, chaque
 * compte une fois (voir sendPushToUsers).
 *
 * QUI A LE DROIT D'ÉCRIRE À CES GENS : ceux qui tiennent la console de ce
 * match, et personne d'autre. Vérifié sur les documents chargés ici, jamais
 * sur ce que le client affirme — sans quoi n'importe quel compte pourrait
 * envoyer un faux but à tous les abonnés d'une affiche.
 *  - compétition : ses organisateurs et modérateurs, et les porteurs d'un
 *    code d'accès encore valide (ils tiennent la console aussi) ;
 *  - amical : les deux managers et le scoreur ou les modérateurs désignés ;
 *  - partout : le superadmin.
 *
 * Une compétition d'entraînement ne sort jamais d'ici. Le plafond borne
 * chaque liste : au-delà, une diffusion n'est plus un envoi, c'est une
 * campagne, et elle passe par les outils qui en portent le nom.
 */

const MAX_ABONNES = 500;

async function staffDeLaCompetition(cid: string, c: FirestoreCompetition, uid: string): Promise<boolean> {
  if ((c.organizer_ids ?? []).includes(uid) || (c.moderator_ids ?? []).includes(uid)) return true;
  // Les porteurs d'un code d'accès tiennent la console : sans eux, chaque but
  // qu'ils saisissent atteindrait le tableau mais jamais les téléphones.
  const grant = (await adminDb.collection("competitions").doc(cid).collection("staff_grants").doc(uid).get())
    .data() as FirestoreStaffGrant | undefined;
  return grant != null && grant.revoked !== true && (grant.expires_at_ms == null || grant.expires_at_ms > Date.now());
}

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

    let autorise = false;
    let competition: FirestoreCompetition | null = null;

    if (cid) {
      const comp = await adminDb.collection("competitions").doc(cid).get();
      if (!comp.exists) return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
      competition = comp.data() as FirestoreCompetition;
      // Une compétition d'entraînement ne doit jamais atteindre personne.
      if (competition.is_sandbox) return NextResponse.json({ ok: true, destinataires: 0, envoyes: 0, sandbox: true });
      autorise = await staffDeLaCompetition(cid, competition, appelant);
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

    const [abonnesDuMatch, abonnesDeLaCompetition] = await Promise.all([
      adminDb.collection("match_follows").where("match_id", "==", mid).limit(MAX_ABONNES).get(),
      cid
        ? adminDb.collection("users").where("followed_competition_ids", "array-contains", cid).limit(MAX_ABONNES).select().get()
        : null,
    ]);

    const destinataires = [
      ...abonnesDuMatch.docs.map((d) => String(d.data().user_id ?? "")),
      ...(abonnesDeLaCompetition?.docs.map((d) => d.id) ?? []),
    ];

    const bilan = await sendPushToUsers(destinataires, {
      title: title.trim().slice(0, 120),
      body: body.trim().slice(0, 300),
      link: lienInterne(link),
      category: "competitions",
    });

    return NextResponse.json({ ok: true, ...bilan });
  } catch (err) {
    console.error("[notifications/match]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
