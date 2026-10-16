import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { authorizeOrganizer, estProprietaire } from "@/lib/competition-api-auth";
import { limiteDeCreation, reponseLimite, uidAppelant } from "@/lib/offre-server";
import { accorder, lireGenre, type Genre } from "@/lib/genre";
import { notifierCompte, notifierComptes } from "@/lib/notifier-serveur";
import { apresTransfert, refusDeTransfert } from "@/lib/transfert-competition";
import type { FirestoreCompetition, FirestoreTransfert } from "@/types";

// ============================================
// Le transfert de propriété d'une compétition.
//
// POST   { cid, uid } , le propriétaire (ou l'administration) la propose à
//                       l'un de ses modérateurs. Une nouvelle proposition
//                       remplace la précédente.
// PUT    { cid }      , le modérateur accepte : il devient propriétaire, les
//                       anciens organisateurs restent modérateurs.
// DELETE { cid }      , le propriétaire annule, ou le modérateur refuse.
//
// PROPOSER, PUIS ACCEPTER. Le nouveau propriétaire hérite d'une compétition
// qui compte dans SA limite d'offre gratuite, et de ce qu'on attend de lui :
// on ne la lui met pas dans les mains sans qu'il l'ait dit.
//
// Le champ `transfert` est interdit aux navigateurs par les règles (voir
// champsDuServeurCompetition) : il ne s'écrit qu'ici.
// ============================================

/**
 * Une compétition en cours compte dans la limite de l'offre gratuite de son
 * propriétaire (voir lib/offre-server) : terminée ou d'entraînement, elle ne
 * compte pas, et peut changer de mains librement.
 */
const compteDansLaLimite = (c: FirestoreCompetition) => c.status !== "completed" && c.is_sandbox !== true;

async function compte(uid: string): Promise<{ nom: string; genre: Genre | null }> {
  const d = (await adminDb.collection("users").doc(uid).get()).data();
  return {
    nom: [d?.first_name, d?.last_name].filter(Boolean).join(" ") || "Un membre",
    genre: lireGenre(d?.gender),
  };
}

const lienStaff = (cid: string) => `/organizer/competitions/${cid}/staff`;

export async function POST(req: NextRequest) {
  try {
    const { cid, uid } = (await req.json().catch(() => ({}))) as { cid?: string; uid?: string };
    if (!cid || !uid) return NextResponse.json({ error: "cid et uid requis" }, { status: 400 });

    const auth = await authorizeOrganizer(req, cid);
    if ("error" in auth) return auth.error;
    const { callerUid, competition } = auth;

    if (competition.is_sandbox) {
      return NextResponse.json({ error: "Une compétition d'entraînement ne se transfère pas." }, { status: 400 });
    }
    if ((competition.organizer_ids ?? []).includes(uid)) {
      return NextResponse.json({ error: "Ce compte est déjà propriétaire de la compétition." }, { status: 400 });
    }
    if (!(competition.moderator_ids ?? []).includes(uid)) {
      return NextResponse.json(
        { error: "La compétition ne se transfère qu'à l'un de ses modérateurs. Ajoute-le d'abord au staff." },
        { status: 400 },
      );
    }

    // Dit tout de suite, plutôt qu'au moment où il accepte : sinon le
    // propriétaire attend une réponse qui ne pourra jamais être oui.
    if (compteDansLaLimite(competition)) {
      const limite = await limiteDeCreation(uid, "competitions");
      if (limite) {
        const { nom, genre } = await compte(uid);
        return NextResponse.json(
          {
            error: `${nom} a déjà le maximum de compétitions en cours de l'offre gratuite : ${accorder(genre, "il", "elle")} ne peut pas en recevoir une de plus sans KoppaFoot+.`,
          },
          { status: 409 },
        );
      }
    }

    const transfert: FirestoreTransfert = { vers_uid: uid, par_uid: callerUid, le: new Date().toISOString() };
    await adminDb.collection("competitions").doc(cid).update({
      transfert,
      updated_at: FieldValue.serverTimestamp(),
    });

    try {
      await notifierCompte(uid, {
        type: "invitation",
        title: "Une compétition t'est proposée",
        body: `${(await compte(callerUid)).nom} te propose de devenir propriétaire de « ${competition.name} »`,
        link: lienStaff(cid),
      });
    } catch (err) {
      console.error("[transfert POST] notification", err);
    }

    return NextResponse.json({ ok: true, transfert });
  } catch (err) {
    console.error("[transfert POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const callerUid = await uidAppelant(req);
    if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { cid } = (await req.json().catch(() => ({}))) as { cid?: string };
    if (!cid) return NextResponse.json({ error: "cid requis" }, { status: 400 });

    const ref = adminDb.collection("competitions").doc(cid);
    const avant = (await ref.get()).data() as FirestoreCompetition | undefined;
    if (!avant) return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    const refus = refusDeTransfert(avant, callerUid);
    if (refus) return NextResponse.json({ error: refus }, { status: 409 });

    // Hors de la transaction : la limite se compte sur une requête, qu'une
    // transaction ne sait pas relire. Le pire écart possible est une
    // compétition créée entre les deux lectures, la même tolérance que
    // /api/competitions à la création.
    if (compteDansLaLimite(avant)) {
      const limite = await limiteDeCreation(callerUid, "competitions");
      if (limite) {
        return reponseLimite(limite);
      }
    }

    const profil = (await adminDb.collection("users").doc(callerUid).get()).data();
    const anciens = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const c = snap.data() as FirestoreCompetition | undefined;
      if (!c) throw new ErreurTransfert("Compétition introuvable", 404);
      const encore = refusDeTransfert(c, callerUid);
      if (encore) throw new ErreurTransfert(encore, 409);
      tx.update(ref, {
        ...apresTransfert(c, callerUid),
        // La structure affichée sur les pages publiques suit le nouveau
        // propriétaire, s'il en a déclaré une ; sinon le tournoi garde la
        // sienne, qui reste vraie le temps d'une passation.
        ...(profil?.organizer_name ? { organizer_name: profil.organizer_name } : {}),
        transfert: null,
        updated_at: FieldValue.serverTimestamp(),
      });
      return c.organizer_ids ?? [];
    });

    try {
      const { nom } = await compte(callerUid);
      // Chacun reçoit son accord : « Tu restes modérateur », « modératrice ».
      await Promise.allSettled(anciens.map(async (uid) => {
        const { genre } = await compte(uid);
        await notifierCompte(uid, {
          type: "invitation",
          title: "Transfert accepté",
          body: `${nom} est désormais propriétaire de « ${avant.name} ». ${accorder(genre, "Tu restes modérateur.", "Tu restes modératrice.")}`,
          link: lienStaff(cid),
        });
      }));
    } catch (err) {
      console.error("[transfert PUT] notification", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ErreurTransfert) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[transfert PUT]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const callerUid = await uidAppelant(req);
    if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { cid } = (await req.json().catch(() => ({}))) as { cid?: string };
    if (!cid) return NextResponse.json({ error: "cid requis" }, { status: 400 });

    const ref = adminDb.collection("competitions").doc(cid);
    const competition = (await ref.get()).data() as FirestoreCompetition | undefined;
    if (!competition) return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    const t = competition.transfert;
    if (!t) return NextResponse.json({ ok: true });

    // Le destinataire refuse, ou le propriétaire annule. Personne d'autre.
    const refuse = t.vers_uid === callerUid;
    if (!refuse && !(await estProprietaire(callerUid, competition))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await ref.update({ transfert: null, updated_at: FieldValue.serverTimestamp() });

    if (refuse) {
      try {
        await notifierComptes(competition.organizer_ids ?? [], {
          type: "invitation",
          title: "Transfert refusé",
          body: `${(await compte(callerUid)).nom} garde son rôle au staff de « ${competition.name} ».`,
          link: lienStaff(cid),
        });
      } catch (err) {
        console.error("[transfert DELETE] notification", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[transfert DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

class ErreurTransfert extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
