import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { ficheDuClub } from "@/lib/fiche-club-serveur";
import { dateLue } from "@/lib/admin-tableau";

/**
 * GET /api/admin/equipes/[id], une équipe telle que l'administration doit la
 * voir : LA MÊME FICHE que le public (effectif, bilan, matchs, compétitions),
 * plus ce que seule l'administration lit — le contact du manager, le compte
 * derrière chaque joueur.
 *
 * La page lisait l'équipe avec un convertisseur resté en arrière, dont la
 * date de création n'était pas une chaîne : elle plantait à l'ouverture.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  const { id } = await params;
  try {
    const snap = await adminDb.collection("teams").doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
    const d = snap.data()!;
    const [fiche, manager] = await Promise.all([
      ficheDuClub(id, d),
      d.manager_id ? adminDb.collection("users").doc(String(d.manager_id)).get() : Promise.resolve(null),
    ]);
    const m = manager?.exists ? manager.data() : null;
    return NextResponse.json({
      equipe: {
        id,
        nom: d.name ?? "Équipe",
        ville: d.city ?? "",
        niveau: d.level ?? "",
        logo: d.logo_url ?? null,
        couleur: d.color ?? null,
        recrute: d.is_recruiting === true,
        fantome: d.is_ghost === true,
        description: d.description ?? "",
        slogan: d.slogan ?? "",
        maxMembres: typeof d.max_members === "number" ? d.max_members : 0,
        creeLe: dateLue(d.created_at)?.toISOString() ?? null,
      },
      manager: manager?.exists
        ? {
          uid: manager.id,
          nom: `${m?.first_name ?? ""} ${m?.last_name ?? ""}`.trim() || "Compte sans nom",
          email: m?.email ?? null,
          telephone: m?.phone ?? null,
        }
        : null,
      fiche,
    });
  } catch (err) {
    console.error("GET /api/admin/equipes/[id]", err);
    return NextResponse.json({ error: "Lecture de l'équipe impossible" }, { status: 500 });
  }
}
