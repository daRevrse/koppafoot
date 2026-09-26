import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { notifier } from "@/lib/reservations-server";
import {
  champsSansEquipe, estArbitreServeur, estScoreurServeur, nomDuCompte,
} from "@/lib/arbitrage-server";
import type {
  FirestoreCorpsArbitral, FirestoreEquipeArbitrale, FirestoreMatch, RoleDansLeCorps,
} from "@/types";

// ============================================
// POST /api/corps-arbitral, l'équipe permanente d'un arbitre.
//
// POURQUOI. L'arbitre dirige la rencontre sur le terrain, sifflet en main : il
// ne tient pas un téléphone pendant le match. Ce qui se passe dans
// l'application pendant ces quatre-vingt-dix minutes, c'est un scoreur qui le
// saisit. Et un arbitre sérieux ne vient pas seul : il a ses assistants, ses
// habitués. Le corps arbitral, c'est cette équipe-là, constituée une fois,
// qu'il emmène ensuite match après match (voir l'action « composer » de
// /api/matches/[mid]/arbitre).
//
// LES GESTES :
//  - le CHEF (un arbitre) : creer, renommer, inviter, annulerInvitation,
//    retirer (un membre), dissoudre ;
//  - l'INVITÉ : repondre (accepter ou décliner) ;
//  - le MEMBRE : quitter.
//
// Un arbitre ne dirige qu'un corps ; on peut être membre de plusieurs (un
// scoreur rend service à plusieurs arbitres). Tout s'écrit ici, avec le SDK
// admin : les règles ferment `corps_arbitraux` à toute écriture.
// ============================================

export const dynamic = "force-dynamic";

type Action =
  | "creer" | "renommer" | "inviter" | "annulerInvitation"
  | "repondre" | "retirer" | "quitter" | "dissoudre";

const ACTIONS: Action[] = [
  "creer", "renommer", "inviter", "annulerInvitation", "repondre", "retirer", "quitter", "dissoudre",
];

/** Un trio, deux ou trois assistants de rechange, quelques scoreurs : assez. */
const MEMBRES_MAX = 15;
const EN_PREPARATION = ["pending", "upcoming", "delayed"];
const LIEN = "/corps-arbitral";

const ROLE_LU: Record<RoleDansLeCorps, string> = {
  arbitre: "arbitre assistant",
  scoreur: "scoreur",
};

class Refus extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

const nomValide = (v: unknown): string => {
  const nom = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (nom.length < 3 || nom.length > 40) throw new Refus("Donne-lui un nom de 3 à 40 caractères.", 400);
  return nom;
};

export async function POST(req: Request) {
  const entete = req.headers.get("authorization");
  if (!entete?.startsWith("Bearer ")) return NextResponse.json({ error: "Compte requis" }, { status: 401 });
  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(entete.split("Bearer ")[1])).uid;
  } catch {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }

  const corps = (await req.json().catch(() => ({}))) as {
    action?: unknown; corpsId?: unknown; nom?: unknown; uid?: unknown; role?: unknown; accepte?: unknown;
  };
  const action = corps.action as Action;
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: "Action inconnue" }, { status: 400 });

  try {
    const moi = (await adminDb.collection("users").doc(uid).get()).data();

    if (action === "creer") {
      if (!estArbitreServeur(moi)) throw new Refus("Seul un arbitre crée un corps arbitral.", 403);
      const nom = nomValide(corps.nom);
      const deja = await adminDb.collection("corps_arbitraux").where("chef_id", "==", uid).limit(1).get();
      if (!deja.empty) throw new Refus("Tu diriges déjà un corps arbitral.");
      const ref = adminDb.collection("corps_arbitraux").doc();
      const doc: FirestoreCorpsArbitral = {
        nom,
        chef_id: uid,
        chef_nom: nomDuCompte(moi),
        ville: typeof moi?.location_city === "string" && moi.location_city.trim() ? moi.location_city.trim() : null,
        membres: {},
        membre_ids: [uid],
        invitations: {},
        invite_ids: [],
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      };
      await ref.set(doc);
      return NextResponse.json({ ok: true, id: ref.id });
    }

    const corpsId = typeof corps.corpsId === "string" ? corps.corpsId : "";
    if (!corpsId) throw new Refus("Corps arbitral manquant.", 400);
    const ref = adminDb.collection("corps_arbitraux").doc(corpsId);

    // La cible d'une invitation se vérifie hors transaction : elle ne lit que
    // son profil, qui ne bouge pas avec le corps.
    let cible: { uid: string; nom: string; role: RoleDansLeCorps } | null = null;
    if (action === "inviter") {
      const cibleId = typeof corps.uid === "string" ? corps.uid : "";
      const role = corps.role === "scoreur" ? "scoreur" : corps.role === "arbitre" ? "arbitre" : null;
      if (!cibleId || !role) throw new Refus("Qui inviter, et pour quel rôle ?", 400);
      const d = (await adminDb.collection("users").doc(cibleId).get()).data();
      if (!d || d.is_active === false) throw new Refus("Ce compte n'existe pas.", 404);
      if (role === "arbitre" && !estArbitreServeur(d)) throw new Refus("Ce compte n'est pas arbitre.", 400);
      if (role === "scoreur" && !estScoreurServeur(d)) {
        throw new Refus("Ce compte n'est pas scoreur validé.", 400);
      }
      cible = { uid: cibleId, nom: nomDuCompte(d, "Un membre"), role };
    }

    const r = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Refus("Ce corps arbitral n'existe plus.", 404);
      const c = snap.data() as FirestoreCorpsArbitral;
      const estChef = c.chef_id === uid;
      const maj = (champs: Record<string, unknown>) =>
        tx.update(ref, { ...champs, updated_at: FieldValue.serverTimestamp() });

      switch (action) {
        case "renommer": {
          if (!estChef) throw new Refus("Seul le chef renomme son corps arbitral.", 403);
          maj({ nom: nomValide(corps.nom) });
          return { c };
        }
        case "inviter": {
          if (!estChef) throw new Refus("Seul le chef invite dans son corps arbitral.", 403);
          const t = cible!;
          if (t.uid === c.chef_id) throw new Refus("Tu es déjà le chef de ce corps arbitral.");
          if (c.membres?.[t.uid]) throw new Refus(`${t.nom} fait déjà partie de ton corps arbitral.`);
          if (c.invitations?.[t.uid]) throw new Refus(`${t.nom} est déjà invité.`);
          if (Object.keys(c.membres ?? {}).length + Object.keys(c.invitations ?? {}).length >= MEMBRES_MAX) {
            throw new Refus(`Un corps arbitral compte ${MEMBRES_MAX} membres au plus.`);
          }
          maj({
            [`invitations.${t.uid}`]: { nom: t.nom, role: t.role, le: new Date().toISOString() },
            invite_ids: FieldValue.arrayUnion(t.uid),
          });
          return { c, cible: t };
        }
        case "annulerInvitation": {
          if (!estChef) throw new Refus("Seul le chef retire une invitation.", 403);
          const cibleId = typeof corps.uid === "string" ? corps.uid : "";
          if (!c.invitations?.[cibleId]) throw new Refus("Aucune invitation à retirer.");
          maj({ [`invitations.${cibleId}`]: FieldValue.delete(), invite_ids: FieldValue.arrayRemove(cibleId) });
          return { c };
        }
        case "repondre": {
          const inv = c.invitations?.[uid];
          if (!inv) throw new Refus("Aucune invitation en attente.");
          const accepte = corps.accepte === true;
          maj({
            [`invitations.${uid}`]: FieldValue.delete(),
            invite_ids: FieldValue.arrayRemove(uid),
            ...(accepte
              ? {
                  [`membres.${uid}`]: { nom: nomDuCompte(moi, inv.nom), role: inv.role, depuis: new Date().toISOString() },
                  membre_ids: FieldValue.arrayUnion(uid),
                }
              : {}),
          });
          return { c, accepte, role: inv.role };
        }
        case "retirer":
        case "quitter": {
          const membreId = action === "quitter" ? uid : typeof corps.uid === "string" ? corps.uid : "";
          if (action === "retirer" && !estChef) throw new Refus("Seul le chef retire un membre.", 403);
          if (action === "quitter" && estChef) {
            throw new Refus("Le chef ne quitte pas son corps arbitral : il le dissout.");
          }
          const membre = c.membres?.[membreId];
          if (!membre) throw new Refus("Ce compte ne fait pas partie du corps arbitral.");
          maj({ [`membres.${membreId}`]: FieldValue.delete(), membre_ids: FieldValue.arrayRemove(membreId) });
          return { c, membreId, membreNom: membre.nom };
        }
        case "dissoudre": {
          if (!estChef) throw new Refus("Seul le chef dissout son corps arbitral.", 403);
          tx.delete(ref);
          return { c };
        }
      }
      throw new Refus("Action inconnue", 400);
    });

    // ── Après la transaction : les matchs à venir, puis les notifications ──
    const c = r.c;
    const moiNom = nomDuCompte(moi, "Un membre");
    switch (action) {
      case "inviter": {
        const t = (r as { cible: { uid: string; role: RoleDansLeCorps } }).cible;
        await notifier(t.uid, {
          type: "arbitrage",
          title: "On t'invite dans un corps arbitral",
          body: `${c.chef_nom} t'invite dans « ${c.nom} », comme ${ROLE_LU[t.role]}. Réponds depuis la page Corps arbitral.`,
          link: LIEN,
        });
        break;
      }
      case "repondre": {
        const { accepte, role } = r as { accepte: boolean; role: RoleDansLeCorps };
        await notifier(c.chef_id, {
          type: "arbitrage",
          title: accepte ? "Ton corps arbitral s'agrandit" : "Invitation déclinée",
          body: accepte
            ? `${moiNom} a rejoint « ${c.nom} » comme ${ROLE_LU[role]}.`
            : `${moiNom} ne rejoindra pas « ${c.nom} ».`,
          link: LIEN,
        });
        break;
      }
      case "retirer": {
        const { membreId } = r as { membreId: string };
        await retirerDesMatchsAVenir(corpsId, membreId);
        await notifier(membreId, {
          type: "arbitrage",
          title: "Tu ne fais plus partie d'un corps arbitral",
          body: `${c.chef_nom} t'a retiré de « ${c.nom} ». Les matchs à venir où tu l'accompagnais ont été mis à jour.`,
          link: LIEN,
        });
        break;
      }
      case "quitter": {
        await retirerDesMatchsAVenir(corpsId, uid);
        await notifier(c.chef_id, {
          type: "arbitrage",
          title: "Un membre quitte ton corps arbitral",
          body: `${moiNom} a quitté « ${c.nom} ». Vérifie l'équipe de tes prochains matchs.`,
          link: "/designations",
        });
        break;
      }
      case "dissoudre": {
        await retirerDesMatchsAVenir(corpsId, null);
        await Promise.all(Object.keys(c.membres ?? {}).map((m) => notifier(m, {
          type: "arbitrage",
          title: "Corps arbitral dissous",
          body: `${c.chef_nom} a dissous « ${c.nom} ».`,
          link: LIEN,
        })));
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Refus) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("POST /api/corps-arbitral failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * Retirer un membre (ou tout le monde, `null`) des matchs À VENIR de ce corps.
 *
 * Les matchs joués gardent leur équipe telle qu'elle était : c'est leur
 * histoire. Un match qui se prépare, lui, ne doit pas compter sur quelqu'un
 * qui n'est plus là, ni lui laisser la console.
 */
async function retirerDesMatchsAVenir(corpsId: string, membreId: string | null): Promise<void> {
  const matchs = await adminDb.collection("matches").where("equipe_arbitrale.corps_id", "==", corpsId).get();
  await Promise.all(matchs.docs.map(async (d) => {
    const m = d.data() as FirestoreMatch;
    const e = m.equipe_arbitrale;
    if (!e || !EN_PREPARATION.includes(m.status)) return;
    if (membreId === null) {
      await d.ref.update({ ...champsSansEquipe(m), updated_at: FieldValue.serverTimestamp() });
      return;
    }
    const assistants = (e.assistants ?? []).filter((a) => a.uid !== membreId);
    const perdScoreur = e.scoreur?.uid === membreId;
    if (assistants.length === (e.assistants ?? []).length && !perdScoreur) return;
    const suivante: FirestoreEquipeArbitrale = {
      ...e,
      assistants,
      scoreur: perdScoreur ? null : e.scoreur,
      scoreur_ajoute: perdScoreur ? false : e.scoreur_ajoute ?? false,
    };
    await d.ref.update({
      equipe_arbitrale: suivante,
      equipe_arbitrale_ids: FieldValue.arrayRemove(membreId),
      ...(perdScoreur && e.scoreur_ajoute ? { moderator_ids: FieldValue.arrayRemove(membreId) } : {}),
      updated_at: FieldValue.serverTimestamp(),
    });
  }));
}
