import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/public/team/[id]/manager, le manager d'une équipe, pour
 * l'onglet Composition d'un match.
 *
 * UNE EXCEPTION À LA FICHE PUBLIQUE DE L'ÉQUIPE, ET ELLE EST BORNÉE. Cette
 * fiche ne publie ni `member_ids` ni `manager_id` : on y décrit l'équipe,
 * pas qui la compose. Le manager, lui, en est le visage public — sa propre
 * fiche liste déjà ses équipes —, et une composition sans son entraîneur est
 * incomplète. On publie donc le MANAGER SEUL, et de lui ce que sa fiche
 * montre déjà à tout visiteur : nom, photo, et l'identifiant du lien vers
 * elle. Ni l'effectif, ni le staff, ni rien d'autre du compte.
 *
 * Rien pour une équipe fantôme : c'est l'adversaire hors KoppaFoot qu'un
 * manager a saisi, et son `manager_id` est celui qui l'a créée, pas le sien.
 */

export const revalidate = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ manager: null }, { status: 404 });

  try {
    const equipe = await adminDb.collection("teams").doc(id).get();
    const d = equipe.data();
    const uid = typeof d?.manager_id === "string" ? d.manager_id : "";
    if (!d || d.is_ghost === true || !uid) return NextResponse.json({ manager: null });

    const compte = (await adminDb.collection("users").doc(uid).get()).data();
    if (!compte) return NextResponse.json({ manager: null });

    const nom = [compte.first_name, compte.last_name]
      .filter((x): x is string => typeof x === "string" && x.trim() !== "")
      .join(" ");
    const photo = typeof compte.profile_picture_url === "string" && compte.profile_picture_url
      ? compte.profile_picture_url
      : null;

    return NextResponse.json({ manager: { uid, nom: nom || "Manager", photo } });
  } catch (err) {
    console.error("GET public team manager failed:", err);
    return NextResponse.json({ manager: null }, { status: 500 });
  }
}
