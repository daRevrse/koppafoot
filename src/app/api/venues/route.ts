import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { limiteDeCreation, reponseLimite, uidAppelant } from "@/lib/offre-server";
import type { FirestoreVenue, HorairesOuverture } from "@/types";

/**
 * POST /api/venues, référencer un terrain de plus depuis « Mes terrains ».
 *
 * Le premier terrain naît de la candidature approuvée
 * (/api/venue-applications) ; les suivants passent ici, par le serveur, parce
 * que l'offre gratuite plafonne le nombre de terrains (lib/offre) et qu'une
 * règle Firestore ne sait pas compter. La création directe est fermée dans
 * firestore.rules.
 *
 * Mêmes conditions que la règle qu'elle remplace : la casquette de
 * propriétaire, et l'appelant pour propriétaire. Le document est celui
 * qu'écrivait le navigateur ; les photos s'ajoutent ensuite, comme avant,
 * parce que leur chemin de stockage demande l'identifiant du terrain.
 */

const TYPES: FirestoreVenue["field_type"][] = ["outdoor", "indoor", "hybrid"];
const SURFACES: FirestoreVenue["field_surface"][] = ["natural_grass", "synthetic", "hybrid", "indoor"];
const FORMATS: FirestoreVenue["field_size"][] = ["5v5", "7v7", "11v11", "futsal"];
const JOURS = ["0", "1", "2", "3", "4", "5", "6"] as const;
const HEURE = /^\d{2}:\d{2}$/;

const texte = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
const parmi = <T extends string>(x: unknown, liste: T[]): T | null => (liste.includes(x as T) ? (x as T) : null);

/** Les horaires, jour par jour : une plage « HH:MM »–« HH:MM » ou fermé. */
function lireHoraires(x: unknown): HorairesOuverture | null {
  if (!x || typeof x !== "object") return null;
  const h = x as Record<string, unknown>;
  const out = {} as HorairesOuverture;
  for (const j of JOURS) {
    const p = h[j] as { ouvre?: unknown; ferme?: unknown } | null | undefined;
    out[j] = p && typeof p.ouvre === "string" && typeof p.ferme === "string" && HEURE.test(p.ouvre) && HEURE.test(p.ferme)
      ? { ouvre: p.ouvre, ferme: p.ferme }
      : null;
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const uid = await uidAppelant(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const profil = (await adminDb.collection("users").doc(uid).get()).data();
    if (profil?.is_venue_owner !== true) {
      return NextResponse.json({ error: "Réservé aux propriétaires de terrain." }, { status: 403 });
    }

    const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = texte(c.name, 120);
    const address = texte(c.address, 200);
    const city = texte(c.city, 80);
    const fieldType = parmi(c.fieldType, TYPES);
    const fieldSurface = parmi(c.fieldSurface, SURFACES);
    const fieldSize = parmi(c.fieldSize, FORMATS);
    if (!name || !city || !fieldType || !fieldSurface || !fieldSize) {
      return NextResponse.json({ error: "Nom, ville, type, surface et format sont requis." }, { status: 400 });
    }

    const limite = await limiteDeCreation(uid, "terrains");
    if (limite) return reponseLimite(limite);

    const prix = Number(c.pricePerHour);
    const ref = await adminDb.collection("venues").add({
      name, address, city,
      owner_id: uid,
      field_type: fieldType,
      field_surface: fieldSurface,
      field_size: fieldSize,
      price_per_hour: Number.isFinite(prix) && prix >= 0 ? Math.round(prix) : 0,
      amenities: Array.isArray(c.amenities)
        ? c.amenities.filter((a): a is string => typeof a === "string").map((a) => a.slice(0, 60)).slice(0, 30)
        : [],
      available: c.available !== false,
      photo_url: null,
      gallery_urls: [],
      opening_hours: lireHoraires(c.openingHours),
      rating: 0,
      review_count: 0,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id });
  } catch (err) {
    console.error("POST /api/venues:", err);
    return NextResponse.json({ error: "L'enregistrement a échoué." }, { status: 500 });
  }
}
