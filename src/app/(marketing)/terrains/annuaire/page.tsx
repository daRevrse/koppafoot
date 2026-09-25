import { adminDb } from "@/lib/firebase-admin";
import AnnuaireTerrains, { type TerrainListe } from "@/components/venue/AnnuaireTerrains";
import { horairesLus, type Occupation } from "@/lib/terrains";

// ============================================
// L'annuaire des terrains.
//
// POURQUOI CETTE PAGE N'EXISTAIT PAS, ET CE QUE ÇA COÛTAIT. Le produit
// savait référencer un terrain, le publier, recevoir une demande de créneau
// et y répondre — mais nulle part on ne pouvait VOIR la liste des terrains.
// L'état vide de /mes-reservations disait « Trouve un terrain » et renvoyait
// vers /terrains, qui est la vitrine des propriétaires : on y lisait
// « Référencer mon terrain » alors qu'on cherchait où jouer. Le seul chemin
// réel était la recherche globale, à condition de connaître le nom du
// terrain qu'on cherchait — c'est-à-dire de ne pas en avoir besoin.
//
// Elle vit dans le groupe marketing, sans compte requis : un terrain qu'il
// faut être connecté pour voir n'est pas référencé, il est caché. Réserver,
// en revanche, demande un compte, et c'est la fiche qui le dit.
//
// La lecture passe par le SDK admin plutôt que par le client : la liste est
// la même pour tout le monde, la calculer une fois côté serveur évite autant
// de lectures Firestore que de visiteurs.
//
// LES CRÉNEAUX PRIS VOYAGENT AVEC LA LISTE, pour répondre à « où jouer samedi
// à 18 h » sans ouvrir chaque fiche. Date, heure et durée, rien d'autre : ce
// que chaque fiche publie déjà (voir /api/public/venue/[id]/slots), jamais
// le nom d'une équipe ni le motif d'un blocage.
// ============================================

export const revalidate = 120;

export const metadata = {
  title: "Où jouer, les terrains de KoppaFoot",
  description:
    "Tous les terrains référencés sur KoppaFoot : format, surface, équipements et tarif. Demandez un créneau au propriétaire.",
};

/**
 * Les créneaux confirmés à venir, par terrain.
 *
 * Une seule requête sur le statut, la date filtrée ici : un filtre d'égalité
 * et une plage sur deux champs différents demanderaient un index composite,
 * pour une collection qui tient encore en mémoire.
 */
async function lireOccupations(): Promise<Map<string, Occupation[]>> {
  const aujourdhui = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const snap = await adminDb.collection("bookings").where("status", "==", "confirmed").get();
  const parTerrain = new Map<string, Occupation[]>();
  for (const d of snap.docs) {
    const b = d.data();
    if (typeof b.venue_id !== "string" || typeof b.date !== "string" || b.date < aujourdhui) continue;
    const liste = parTerrain.get(b.venue_id) ?? [];
    liste.push({
      date: b.date,
      time: typeof b.time === "string" ? b.time : "00:00",
      duration: typeof b.duration === "number" ? b.duration : 1,
    });
    parTerrain.set(b.venue_id, liste);
  }
  return parTerrain;
}

/**
 * Une photo que la page peut afficher.
 *
 * next/image refuse — en cassant le rendu — une adresse dont l'hôte n'est pas
 * déclaré dans next.config. Toutes les photos passent par Firebase Storage
 * depuis que la saisie d'URL libre a disparu, mais une fiche plus ancienne
 * suffirait à faire tomber tout l'annuaire : on filtre ici plutôt que de le
 * découvrir en production.
 */
const HOTES_PHOTOS = new Set(["firebasestorage.googleapis.com", "koppafoot.firebasestorage.app"]);
function photoAffichable(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && HOTES_PHOTOS.has(u.hostname);
  } catch {
    return false;
  }
}

async function lireTerrains(): Promise<TerrainListe[]> {
  const [snap, occupations] = await Promise.all([
    adminDb.collection("venues").get(),
    lireOccupations().catch(() => new Map<string, Occupation[]>()),
  ]);
  const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

  return snap.docs
    .map((d) => {
      const v = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: s(v.name) ?? "Terrain",
        city: s(v.city),
        address: s(v.address),
        fieldSize: s(v.field_size),
        fieldSurface: s(v.field_surface),
        pricePerHour: n(v.price_per_hour),
        amenities: Array.isArray(v.amenities) ? (v.amenities as unknown[]).filter((a): a is string => typeof a === "string") : [],
        // La photo principale d'abord, puis la galerie : un terrain qui n'a
        // renseigné que sa galerie a quand même une image à montrer.
        photos: [...new Set([v.photo_url, ...(Array.isArray(v.gallery_urls) ? v.gallery_urls : [])]
          .map(s)
          .filter((u): u is string => u !== null && photoAffichable(u)))],
        available: v.available !== false,
        horaires: horairesLus(v.opening_hours),
        occupations: occupations.get(d.id) ?? [],
      };
    })
    // Les terrains ouverts d'abord, puis l'ordre alphabétique. Un terrain
    // fermé reste listé — il rouvrira, et le masquer ferait croire qu'il a
    // disparu à qui l'a déjà réservé — mais il ne prend pas la première place.
    .sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.name.localeCompare(b.name, "fr");
    });
}

export default async function AnnuairePage() {
  const terrains = await lireTerrains().catch(() => []);
  return <AnnuaireTerrains terrains={terrains} />;
}
