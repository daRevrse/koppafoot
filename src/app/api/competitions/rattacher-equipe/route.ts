import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { uidAppelant } from "@/lib/appelant";
import { lireRattachement } from "@/lib/rattachement-equipe";
import { appliquerRattachement, verifierRattachement } from "@/lib/rattachement-serveur";

/**
 * POST /api/competitions/rattacher-equipe { cid, teamId, rattacher }
 *
 * Rattacher après coup une équipe de compétition déjà reprise aux équipes de
 * son manager (lib/rattachement-equipe) : `rattacher` vaut « nouvelle » ou
 * l'identifiant d'une de ses équipes. C'est ce que fait désormais
 * l'acceptation d'une invitation ; cette route rattrape les équipes reprises
 * avant, qui n'étaient liées à rien.
 *
 * Le manager de l'équipe de compétition seulement, et tant qu'elle n'est
 * liée à rien : relier une équipe déjà liée passe par l'import de l'effectif
 * (« Resynchroniser »), qui confirme chaque joueur.
 */
export async function POST(req: Request) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const c = (await req.json().catch(() => ({}))) as { cid?: unknown; teamId?: unknown; rattacher?: unknown };
  const cid = typeof c.cid === "string" ? c.cid : "";
  const teamId = typeof c.teamId === "string" ? c.teamId : "";
  const rattachement = lireRattachement(c.rattacher);
  if (!cid || !teamId || !rattachement || rattachement.type === "aucun") {
    return NextResponse.json({ error: "Demande illisible" }, { status: 400 });
  }

  try {
    const snap = await adminDb.collection("competitions").doc(cid).collection("comp_teams").doc(teamId).get();
    if (!snap.exists) return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
    const equipe = snap.data() ?? {};
    if (equipe.claimed_by_manager_id !== uid) {
      return NextResponse.json({ error: "Tu ne diriges pas cette équipe." }, { status: 403 });
    }
    if (equipe.claimed_by_team_id) {
      return NextResponse.json({ error: "Cette équipe est déjà liée à une des tiennes." }, { status: 409 });
    }
    const refus = await verifierRattachement(uid, rattachement);
    if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });
    const equipeId = await appliquerRattachement(uid, cid, teamId, rattachement);
    return NextResponse.json({ ok: true, equipeId });
  } catch (err) {
    console.error("POST /api/competitions/rattacher-equipe", err);
    return NextResponse.json({ error: "Le rattachement a échoué." }, { status: 500 });
  }
}
