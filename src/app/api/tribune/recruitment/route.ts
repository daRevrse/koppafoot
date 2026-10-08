import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  decisionAnnonce,
  messageDeLAnnonce,
  postesValides,
  texteDeLAnnonce,
  type DerniereAnnonce,
} from "@/lib/annonce-recrutement";
import { nomDansLaTribune, type CompteNomme } from "@/lib/tribune-commentaires";

/**
 * L'annonce de recrutement d'une équipe dans la Tribune (lib/annonce-recrutement).
 *
 * POST { teamId, action: "publier", postes, message }
 *   → { postId, action: "publier" | "rouvrir" }, ou 409 si une annonce de
 *     moins d'une semaine est déjà en ligne.
 *   Le MANAGER seulement : la publication est signée de son nom, avec
 *   l'étiquette « Manager ». L'équipe doit recruter.
 *
 * POST { teamId, action: "clore" } → { closed: n }
 *   Le recrutement s'arrête : l'annonce ouverte se ferme, sa carte dit
 *   « Recrutement terminé ». Le manager ou son staff, comme l'interrupteur.
 */

type Corps = { teamId?: unknown; action?: unknown; postes?: unknown; message?: unknown };

const annoncesDe = (teamId: string) =>
  adminDb.collection("posts")
    .where("metadata.team_id", "==", teamId)
    .where("type", "==", "team_announcement");

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    let uid: string;
    try {
      uid = (await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1])).uid;
    } catch {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const corps = (await req.json().catch(() => ({}))) as Corps;
    const teamId = typeof corps.teamId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(corps.teamId) ? corps.teamId : null;
    if (!teamId || (corps.action !== "publier" && corps.action !== "clore")) {
      return NextResponse.json({ error: "teamId et action requis" }, { status: 400 });
    }

    const teamSnap = await adminDb.collection("teams").doc(teamId).get();
    if (!teamSnap.exists) return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
    const team = teamSnap.data() ?? {};
    const estManager = team.manager_id === uid;
    const estStaff = Array.isArray(team.staff_manager_ids) && team.staff_manager_ids.includes(uid);

    const snap = await annoncesDe(teamId).get();

    // ---- Clore ----------------------------------------------------------
    if (corps.action === "clore") {
      if (!estManager && !estStaff) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      const ouvertes = snap.docs.filter((d) => d.data().metadata?.closed !== true);
      if (ouvertes.length) {
        const lot = adminDb.batch();
        for (const d of ouvertes) {
          lot.update(d.ref, { "metadata.closed": true, updated_at: FieldValue.serverTimestamp() });
        }
        await lot.commit();
      }
      return NextResponse.json({ closed: ouvertes.length });
    }

    // ---- Publier --------------------------------------------------------
    if (!estManager) {
      return NextResponse.json({ error: "Seul le manager de l'équipe peut l'annoncer." }, { status: 403 });
    }
    if (team.is_recruiting !== true) {
      return NextResponse.json({ error: "Ouvre d'abord le recrutement de l'équipe." }, { status: 409 });
    }

    const postes = postesValides(corps.postes);
    const message = messageDeLAnnonce(corps.message);
    const nomEquipe = typeof team.name === "string" ? team.name : "L'équipe";
    const contenu = texteDeLAnnonce(nomEquipe, postes, message);

    const derniereDoc = snap.docs
      .map((d) => ({ d, t: d.data().created_at instanceof Timestamp ? d.data().created_at.toMillis() : 0 }))
      .sort((a, b) => b.t - a.t)[0];
    const derniere: DerniereAnnonce | null = derniereDoc
      ? { postId: derniereDoc.d.id, publieeLe: derniereDoc.t, close: derniereDoc.d.data().metadata?.closed === true }
      : null;
    const decision = decisionAnnonce(derniere, Date.now());

    if (decision.action === "refuser") {
      return NextResponse.json(
        { error: "Ton annonce est déjà en ligne.", postId: decision.postId, possibleLe: decision.possibleLe },
        { status: 409 },
      );
    }

    if (decision.action === "rouvrir") {
      await adminDb.collection("posts").doc(decision.postId).update({
        content: contenu,
        "metadata.postes": postes,
        "metadata.closed": false,
        updated_at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ postId: decision.postId, action: "rouvrir" });
    }

    const compte = (await adminDb.collection("users").doc(uid).get()).data() ?? {};
    // Signée de la personne, pas de son établissement : c'est le manager
    // qui parle, même s'il gère aussi un terrain.
    const auteur = nomDansLaTribune({ ...(compte as CompteNomme), is_venue_owner: false });
    const lot = adminDb.batch();
    if (decision.fermer) {
      lot.update(adminDb.collection("posts").doc(decision.fermer), {
        "metadata.closed": true, updated_at: FieldValue.serverTimestamp(),
      });
    }
    const ref = adminDb.collection("posts").doc();
    lot.set(ref, {
      author_id: uid,
      author_name: auteur,
      author_role: "Manager",
      author_avatar: typeof compte.profile_picture_url === "string" ? compte.profile_picture_url : "",
      type: "team_announcement",
      content: contenu,
      metadata: {
        team_id: teamId,
        team_name: nomEquipe,
        team_logo: typeof team.logo_url === "string" ? team.logo_url : null,
        team_city: typeof team.city === "string" ? team.city : null,
        postes,
        closed: false,
      },
      likes: [],
      comment_count: 0,
      media_urls: [],
      pinned: false,
      link: null,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    await lot.commit();
    return NextResponse.json({ postId: ref.id, action: "publier" });
  } catch (err) {
    console.error("[tribune/recruitment]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
