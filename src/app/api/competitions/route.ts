import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { slugify } from "@/lib/competition-format";
import { lireCategorie } from "@/lib/genre";
import { limiteDeCreation, reponseLimite, uidAppelant } from "@/lib/offre-server";
import type { CompetitionFormat, CompetitionType } from "@/types";

/**
 * POST /api/competitions, créer une compétition (en brouillon, non validée).
 *
 * Par le serveur, et plus par le navigateur : l'offre gratuite plafonne le
 * nombre de compétitions qu'on mène de front (lib/offre). La création directe
 * est fermée dans firestore.rules.
 *
 * Mêmes conditions que la règle qu'elle remplace : la casquette
 * d'organisateur (ou l'administration), et l'appelant pour seul organisateur
 * à la naissance. Le document est celui qu'écrivait le navigateur ; seule
 * différence, `is_validated` ne peut plus arriver à `true` par le corps.
 */

const TYPES: CompetitionType[] = ["cup", "league", "groups_knockout", "league_playoffs"];

const texte = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
const ouNull = (x: unknown, max: number) => texte(x, max) || null;
const entier = (x: unknown, min: number, max: number, defaut: number) => {
  const n = Math.round(Number(x));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut;
};
const jour = (x: unknown) => (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);

/** Le format, champ par champ : rien d'autre ne passe. */
function lireFormat(x: unknown): CompetitionFormat | null {
  if (!x || typeof x !== "object") return null;
  const f = x as Record<string, unknown>;
  const p = (f.points ?? {}) as Record<string, unknown>;
  return {
    group_count: entier(f.group_count, 1, 32, 1),
    teams_per_group: entier(f.teams_per_group, 2, 64, 4),
    qualifiers_per_group: entier(f.qualifiers_per_group, 0, 64, 2),
    has_third_place: f.has_third_place === true,
    points: { win: entier(p.win, 0, 10, 3), draw: entier(p.draw, 0, 10, 1), loss: entier(p.loss, 0, 10, 0) },
    ...(f.double_round !== undefined ? { double_round: f.double_round === true } : {}),
    ...(f.team_size !== undefined ? { team_size: entier(f.team_size, 1, 11, 11) } : {}),
    ...(f.half_duration !== undefined ? { half_duration: entier(f.half_duration, 1, 90, 45) } : {}),
    ...(f.knockout_teams !== undefined ? { knockout_teams: entier(f.knockout_teams, 2, 64, 8) } : {}),
  };
}

export async function POST(req: Request) {
  try {
    const uid = await uidAppelant(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const profil = (await adminDb.collection("users").doc(uid).get()).data();
    if (profil?.is_organizer !== true && !estSuperadmin(profil)) {
      return NextResponse.json({ error: "Réservé aux organisateurs." }, { status: 403 });
    }

    const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = texte(c.name, 120);
    if (!name) return NextResponse.json({ error: "Le nom de la compétition est requis." }, { status: 400 });
    const type = TYPES.includes(c.competitionType as CompetitionType) ? (c.competitionType as CompetitionType) : null;
    const format = lireFormat(c.format);
    if (!type || !format) return NextResponse.json({ error: "Type ou format de compétition invalide." }, { status: 400 });

    const limite = await limiteDeCreation(uid, "competitions");
    if (limite) return reponseLimite(limite);

    // Une adresse unique : slug, slug-2, slug-3…
    const base = slugify(name) || "competition";
    let slug = base;
    for (let suffixe = 2; ; suffixe += 1) {
      const pris = await adminDb.collection("competitions").where("slug", "==", slug).limit(1).get();
      if (pris.empty) break;
      slug = `${base}-${suffixe}`;
    }

    const description = typeof c.description === "string" ? texte(c.description, 4000) : undefined;
    const category = lireCategorie(c.category);
    const ref = await adminDb.collection("competitions").add({
      name,
      slug,
      logo_url: ouNull(c.logoUrl, 1000),
      banner_url: ouNull(c.bannerUrl, 1000),
      organizer_ids: [uid],
      moderator_ids: [],
      created_by: uid,
      status: "draft",
      competition_type: type,
      organizer_name: ouNull(c.organizerName, 120),
      format,
      start_date: jour(c.startDate),
      end_date: jour(c.endDate),
      venue_city: ouNull(c.venueCity, 80),
      ...(description !== undefined ? { description } : {}),
      ...(category ? { category } : {}),
      // Non validée à la naissance : c'est l'administration qui ouvre la porte
      // du public, l'organisateur prépare tout le reste sans attendre.
      is_validated: false,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id });
  } catch (err) {
    console.error("POST /api/competitions:", err);
    return NextResponse.json({ error: "La création a échoué." }, { status: 500 });
  }
}
