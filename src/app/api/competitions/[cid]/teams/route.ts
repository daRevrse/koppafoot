import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { limiteEquipesDeCompetition, reponseLimite, uidAppelant } from "@/lib/offre-server";
import type { CompPlayer } from "@/types";

/**
 * POST /api/competitions/[cid]/teams, ajouter des équipes à une compétition :
 * une à la main, celles d'un tableau importé, ou toutes celles d'une édition
 * précédente quand on duplique une compétition.
 *
 * Par le serveur, et plus par le navigateur : l'offre gratuite plafonne la
 * taille d'une compétition (lib/offre). La création directe est fermée dans
 * firestore.rules ; les inscriptions acceptées passent déjà par le serveur
 * (/api/competitions/registrations), qui vérifie la même limite.
 *
 * Mêmes conditions que la règle qu'elle remplace : un organisateur de la
 * compétition, ou l'administration. Les modérateurs n'ajoutent pas d'équipe.
 *
 * Corps : une équipe { name, shortName, color, logoUrl?, group?, players? }
 * → { id } ; ou { equipes: [...] } → { ids }, tout ou rien.
 */

export const dynamic = "force-dynamic";

/** Une duplication porte une édition entière ; au-delà, c'est une erreur. */
const MAX_PAR_APPEL = 64;
const MAX_JOUEURS = 60;

const texte = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");

/** L'effectif recopié d'une édition à l'autre, champ par champ. */
function lireJoueurs(x: unknown): CompPlayer[] {
  if (!Array.isArray(x)) return [];
  return x.slice(0, MAX_JOUEURS).flatMap((j) => {
    if (!j || typeof j !== "object") return [];
    const p = j as Record<string, unknown>;
    const id = texte(p.id, 64);
    const name = texte(p.name, 80);
    if (!id || !name) return [];
    const position = texte(p.position, 40);
    const userId = texte(p.user_id, 128);
    return [{ id, name, number: texte(p.number, 4), ...(position ? { position } : {}), ...(userId ? { user_id: userId } : {}) }];
  });
}

function lireEquipe(x: unknown) {
  const c = (x ?? {}) as Record<string, unknown>;
  const name = texte(c.name, 80);
  if (!name) return null;
  const players = lireJoueurs(c.players);
  return {
    name,
    short_name: texte(c.shortName, 6) || name.slice(0, 3).toUpperCase(),
    color: texte(c.color, 32) || "#059669",
    logo_url: texte(c.logoUrl, 1000) || null,
    group: texte(c.group, 40) || null,
    ...(players.length ? { players } : {}),
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ cid: string }> }) {
  try {
    const uid = await uidAppelant(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { cid } = await params;

    const compRef = adminDb.collection("competitions").doc(cid);
    const compSnap = await compRef.get();
    if (!compSnap.exists) return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    const competition = compSnap.data()!;
    const organisateur = Array.isArray(competition.organizer_ids) && competition.organizer_ids.includes(uid);
    if (!organisateur) {
      const profil = (await adminDb.collection("users").doc(uid).get()).data();
      if (!estSuperadmin(profil)) return NextResponse.json({ error: "Réservé aux organisateurs" }, { status: 403 });
    }

    const corps = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parLot = Array.isArray(corps.equipes);
    const brutes = parLot ? (corps.equipes as unknown[]) : [corps];
    if (brutes.length > MAX_PAR_APPEL) {
      return NextResponse.json({ error: `${MAX_PAR_APPEL} équipes au plus par appel` }, { status: 400 });
    }
    const equipes = brutes.map(lireEquipe);
    if (!equipes.length || equipes.some((e) => !e)) {
      return NextResponse.json({ error: "Le nom de l'équipe est requis" }, { status: 400 });
    }

    const limite = await limiteEquipesDeCompetition(cid, competition, equipes.length);
    if (limite) return reponseLimite(limite);

    const lot = adminDb.batch();
    const ids = equipes.map((e) => {
      const ref = compRef.collection("comp_teams").doc();
      lot.set(ref, { ...e, created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() });
      return ref.id;
    });
    await lot.commit();
    return NextResponse.json(parLot ? { ids } : { id: ids[0] });
  } catch (err) {
    console.error("POST /api/competitions/[cid]/teams:", err);
    return NextResponse.json({ error: "L'ajout a échoué" }, { status: 500 });
  }
}
