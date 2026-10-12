import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { isStaffOf } from "@/lib/competition-api-auth";
import { retirerLeCompte, sansLeLien, type MatchStocke } from "@/lib/fusion-import";
import type { CompPlayer, LinkedCompPlayer } from "@/types";

/**
 * Roster links, the validated tie between a roster line and an account.
 *
 * They are CREATED elsewhere: by the club import (lib/club-import-server) and
 * by an accepted claim (/api/competitions/roster-claims). This route only
 * undoes one, and it undoes all of it, because a link is written in three
 * places: `user_id` on the roster line, a `linked_comp_players` row on the
 * player's own user doc, and the account copied onto the match sheets.
 *
 * Unlinking used to be a plain roster write from the browser, which could only
 * reach the first: the player kept the competition, and the line's stats, in
 * « Mes statistiques ». The other two need the admin SDK, hence the route.
 *
 * DELETE { cid, teamId, playerId }, staff unlinks a line (organizer of the
 *        competition, manager of that team, or superadmin).
 */

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

export async function DELETE(req: NextRequest) {
  try {
    const { cid, teamId, playerId } = (await req.json()) as {
      cid?: string; teamId?: string; playerId?: string;
    };
    if (!cid || !teamId || !playerId) {
      return NextResponse.json({ error: "cid, teamId et playerId requis" }, { status: 400 });
    }

    const callerUid = await callerUidOf(req);
    if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    if (!(await isStaffOf(callerUid, cid, teamId))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const comp = adminDb.collection("competitions").doc(cid);
    const teamRef = comp.collection("comp_teams").doc(teamId);

    // The roster is a single array field, so read-modify-write in a
    // transaction, and the user's row goes in the same one: a line without
    // its account and an account that still claims the line is exactly the
    // state this route exists to end.
    const uid = await adminDb.runTransaction(async (tx) => {
      const teamSnap = await tx.get(teamRef);
      if (!teamSnap.exists) throw new Error("TEAM_NOT_FOUND");
      const players = (teamSnap.data()?.players ?? []) as CompPlayer[];
      const idx = players.findIndex((p) => p.id === playerId);
      if (idx === -1) throw new Error("PLAYER_NOT_FOUND");

      const lie = players[idx].user_id;
      // Already unlinked (a double tap, or someone else got there first):
      // nothing to write, and nothing to complain about.
      if (!lie) return null;

      const userRef = adminDb.collection("users").doc(lie);
      const userSnap = await tx.get(userRef);

      const next = [...players];
      next[idx] = { ...players[idx], user_id: null };
      tx.update(teamRef, { players: next, updated_at: FieldValue.serverTimestamp() });

      // A deleted account leaves its uid on the line: the line is still freed.
      if (userSnap.exists) {
        const liens = (userSnap.data()?.linked_comp_players ?? []) as LinkedCompPlayer[];
        const gardes = sansLeLien(liens, { cid, teamId, playerId });
        if (gardes.length !== liens.length) {
          tx.update(userRef, { linked_comp_players: gardes, updated_at: FieldValue.serverTimestamp() });
        }
      }
      return lie;
    });

    // Les feuilles des matchs déjà écrits portent encore le compte (voir
    // `retirerLeCompte`). Après la transaction, et sans la conditionner : la
    // ligne est déliée, une feuille qui résiste ne la relie pas. Une
    // transaction par match, relu à l'instant, parce que la console peut être
    // en train d'écrire la feuille.
    if (uid) {
      const [chezElle, enFace] = await Promise.all([
        comp.collection("comp_matches").where("home_team_id", "==", teamId).get(),
        comp.collection("comp_matches").where("away_team_id", "==", teamId).get(),
      ]);
      const concernes = [...chezElle.docs, ...enFace.docs].filter(
        (d) => retirerLeCompte(d.data() as MatchStocke, playerId, uid),
      );
      await Promise.all(concernes.map((d) =>
        adminDb.runTransaction(async (tx) => {
          const frais = await tx.get(d.ref);
          if (!frais.exists) return;
          const patch = retirerLeCompte(frais.data() as MatchStocke, playerId, uid);
          if (patch) tx.update(d.ref, patch);
        }).catch((e) => console.warn("[roster-links] feuille non mise à jour", d.id, e)),
      ));
    }

    return NextResponse.json({ ok: true, unlinked: !!uid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "PLAYER_NOT_FOUND" || message === "TEAM_NOT_FOUND") {
      return NextResponse.json({ error: "Joueur ou équipe introuvable" }, { status: 404 });
    }
    console.error("[roster-links DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
