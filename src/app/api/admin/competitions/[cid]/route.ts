import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { dateLue } from "@/lib/admin-tableau";
import { toCompetition, toCompMatch, toCompTeam } from "@/lib/competition-mappers";
import type { FirestoreCompetition, FirestoreCompMatch, FirestoreCompTeam } from "@/types";

/**
 * GET /api/admin/competitions/[cid], une compétition telle que
 * l'administration doit la voir.
 *
 * La liste de l'administration ne menait qu'à la page publique : on y voyait
 * ce que voit un supporter, rien de ce qu'il faut pour décider de la valider
 * ou pour aider son organisateur — qui la tient, comment le joindre, quelles
 * équipes ont demandé à entrer, où en est le calendrier.
 *
 * Lu avec le SDK admin : les comptes (contacts des organisateurs et des
 * managers) sont fermés aux règles, et un brouillon n'est pas public.
 */
export const dynamic = "force-dynamic";

type Compte = { uid: string; nom: string; email: string | null; telephone: string | null };

async function comptes(uids: string[]): Promise<Map<string, Compte>> {
  const uniques = [...new Set(uids.filter(Boolean))];
  const r = new Map<string, Compte>();
  if (uniques.length === 0) return r;
  const docs = await adminDb.getAll(...uniques.map((uid) => adminDb.collection("users").doc(uid)));
  for (const d of docs) {
    if (!d.exists) continue;
    const u = d.data()!;
    r.set(d.id, {
      uid: d.id,
      nom: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Compte sans nom",
      email: typeof u.email === "string" ? u.email : null,
      telephone: typeof u.phone === "string" ? u.phone : null,
    });
  }
  return r;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  const { cid } = await params;
  try {
    const ref = adminDb.collection("competitions").doc(cid);
    const [snap, equipesSnap, matchsSnap, inscriptionsSnap] = await Promise.all([
      ref.get(),
      ref.collection("comp_teams").get(),
      ref.collection("comp_matches").get(),
      adminDb.collection("competition_registrations").where("competition_id", "==", cid).get(),
    ]);
    if (!snap.exists) return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });

    const competition = toCompetition(snap.id, snap.data() as FirestoreCompetition);
    const equipes = equipesSnap.docs.map((d) => toCompTeam(d.id, cid, d.data() as FirestoreCompTeam));
    const matchs = matchsSnap.docs
      .map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch))
      .sort((a, b) => `${a.date ?? "9999"} ${a.time ?? ""}`.localeCompare(`${b.date ?? "9999"} ${b.time ?? ""}`));
    const inscriptions = inscriptionsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }));

    const parUid = await comptes([
      ...competition.organizerIds,
      ...competition.moderatorIds,
      ...equipes.map((e) => e.claimedByManagerId ?? ""),
      ...inscriptions.map((i) => String(i.manager_id ?? "")),
    ]);

    return NextResponse.json({
      competition,
      creeLe: dateLue(snap.get("created_at"))?.toISOString() ?? null,
      organisateurs: competition.organizerIds.map((uid) => parUid.get(uid) ?? { uid, nom: "Compte supprimé", email: null, telephone: null }),
      moderateurs: competition.moderatorIds.map((uid) => parUid.get(uid) ?? { uid, nom: "Compte supprimé", email: null, telephone: null }),
      equipes: equipes
        .sort((a, b) => (a.group ?? "~").localeCompare(b.group ?? "~") || a.name.localeCompare(b.name))
        .map((e) => ({
          id: e.id,
          nom: e.name,
          logo: e.logoUrl,
          groupe: e.group,
          joueurs: e.players.length,
          disqualifiee: e.disqualified,
          club: e.claimedByTeamId,
          manager: e.claimedByManagerId ? parUid.get(e.claimedByManagerId) ?? null : null,
        })),
      inscriptions: inscriptions
        .map((i) => ({
          id: i.id,
          club: String(i.club_name ?? ""),
          clubId: String(i.club_id ?? ""),
          ville: String(i.club_city ?? ""),
          statut: String(i.status ?? "pending"),
          frais: typeof i.fee_amount === "number" ? i.fee_amount : null,
          fraisStatut: String(i.fee_status ?? ""),
          manager: parUid.get(String(i.manager_id ?? "")) ?? null,
          creeLe: dateLue(i.created_at)?.toISOString() ?? null,
        }))
        .sort((a, b) => (b.creeLe ?? "").localeCompare(a.creeLe ?? "")),
      matchs: matchs.map((m) => ({
        id: m.id,
        date: m.date,
        heure: m.time,
        statut: m.status,
        phase: m.stage,
        groupe: m.group,
        tour: m.round,
        domicile: m.homeTeamName,
        exterieur: m.awayTeamName,
        scoreDomicile: m.scoreHome,
        scoreExterieur: m.scoreAway,
        terrain: m.venueName ?? null,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/competitions/[cid]", err);
    return NextResponse.json({ error: "Lecture de la compétition impossible" }, { status: 500 });
  }
}
