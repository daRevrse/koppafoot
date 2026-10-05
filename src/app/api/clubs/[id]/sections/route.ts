import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { uidAppelant } from "@/lib/offre-server";
import { notifierCompte } from "@/lib/notifier-serveur";
import { MAX_SECTIONS, equipeDepuisSaisie, libelleValide, type FirestoreClub } from "@/lib/clubs";
import { clubDeLEquipeBrut, clubs, estEveille, lireClub } from "@/lib/clubs-serveur";

/**
 * Les sections d'un club : les équipes qu'il réunit.
 *
 * POST   { equipe, libelle } , le propriétaire ajoute une équipe. La sienne est
 *          rattachée tout de suite ; celle d'un autre manager reçoit une
 *          invitation. Sur une section déjà là, change son libellé.
 * PATCH  { equipeId }        , le manager invité accepte.
 * DELETE { equipeId }        , retirer : le propriétaire (une section, une
 *          invitation) ou le manager de l'équipe (sortir du club, refuser).
 *
 * Ajouter et accepter demandent un club éveillé ; retirer se fait toujours :
 * personne ne reste attaché à un club qui dort.
 */

export const dynamic = "force-dynamic";

const equipe = (id: string) => adminDb.collection("teams").doc(id);

/** Les managers encore invités, une fois une invitation retirée. */
function invitesRestants(club: FirestoreClub, sauf: string): string[] {
  return [...new Set(Object.entries(club.invitations ?? {})
    .filter(([id]) => id !== sauf)
    .map(([, inv]) => inv.manager_id))];
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const { id } = await params;
    const club = await lireClub(id);
    if (!club) return NextResponse.json({ error: "Club introuvable" }, { status: 404 });
    if (club.proprietaire_id !== uid) return NextResponse.json({ error: "Ce club n'est pas le tien." }, { status: 403 });
    if (!(await estEveille(club))) {
      return NextResponse.json({ error: "Ton club est en sommeil : il revit avec KoppaFoot Pro." }, { status: 403 });
    }

    const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const equipeId = equipeDepuisSaisie(c.equipe);
    const libelle = libelleValide(c.libelle);
    if (!equipeId) return NextResponse.json({ error: "Colle l'adresse de la fiche de l'équipe." }, { status: 400 });
    if (!libelle) return NextResponse.json({ error: "Donne un nom à la section : « Seniors », « U17 »…" }, { status: 400 });

    // Déjà une section : on change seulement son libellé.
    if (club.equipe_ids.includes(equipeId)) {
      await clubs().doc(id).update({ [`sections.${equipeId}`]: libelle, updated_at: FieldValue.serverTimestamp() });
      return NextResponse.json({ ok: true, etat: "section" });
    }

    const snap = await equipe(equipeId).get();
    if (!snap.exists || snap.data()!.is_ghost === true) {
      return NextResponse.json({ error: "Aucune équipe ne correspond à cette adresse." }, { status: 404 });
    }
    const autre = await clubDeLEquipeBrut(equipeId);
    if (autre && autre.id !== id) {
      return NextResponse.json({ error: "Cette équipe est déjà une section d'un autre club." }, { status: 409 });
    }
    if (club.equipe_ids.length + Object.keys(club.invitations ?? {}).length >= MAX_SECTIONS) {
      return NextResponse.json({ error: `Un club réunit ${MAX_SECTIONS} équipes au plus.` }, { status: 400 });
    }

    const managerId = String(snap.data()!.manager_id ?? "");
    if (managerId === uid) {
      await clubs().doc(id).update({
        equipe_ids: FieldValue.arrayUnion(equipeId),
        [`sections.${equipeId}`]: libelle,
        [`invitations.${equipeId}`]: FieldValue.delete(),
        updated_at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, etat: "section" });
    }

    // L'équipe d'un autre manager : il décide.
    await clubs().doc(id).update({
      [`invitations.${equipeId}`]: { libelle, manager_id: managerId, le: new Date().toISOString() },
      invite_manager_ids: FieldValue.arrayUnion(managerId),
      updated_at: FieldValue.serverTimestamp(),
    });
    await notifierCompte(managerId, {
      type: "invitation",
      title: `${club.nom} invite ton équipe`,
      body: `« ${snap.data()!.name} » rejoindrait le club comme section ${libelle}. À toi de décider.`,
      link: "/mon-club",
    });
    return NextResponse.json({ ok: true, etat: "invitation" });
  } catch (err) {
    console.error("POST /api/clubs/[id]/sections:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const { id } = await params;
    const { equipeId } = (await req.json().catch(() => ({}))) as { equipeId?: string };
    const club = await lireClub(id);
    if (!club || !equipeId) return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
    const invitation = club.invitations?.[equipeId];
    if (!invitation) return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });

    const snap = await equipe(equipeId).get();
    if (!snap.exists || snap.data()!.manager_id !== uid) {
      return NextResponse.json({ error: "Seul le manager de l'équipe peut accepter." }, { status: 403 });
    }
    if (!(await estEveille(club))) {
      return NextResponse.json({ error: "Ce club est en sommeil, il n'accueille personne pour l'instant." }, { status: 409 });
    }
    const autre = await clubDeLEquipeBrut(equipeId);
    if (autre && autre.id !== id) {
      return NextResponse.json({ error: "Ton équipe est déjà une section d'un autre club. Sors-en d'abord." }, { status: 409 });
    }

    await clubs().doc(id).update({
      equipe_ids: FieldValue.arrayUnion(equipeId),
      [`sections.${equipeId}`]: invitation.libelle,
      [`invitations.${equipeId}`]: FieldValue.delete(),
      invite_manager_ids: invitesRestants(club, equipeId),
      updated_at: FieldValue.serverTimestamp(),
    });
    await notifierCompte(club.proprietaire_id, {
      type: "invitation",
      title: "Nouvelle section",
      body: `« ${snap.data()!.name} » a rejoint ${club.nom} (${invitation.libelle}).`,
      link: "/mon-club",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/clubs/[id]/sections:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const { id } = await params;
    const { equipeId } = (await req.json().catch(() => ({}))) as { equipeId?: string };
    const club = await lireClub(id);
    if (!club || !equipeId) return NextResponse.json({ error: "Section introuvable" }, { status: 404 });
    const estSection = club.equipe_ids.includes(equipeId);
    const estInvitee = Boolean(club.invitations?.[equipeId]);
    if (!estSection && !estInvitee) return NextResponse.json({ error: "Section introuvable" }, { status: 404 });

    if (club.proprietaire_id !== uid) {
      const snap = await equipe(equipeId).get();
      if (!snap.exists || snap.data()!.manager_id !== uid) {
        return NextResponse.json({ error: "Réservé au club ou au manager de l'équipe." }, { status: 403 });
      }
    }

    await clubs().doc(id).update({
      equipe_ids: FieldValue.arrayRemove(equipeId),
      [`sections.${equipeId}`]: FieldValue.delete(),
      [`invitations.${equipeId}`]: FieldValue.delete(),
      invite_manager_ids: invitesRestants(club, equipeId),
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/clubs/[id]/sections:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
