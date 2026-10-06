import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { lireCategorie } from "@/lib/genre";
import { limiteDeCreation, reponseLimite, uidAppelant } from "@/lib/offre-server";

/**
 * POST /api/teams, créer une équipe dont l'appelant est le manager.
 *
 * Par le serveur, et plus par le navigateur : l'offre gratuite plafonne le
 * nombre d'équipes qu'on gère (lib/offre), et une règle Firestore ne sait pas
 * compter. La création directe est fermée dans firestore.rules.
 *
 * Le document est celui qu'écrivait le navigateur, champ pour champ ; le
 * manager est l'appelant, quoi que dise le corps.
 */

const NIVEAUX = ["beginner", "amateur", "intermediate", "advanced"];

const texte = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");

export async function POST(req: Request) {
  try {
    const uid = await uidAppelant(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = texte(c.name, 80);
    const city = texte(c.city, 80);
    if (!name || !city) return NextResponse.json({ error: "Le nom et la ville sont requis." }, { status: 400 });
    const level = typeof c.level === "string" && NIVEAUX.includes(c.level) ? c.level : "amateur";
    const maxMembers = Math.min(50, Math.max(5, Math.round(Number(c.maxMembers) || 14)));
    const category = lireCategorie(c.category);

    const limite = await limiteDeCreation(uid, "equipes");
    if (limite) return reponseLimite(limite);

    const ref = await adminDb.collection("teams").add({
      name, manager_id: uid, city,
      description: texte(c.description, 1000), level,
      looking_for: [], member_ids: [],
      max_members: maxMembers, color: texte(c.color, 32) || "emerald",
      wins: 0, losses: 0, draws: 0, matches_played: 0,
      is_recruiting: true,
      ...(category ? { category } : {}),
      created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id });
  } catch (err) {
    console.error("POST /api/teams:", err);
    return NextResponse.json({ error: "La création a échoué." }, { status: 500 });
  }
}
