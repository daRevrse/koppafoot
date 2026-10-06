import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { estPro, jourDeLome } from "@/lib/offre";
import { lireDroits, uidAppelant } from "@/lib/offre-server";
import { couleurValide, type FirestoreClub } from "@/lib/clubs";
import { clubDuProprietaire, clubs, estEveille, sectionsDuClub, slugLibre } from "@/lib/clubs-serveur";

/**
 * Le club, côté de celui qui le gère (ou qui y est invité).
 *
 * GET  , ce que l'écran « Mon club » affiche : le Pro, le club qu'on possède
 *        (sections, invitations envoyées), les équipes qu'on gère (pour les
 *        rattacher) et les invitations reçues par ces équipes.
 * POST { nom, ville?, description?, slogan?, couleur? } , créer son club.
 *
 * Créer un club demande KoppaFoot Pro (lib/clubs) ; un compte n'en possède
 * qu'un.
 */

export const dynamic = "force-dynamic";

const texte = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");

export async function GET(req: Request) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const [droits, club, equipes, invites] = await Promise.all([
      lireDroits(uid),
      clubDuProprietaire(uid),
      adminDb.collection("teams").where("manager_id", "==", uid).get(),
      clubs().where("invite_manager_ids", "array-contains", uid).get(),
    ]);
    const mesEquipes = equipes.docs.filter((d) => d.data().is_ghost !== true);

    // Le club de chacune de mes équipes, s'il y en a un (le mien ou un autre).
    const clubsDesEquipes = new Map<string, { id: string; nom: string }>();
    if (mesEquipes.length) {
      const ids = mesEquipes.map((d) => d.id);
      for (let i = 0; i < ids.length; i += 30) {
        const snap = await clubs().where("equipe_ids", "array-contains-any", ids.slice(i, i + 30)).get();
        for (const c of snap.docs) {
          for (const e of (c.data().equipe_ids ?? []) as string[]) clubsDesEquipes.set(e, { id: c.id, nom: c.data().nom });
        }
      }
    }

    const nomsEquipes = new Map(mesEquipes.map((d) => [d.id, String(d.data().name ?? "")]));
    let vueClub = null;
    if (club) {
      const invitations = Object.entries(club.invitations ?? {});
      const equipesInvitees = invitations.length
        ? await adminDb.getAll(...invitations.map(([id]) => adminDb.collection("teams").doc(id)))
        : [];
      vueClub = {
        id: club.id,
        slug: club.slug,
        nom: club.nom,
        ville: club.ville,
        description: club.description,
        slogan: club.slogan,
        logoUrl: club.logo_url,
        banniereUrl: club.banniere_url,
        couleur: club.couleur,
        staff: club.staff ?? [],
        sections: await sectionsDuClub(club),
        invitations: invitations.map(([equipeId, inv], i) => ({
          equipeId,
          libelle: inv.libelle,
          nomEquipe: String(equipesInvitees[i]?.data()?.name ?? "Équipe supprimée"),
        })),
        enSommeil: !(await estEveille(club)),
      };
    }

    const invitationsRecues = invites.docs.flatMap((c) => {
      const data = c.data() as FirestoreClub;
      return Object.entries(data.invitations ?? {})
        .filter(([, inv]) => inv.manager_id === uid)
        .map(([equipeId, inv]) => ({
          clubId: c.id,
          clubNom: data.nom,
          clubSlug: data.slug,
          equipeId,
          equipeNom: nomsEquipes.get(equipeId) ?? "Ton équipe",
          libelle: inv.libelle,
        }));
    });

    return NextResponse.json({
      estPro: estPro(droits, jourDeLome()),
      club: vueClub,
      mesEquipes: mesEquipes.map((d) => ({
        id: d.id,
        nom: String(d.data().name ?? ""),
        logoUrl: (d.data().logo_url as string | undefined) ?? null,
        club: clubsDesEquipes.get(d.id) ?? null,
      })),
      invitationsRecues,
    });
  } catch (err) {
    console.error("GET /api/clubs:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    if (!estPro(await lireDroits(uid), jourDeLome())) {
      return NextResponse.json({ error: "Le Club multi-équipes fait partie de KoppaFoot Pro." }, { status: 403 });
    }
    if (await clubDuProprietaire(uid)) {
      return NextResponse.json({ error: "Tu as déjà un club." }, { status: 409 });
    }
    const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const nom = texte(c.nom, 80);
    if (!nom) return NextResponse.json({ error: "Le nom du club est requis." }, { status: 400 });

    const club: Omit<FirestoreClub, "created_at" | "updated_at"> = {
      nom,
      slug: await slugLibre(nom),
      ville: texte(c.ville, 80) || null,
      description: texte(c.description, 600) || null,
      slogan: texte(c.slogan, 80) || null,
      logo_url: null,
      banniere_url: null,
      couleur: couleurValide(c.couleur),
      proprietaire_id: uid,
      staff: [],
      equipe_ids: [],
      sections: {},
      invitations: {},
      invite_manager_ids: [],
    };
    const ref = await clubs().add({
      ...club,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id, slug: club.slug });
  } catch (err) {
    console.error("POST /api/clubs:", err);
    return NextResponse.json({ error: "La création a échoué." }, { status: 500 });
  }
}
