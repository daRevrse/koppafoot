import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { uidAppelant } from "@/lib/offre-server";
import { couleurValide, staffValide } from "@/lib/clubs";
import { clubs, estEveille, lireClub } from "@/lib/clubs-serveur";
import { effacerVisuels, stockerVisuel, type VisuelEnvoye } from "@/lib/visuel-serveur";

/**
 * Un club, par son propriétaire.
 *
 * PATCH  { nom?, ville?, description?, slogan?, couleur?, staff?,
 *          logo?, retirerLogo?, banniere?, retirerBanniere? } , le modifier.
 * DELETE , le dissoudre : ses équipes redeviennent autonomes, rien d'autre
 *          ne bouge (aucune donnée d'équipe ne vit dans le club).
 *
 * Modifier demande un club éveillé, donc le Pro ; dissoudre se fait toujours.
 */

export const dynamic = "force-dynamic";

const texte = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const maj: Record<string, unknown> = { updated_at: FieldValue.serverTimestamp() };
    if (c.nom !== undefined) {
      const nom = texte(c.nom, 80);
      if (!nom) return NextResponse.json({ error: "Le nom du club est requis." }, { status: 400 });
      maj.nom = nom;
    }
    if (c.ville !== undefined) maj.ville = texte(c.ville, 80) || null;
    if (c.description !== undefined) maj.description = texte(c.description, 600) || null;
    if (c.slogan !== undefined) maj.slogan = texte(c.slogan, 80) || null;
    if (c.couleur !== undefined) maj.couleur = couleurValide(c.couleur);
    if (c.staff !== undefined) maj.staff = staffValide(c.staff);

    for (const [champ, cle, retirer] of [["logo", "logo_url", "retirerLogo"], ["banniere", "banniere_url", "retirerBanniere"]] as const) {
      const image = c[champ] as VisuelEnvoye | null | undefined;
      if (image?.data) {
        const url = await stockerVisuel(`clubs/${id}/${champ}-`, image, `clubs/${id}/${champ}-`);
        if (typeof url !== "string") return NextResponse.json({ error: url.erreur }, { status: 400 });
        maj[cle] = url;
      } else if (c[retirer] === true) {
        await effacerVisuels(`clubs/${id}/${champ}-`);
        maj[cle] = null;
      }
    }

    await clubs().doc(id).update(maj);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/clubs/[id]:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const { id } = await params;
    const club = await lireClub(id);
    if (!club) return NextResponse.json({ error: "Club introuvable" }, { status: 404 });
    if (club.proprietaire_id !== uid) return NextResponse.json({ error: "Ce club n'est pas le tien." }, { status: 403 });
    await effacerVisuels(`clubs/${id}/`);
    await clubs().doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/clubs/[id]:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
