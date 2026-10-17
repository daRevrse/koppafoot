import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { uidAppelant } from "@/lib/appelant";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { isStaffOf } from "@/lib/competition-api-auth";
import { grantCoversMatch, toStaffGrant } from "@/lib/staff-scope";
import {
  estLigneDossard, lignesDeSecours, lireNumeros, renommerDansLeMatch, type MatchARenommer,
} from "@/lib/dossards";
import type { CompPlayer, FirestoreCompMatch, FirestoreCompetition, FirestoreStaffGrant } from "@/types";

// ============================================
// La feuille de secours au dossard (voir lib/dossards).
//
// POST  { cid, mid, side, numeros } , les dossards que le scoreur a mis sur
//                                     la feuille entrent dans l'effectif de
//                                     l'équipe. Seulement ceux-là : vingt-cinq
//                                     lignes à chaque match encombreraient
//                                     l'effectif pour rien.
// PATCH { cid, teamId, playerId, nom } , l'équipe nomme un dossard : la ligne
//                                     change de nom ET d'identifiant, et chaque
//                                     match de la compétition qui la désigne
//                                     est réécrit dans la même transaction.
//
// PAR LE SERVEUR, parce que le scoreur peut tenir la console avec un simple
// code d'accès : les règles lui ouvrent le match, pas l'effectif de l'équipe.
// ============================================

const cote = (x: unknown): "home" | "away" | null => (x === "home" || x === "away" ? x : null);

/**
 * Peut écrire la feuille de ce camp : le staff de la compétition, le manager
 * de l'équipe, ou un code d'accès qui couvre ce match — exactement ceux à qui
 * les règles ouvrent la console (voir firestore.rules, comp_matches).
 */
async function peutTenirLaFeuille(
  uid: string,
  cid: string,
  competition: FirestoreCompetition,
  mid: string,
  match: FirestoreCompMatch,
  equipe: { claimed_by_manager_id?: string | null } | undefined,
): Promise<boolean> {
  if ((competition.organizer_ids ?? []).includes(uid)) return true;
  if ((competition.moderator_ids ?? []).includes(uid)) return true;
  if (equipe?.claimed_by_manager_id === uid) return true;

  const grant = await adminDb.collection("competitions").doc(cid).collection("staff_grants").doc(uid).get();
  if (grant.exists && grantCoversMatch(
    toStaffGrant(grant.data() as FirestoreStaffGrant),
    { id: mid, stage: match.stage, group: match.group },
  )) {
    return true;
  }

  const profil = await adminDb.collection("users").doc(uid).get();
  return profil.exists && estSuperadmin(profil.data());
}

export async function POST(req: Request) {
  try {
    const uid = await uidAppelant(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const corps = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const cid = typeof corps.cid === "string" ? corps.cid : "";
    const mid = typeof corps.mid === "string" ? corps.mid : "";
    const side = cote(corps.side);
    const numeros = lireNumeros(corps.numeros);
    if (!cid || !mid || !side || !numeros) {
      return NextResponse.json({ error: "cid, mid, side et numeros (1 à 25) requis" }, { status: 400 });
    }

    const compRef = adminDb.collection("competitions").doc(cid);
    const [compSnap, matchSnap] = await Promise.all([
      compRef.get(),
      compRef.collection("comp_matches").doc(mid).get(),
    ]);
    if (!compSnap.exists || !matchSnap.exists) {
      return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
    }
    const competition = compSnap.data() as FirestoreCompetition;
    const match = matchSnap.data() as FirestoreCompMatch;
    const teamId = side === "home" ? match.home_team_id : match.away_team_id;
    if (!teamId) return NextResponse.json({ error: "Ce camp n'a pas encore d'équipe" }, { status: 400 });
    if (match.status === "completed") {
      return NextResponse.json({ error: "Le match est terminé : sa feuille ne change plus." }, { status: 409 });
    }

    const teamRef = compRef.collection("comp_teams").doc(teamId);
    const equipe = (await teamRef.get()).data() as { claimed_by_manager_id?: string | null } | undefined;
    if (!equipe) return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
    if (!(await peutTenirLaFeuille(uid, cid, competition, mid, match, equipe))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const voulus = new Set(numeros.map(String));
    const presentes = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(teamRef);
      const effectif = ((snap.data()?.players ?? []) as CompPlayer[]);
      // Recalculé ici, à partir de l'effectif du moment : un numéro pris entre
      // l'ouverture de la console et la validation n'est pas doublé, et le nom
      // vient du serveur, pas du navigateur.
      const lignes = lignesDeSecours(teamId, effectif)
        .filter((l) => voulus.has(l.number));
      if (lignes.length > 0) {
        tx.update(teamRef, { players: [...effectif, ...lignes], updated_at: FieldValue.serverTimestamp() });
      }
      // Tous les dossards demandés que l'effectif porte désormais, ceux d'un
      // match précédent compris : la console vérifie que chaque ligne de sa
      // feuille y est, et un numéro donné entre-temps à un vrai joueur manque.
      return [...effectif, ...lignes].filter((l) => estLigneDossard(l.id) && voulus.has(l.number));
    });

    return NextResponse.json({ lignes: presentes });
  } catch (err) {
    console.error("[dossards POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** Un identifiant de ligne saisie à la main, du même format (voir addCompPlayer). */
const nouvelIdLigne = () => BigInt(`0x${randomBytes(6).toString("hex")}`).toString(36).padStart(9, "0").slice(-9);

class Refus extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function PATCH(req: Request) {
  try {
    const uid = await uidAppelant(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const corps = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const cid = typeof corps.cid === "string" ? corps.cid : "";
    const teamId = typeof corps.teamId === "string" ? corps.teamId : "";
    const playerId = typeof corps.playerId === "string" ? corps.playerId : "";
    const nom = typeof corps.nom === "string" ? corps.nom.trim().replace(/\s+/g, " ") : "";
    if (!cid || !teamId || !playerId) {
      return NextResponse.json({ error: "cid, teamId et playerId requis" }, { status: 400 });
    }
    if (nom.length < 2 || nom.length > 60) {
      return NextResponse.json({ error: "Donne-lui un nom (2 à 60 caractères)." }, { status: 400 });
    }
    if (!estLigneDossard(playerId)) {
      return NextResponse.json({ error: "Cette ligne a déjà un nom." }, { status: 409 });
    }

    const compRef = adminDb.collection("competitions").doc(cid);
    const competition = (await compRef.get()).data() as FirestoreCompetition | undefined;
    if (!competition) return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    // Ceux qui décident à qui est une ligne : le staff de la compétition et
    // le manager de l'équipe.
    const autorise = (competition.moderator_ids ?? []).includes(uid) || (await isStaffOf(uid, cid, teamId));
    if (!autorise) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const teamRef = compRef.collection("comp_teams").doc(teamId);
    const matchs = compRef.collection("comp_matches");
    const resultat = await adminDb.runTransaction(async (tx) => {
      // Toutes les lectures d'abord, comme toute transaction l'exige.
      const [teamSnap, compSnap, aDomicile, aLExterieur] = await Promise.all([
        tx.get(teamRef),
        tx.get(compRef),
        tx.get(matchs.where("home_team_id", "==", teamId)),
        tx.get(matchs.where("away_team_id", "==", teamId)),
      ]);
      const effectif = ((teamSnap.data()?.players ?? []) as CompPlayer[]);
      const ligne = effectif.find((l) => l.id === playerId);
      if (!ligne) throw new Refus("Ce dossard n'est plus dans l'effectif.", 404);

      let id = nouvelIdLigne();
      while (effectif.some((l) => l.id === id)) id = nouvelIdLigne();
      const nouveau = { id, nom };

      let matchsReecrits = 0;
      for (const doc of [...aDomicile.docs, ...aLExterieur.docs]) {
        const patch = renommerDansLeMatch(doc.data() as MatchARenommer, playerId, nouveau, ligne.name);
        if (!patch) continue;
        tx.update(doc.ref, { ...patch, updated_at: FieldValue.serverTimestamp() });
        matchsReecrits += 1;
      }

      // Le meilleur joueur du tournoi, s'il l'était déjà sous son dossard.
      if (compSnap.data()?.mvp_player_id === playerId) {
        tx.update(compRef, { mvp_player_id: id, mvp_player_name: nom, updated_at: FieldValue.serverTimestamp() });
      }

      tx.update(teamRef, {
        players: effectif.map((l) => (l.id === playerId ? { ...l, id, name: nom } : l)),
        updated_at: FieldValue.serverTimestamp(),
      });
      return { id, matchsReecrits };
    });

    return NextResponse.json(resultat);
  } catch (err) {
    if (err instanceof Refus) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[dossards PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
