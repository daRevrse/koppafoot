import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ArrowRight } from "lucide-react";
import { adminDb } from "@/lib/firebase-admin";

// ============================================
// La fiche publique d'un terrain.
//
// Elle vit dans le groupe marketing, aux côtés de /terrains : c'est la même
// promesse, vue de l'autre bout. La page vitrine dit « faites-vous
// référencer », celle-ci est ce qu'on obtient une fois référencé.
//
// Lue côté serveur avec le SDK admin, donc visible sans compte — un terrain
// qu'il faut un compte pour voir n'est pas référencé, il est caché.
//
// Ce qui n'y est PAS, volontairement : le téléphone et l'email du
// propriétaire. On donne son nom et un lien vers sa fiche ; le contact se
// prend là, pas dans un annuaire ouvert aux robots.
// ============================================

export const revalidate = 300;

const SIZES: Record<string, string> = {
  "5v5": "5 contre 5", "7v7": "7 contre 7", "11v11": "11 contre 11", futsal: "Futsal",
};

const SURFACES: Record<string, string> = {
  natural_grass: "Pelouse naturelle", synthetic: "Synthétique",
  hybrid: "Hybride", indoor: "Intérieur",
};

interface VenueView {
  name: string;
  address: string | null;
  city: string | null;
  fieldSize: string | null;
  fieldSurface: string | null;
  available: boolean;
  owner: { uid: string; name: string } | null;
}

async function readVenue(id: string): Promise<VenueView | null> {
  const snap = await adminDb.collection("venues").doc(id).get();
  if (!snap.exists) return null;

  const v = snap.data() as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === "string" && x.trim() ? x : null);
  const ownerId = s(v.owner_id);

  let owner: VenueView["owner"] = null;
  if (ownerId) {
    const o = await adminDb.collection("users").doc(ownerId).get();
    if (o.exists) {
      const d = o.data() as Record<string, unknown>;
      const name = `${s(d.first_name) ?? ""} ${s(d.last_name) ?? ""}`.trim();
      if (name) owner = { uid: ownerId, name };
    }
  }

  return {
    name: s(v.name) ?? "Terrain",
    address: s(v.address),
    city: s(v.city),
    fieldSize: s(v.field_size),
    fieldSurface: s(v.field_surface),
    available: v.available !== false,
    owner,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = await readVenue(id).catch(() => null);
  if (!venue) return { title: "Terrain introuvable — KoppaFoot" };
  const where = venue.city ? ` à ${venue.city}` : "";
  return {
    title: `${venue.name}${where} — KoppaFoot`,
    description: `${venue.name}${where} : format, surface et disponibilité du terrain sur KoppaFoot.`,
  };
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-gray-200/70 bg-white px-5 py-6 [&+&]:border-l">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">{label}</p>
      <p className="mt-1.5 font-display text-lg font-black leading-none text-gray-900">{value}</p>
    </div>
  );
}

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = await readVenue(id).catch(() => null);
  if (!venue) notFound();

  const facts = [
    venue.fieldSize ? { label: "Format", value: SIZES[venue.fieldSize] ?? venue.fieldSize } : null,
    venue.fieldSurface ? { label: "Surface", value: SURFACES[venue.fieldSurface] ?? venue.fieldSurface } : null,
    { label: "État", value: venue.available ? "Disponible" : "Fermé" },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-6 sm:px-10">
        <nav
          aria-label="Fil d'ariane"
          className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
        >
          <Link href="/" className="transition-colors hover:text-emerald-700">Direct</Link>
          <span aria-hidden className="text-gray-300">›</span>
          <Link href="/terrains" className="transition-colors hover:text-emerald-700">MyFields</Link>
          <span aria-hidden className="text-gray-300">›</span>
          <span className="truncate text-gray-600">{venue.name}</span>
        </nav>

        <h1 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-[-0.02em] text-gray-900 sm:text-6xl">
          {venue.name}
        </h1>

        {(venue.address || venue.city) && (
          <p className="mt-5 flex items-center gap-2 text-lg text-gray-600">
            <MapPin size={18} className="shrink-0 text-gray-400" />
            {[venue.address, venue.city].filter(Boolean).join(", ")}
          </p>
        )}

        <div className={`mt-10 grid border-x border-b border-gray-200/70 ${facts.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {facts.map((f) => <Fact key={f.label} {...f} />)}
        </div>

        {venue.owner && (
          <div className="mt-10 border border-gray-200/70 bg-white p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
              Géré par
            </p>
            <p className="mt-2 font-display text-xl font-black uppercase tracking-tight text-gray-900">
              {venue.owner.name}
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-500">
              La réservation ne se fait pas encore sur KoppaFoot : passez par sa
              fiche pour le contacter et convenir d&apos;un créneau.
            </p>
            <Link
              href={`/profile/${venue.owner.uid}`}
              className="mt-6 inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
            >
              Voir sa fiche
              <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
