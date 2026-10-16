import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { apercuImport, importClubRoster } from "@/lib/club-import-server";
import { ImportRefuse, type Correspondances } from "@/lib/fusion-import";
import type { FirestoreCompetition } from "@/types";
import { peutConfigurer } from "@/lib/competition-api-auth";

/**
 * Import a manager's club squad into their competition team.
 *
 * The copy itself lives in lib/club-import-server so that accepting a
 * registration lands a squad in exactly the same state. This route only
 * carries the authorization: the caller must run BOTH sides, their own club
 * into their own competition team, unless they configure that competition
 * (organizer, moderator) or are a superadmin acting on a manager's behalf.
 *
 * GET  ?cid&teamId&clubId                       , l'aperçu : qui arrive, et quelle
 *                                                 ligne déjà saisie chacun peut reprendre.
 * POST { cid, teamId, clubId, correspondances? }, l'import, avec ce que le manager a confirmé.
 */

async function autoriser(
  req: NextRequest,
  ids: { cid?: string | null; teamId?: string | null; clubId?: string | null },
): Promise<
  | { error: NextResponse }
  | { cid: string; teamId: string; clubId: string; competition: FirestoreCompetition }
> {
  const { cid, teamId, clubId } = ids;
  if (!cid || !teamId || !clubId) {
    return { error: NextResponse.json({ error: "cid, teamId et clubId requis" }, { status: 400 }) };
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  }
  let callerUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    callerUid = decoded.uid;
  } catch {
    return { error: NextResponse.json({ error: "Token invalide" }, { status: 401 }) };
  }

  const compSnap = await adminDb.collection("competitions").doc(cid).get();
  if (!compSnap.exists) {
    return { error: NextResponse.json({ error: "Compétition introuvable" }, { status: 404 }) };
  }
  const competition = compSnap.data() as FirestoreCompetition;

  const [teamSnap, clubSnap] = await Promise.all([
    adminDb.collection("competitions").doc(cid).collection("comp_teams").doc(teamId).get(),
    adminDb.collection("teams").doc(clubId).get(),
  ]);
  if (!teamSnap.exists) {
    return { error: NextResponse.json({ error: "Équipe de compétition introuvable" }, { status: 404 }) };
  }
  if (!clubSnap.exists) {
    return { error: NextResponse.json({ error: "Club introuvable" }, { status: 404 }) };
  }

  const isTeamManager = teamSnap.data()?.claimed_by_manager_id === callerUid;
  const isClubManager = clubSnap.data()?.manager_id === callerUid;
  if (!((isTeamManager && isClubManager) || await peutConfigurer(callerUid, competition))) {
    return { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  }

  return { cid, teamId, clubId, competition };
}

/** Ce que le navigateur a confirmé, relu : des identifiants, rien d'autre. */
function lireCorrespondances(x: unknown): Correspondances | null {
  if (x === undefined || x === null) return {};
  if (typeof x !== "object" || Array.isArray(x)) return null;
  const entrees = Object.entries(x as Record<string, unknown>);
  if (entrees.length > 500) return null;
  const lues: Correspondances = {};
  for (const [cle, ligne] of entrees) {
    if (ligne !== null && (typeof ligne !== "string" || ligne.length === 0 || ligne.length > 128)) return null;
    lues[cle] = ligne;
  }
  return lues;
}

function erreur(err: unknown, ou: string): NextResponse {
  if (err instanceof ImportRefuse) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  const message = err instanceof Error ? err.message : "";
  if (message === "TEAM_NOT_FOUND" || message === "CLUB_NOT_FOUND") {
    return NextResponse.json({ error: "Équipe ou club introuvable" }, { status: 404 });
  }
  console.error(`[club-import ${ou}]`, err);
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const acces = await autoriser(req, { cid: q.get("cid"), teamId: q.get("teamId"), clubId: q.get("clubId") });
    if ("error" in acces) return acces.error;
    return NextResponse.json(await apercuImport(acces));
  } catch (err) {
    return erreur(err, "GET");
  }
}

export async function POST(req: NextRequest) {
  try {
    const corps = (await req.json()) as {
      cid?: string; teamId?: string; clubId?: string; correspondances?: unknown;
    };
    const acces = await autoriser(req, corps);
    if ("error" in acces) return acces.error;

    const correspondances = lireCorrespondances(corps.correspondances);
    if (!correspondances) {
      return NextResponse.json({ error: "Correspondances invalides" }, { status: 400 });
    }

    const result = await importClubRoster({ ...acces, correspondances });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return erreur(err, "POST");
  }
}
