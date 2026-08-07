import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { importClubRoster } from "@/lib/club-import-server";
import type { FirestoreCompetition } from "@/types";

/**
 * Competition registrations — a manager enters their club in a competition
 * that is open for entries.
 *
 * This is the mirror of team_manager_invites: there, an organizer hands an
 * EXISTING competition team to a manager. Here the manager comes first and
 * brings their own club. Accepting creates the competition team from the
 * club and imports its squad, so a manager who was already running a roster
 * does not type it a second time.
 *
 * The `competition_registrations` collection is admin-SDK only: clients
 * always go through this route, so no Firestore rules are needed.
 *
 * POST   { cid, clubId, message? }      — apply.
 * GET    ?cid=...                       — pending entries (organizer).
 * GET    ?mine=1                        — the caller's own entries.
 * PATCH  { id, action: accept|reject }  — organizer decision.
 * DELETE { id }                         — the manager withdraws.
 */

// Clubs store a colour NAME ("emerald"); competition teams store a hex, and
// the organizer's edit form feeds it to <input type="color">, which silently
// falls back to black on anything else. Translate rather than copy.
const CLUB_COLOR_HEX: Record<string, string> = {
  emerald: "#10b981",
  blue: "#3b82f6",
  red: "#ef4444",
  amber: "#f59e0b",
  purple: "#8b5cf6",
  orange: "#f97316",
};

function toHex(clubColor: unknown): string {
  if (typeof clubColor === "string") {
    if (/^#[0-9a-f]{6}$/i.test(clubColor)) return clubColor;
    const mapped = CLUB_COLOR_HEX[clubColor.toLowerCase()];
    if (mapped) return mapped;
  }
  return "#10b981";
}

async function callerUidOf(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

function toJson(id: string, x: FirebaseFirestore.DocumentData) {
  return {
    id,
    competitionId: x.competition_id,
    competitionName: x.competition_name ?? "",
    competitionSlug: x.competition_slug ?? "",
    clubId: x.club_id,
    clubName: x.club_name ?? "",
    clubCity: x.club_city ?? "",
    clubLogo: x.club_logo ?? null,
    managerId: x.manager_id,
    managerName: x.manager_name ?? "",
    message: x.message ?? "",
    status: x.status ?? "pending",
    createdAt: x.created_at?.toDate?.()?.toISOString() ?? null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { cid, clubId, message } = (await req.json()) as {
      cid?: string; clubId?: string; message?: string;
    };
    if (!cid || !clubId) {
      return NextResponse.json({ error: "cid et clubId requis" }, { status: 400 });
    }

    const callerUid = await callerUidOf(req);
    if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const [compSnap, clubSnap] = await Promise.all([
      adminDb.collection("competitions").doc(cid).get(),
      adminDb.collection("teams").doc(clubId).get(),
    ]);
    if (!compSnap.exists) {
      return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    }
    if (!clubSnap.exists) {
      return NextResponse.json({ error: "Club introuvable" }, { status: 404 });
    }
    const competition = compSnap.data() as FirestoreCompetition;
    const club = clubSnap.data()!;

    if (club.manager_id !== callerUid) {
      return NextResponse.json({ error: "Ce club n'est pas le tien." }, { status: 403 });
    }
    // Entries are only open at the "registration" stage: once fixtures are
    // generated, adding a team would break the schedule.
    if (competition.status !== "registration") {
      return NextResponse.json(
        { error: "Les inscriptions ne sont pas ouvertes pour cette compétition." },
        { status: 409 },
      );
    }

    const existing = await adminDb
      .collection("competition_registrations")
      .where("competition_id", "==", cid)
      .where("club_id", "==", clubId)
      .get();
    const blocking = existing.docs.find((d) => ["pending", "accepted"].includes(d.data().status));
    if (blocking) {
      return NextResponse.json(
        {
          error:
            blocking.data().status === "accepted"
              ? "Ton équipe est déjà inscrite à cette compétition."
              : "Ta demande est déjà en attente.",
        },
        { status: 409 },
      );
    }

    const callerDoc = await adminDb.collection("users").doc(callerUid).get();
    const c = callerDoc.data();
    const managerName = `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || "Un manager";

    const ref = await adminDb.collection("competition_registrations").add({
      competition_id: cid,
      competition_name: competition.name,
      competition_slug: competition.slug,
      club_id: clubId,
      club_name: club.name ?? "",
      club_city: club.city ?? "",
      club_logo: club.logo_url ?? null,
      manager_id: callerUid,
      manager_name: managerName,
      message: (message ?? "").trim(),
      status: "pending",
      created_at: FieldValue.serverTimestamp(),
    });

    // Awaited: this runs as a serverless function, so a promise still in
    // flight when the response returns is dropped when the instance freezes.
    await Promise.allSettled(
      (competition.organizer_ids ?? []).map((uid) =>
        adminDb.collection("notifications").add({
          user_id: uid,
          type: "join_request",
          title: "Nouvelle inscription",
          body: `${managerName} inscrit « ${club.name} » à ${competition.name}`,
          link: `/organizer/competitions/${cid}/teams`,
          read: false,
          created_at: FieldValue.serverTimestamp(),
        }),
      ),
    );

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    console.error("[registrations POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const callerUid = await callerUidOf(req);
    if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    if (req.nextUrl.searchParams.get("mine")) {
      const snap = await adminDb
        .collection("competition_registrations")
        .where("manager_id", "==", callerUid)
        .get();
      return NextResponse.json({ registrations: snap.docs.map((d) => toJson(d.id, d.data())) });
    }

    const cid = req.nextUrl.searchParams.get("cid");
    if (!cid) return NextResponse.json({ error: "cid ou mine requis" }, { status: 400 });

    const compSnap = await adminDb.collection("competitions").doc(cid).get();
    if (!compSnap.exists) {
      return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    }
    const competition = compSnap.data() as FirestoreCompetition;
    if (!(competition.organizer_ids ?? []).includes(callerUid)) {
      const callerDoc = await adminDb.collection("users").doc(callerUid).get();
      if (callerDoc.data()?.user_type !== "superadmin") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const snap = await adminDb
      .collection("competition_registrations")
      .where("competition_id", "==", cid)
      .where("status", "==", "pending")
      .get();
    return NextResponse.json({ registrations: snap.docs.map((d) => toJson(d.id, d.data())) });
  } catch (err) {
    console.error("[registrations GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, action } = (await req.json()) as { id?: string; action?: string };
    if (!id || (action !== "accept" && action !== "reject")) {
      return NextResponse.json({ error: "id et action (accept|reject) requis" }, { status: 400 });
    }

    const callerUid = await callerUidOf(req);
    if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const regRef = adminDb.collection("competition_registrations").doc(id);
    const regSnap = await regRef.get();
    if (!regSnap.exists) {
      return NextResponse.json({ error: "Inscription introuvable" }, { status: 404 });
    }
    const reg = regSnap.data()!;
    if (reg.status !== "pending") {
      return NextResponse.json({ error: "Inscription déjà traitée" }, { status: 409 });
    }

    const compSnap = await adminDb.collection("competitions").doc(reg.competition_id).get();
    if (!compSnap.exists) {
      return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    }
    const competition = compSnap.data() as FirestoreCompetition;
    if (!(competition.organizer_ids ?? []).includes(callerUid)) {
      const callerDoc = await adminDb.collection("users").doc(callerUid).get();
      if (callerDoc.data()?.user_type !== "superadmin") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    if (action === "reject") {
      await regRef.update({ status: "rejected", decided_by: callerUid });
      await adminDb.collection("notifications").add({
        user_id: reg.manager_id,
        type: "join_request",
        title: "Inscription refusée",
        body: `L'inscription de « ${reg.club_name} » à ${reg.competition_name} n'a pas été retenue.`,
        link: "/mon-equipe",
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true });
    }

    // ── Accept: create the competition team from the club, then import ──
    const clubSnap = await adminDb.collection("teams").doc(reg.club_id).get();
    if (!clubSnap.exists) {
      return NextResponse.json({ error: "Le club n'existe plus." }, { status: 404 });
    }
    const club = clubSnap.data()!;

    const teamRef = adminDb
      .collection("competitions").doc(reg.competition_id)
      .collection("comp_teams").doc();
    await teamRef.set({
      name: club.name ?? "",
      short_name: (club.name ?? "").slice(0, 3).toUpperCase(),
      logo_url: club.logo_url ?? null,
      color: toHex(club.color),
      group: null,
      players: [],
      claimed_by_manager_id: reg.manager_id,
      claimed_by_team_id: reg.club_id,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    const imported = await importClubRoster({
      cid: reg.competition_id,
      teamId: teamRef.id,
      clubId: reg.club_id,
      competition,
    });

    await regRef.update({ status: "accepted", decided_by: callerUid, comp_team_id: teamRef.id });

    await adminDb.collection("notifications").add({
      user_id: reg.manager_id,
      type: "join_request",
      title: "Inscription acceptée",
      body: `« ${reg.club_name} » participe à ${reg.competition_name}. Ton effectif a été repris.`,
      link: `/mon-equipe/${reg.competition_id}/${teamRef.id}`,
      read: false,
      created_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, teamId: teamRef.id, ...imported });
  } catch (err) {
    console.error("[registrations PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const callerUid = await callerUidOf(req);
    if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const regRef = adminDb.collection("competition_registrations").doc(id);
    const regSnap = await regRef.get();
    if (!regSnap.exists) {
      return NextResponse.json({ error: "Inscription introuvable" }, { status: 404 });
    }
    const reg = regSnap.data()!;
    if (reg.manager_id !== callerUid) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (reg.status !== "pending") {
      return NextResponse.json({ error: "Inscription déjà traitée" }, { status: 409 });
    }

    await regRef.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[registrations DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
