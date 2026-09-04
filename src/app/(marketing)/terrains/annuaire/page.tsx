import { adminDb } from "@/lib/firebase-admin";
import AnnuaireTerrains, { type TerrainListe } from "@/components/venue/AnnuaireTerrains";

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
// ============================================

export const revalidate = 120;

export const metadata = {
  title: "Où jouer, les terrains de KoppaFoot",
  description:
    "Tous les terrains référencés sur KoppaFoot : format, surface, équipements et tarif. Demandez un créneau au propriétaire.",
};

async function lireTerrains(): Promise<TerrainListe[]> {
  const snap = await adminDb.collection("venues").get();
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
        photoUrl: s(v.photo_url),
        available: v.available !== false,
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
