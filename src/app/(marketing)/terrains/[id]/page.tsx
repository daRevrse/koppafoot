import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ArrowLeft } from "lucide-react";
import { adminDb } from "@/lib/firebase-admin";
import BookingRequest from "@/components/venue/BookingRequest";
import ContactResponsable from "@/components/venue/ContactResponsable";
import GalerieTerrain from "@/components/venue/GalerieTerrain";
import {
  libelleFormat, libelleSurface, aUnPrix, horairesLus, photosDuTerrain,
} from "@/lib/terrains";
import { ListeEquipements, TableHoraires } from "@/components/venue/venue-ui";
import type { HorairesOuverture } from "@/types";

// ============================================
// La fiche publique d'un terrain.
//
// Elle vit dans le groupe marketing, aux côtés de /terrains : c'est la même
// promesse, vue de l'autre bout. La vitrine dit « faites-vous référencer »,
// celle-ci est ce qu'on obtient une fois référencé.
//
// Lue côté serveur avec le SDK admin, donc visible sans compte : un terrain
// qu'il faut un compte pour voir n'est pas référencé, il est caché.
//
// ELLE MONTRE ENFIN CE QUE LE MODÈLE PORTAIT DÉJÀ. `photo_url`,
// `price_per_hour` et `amenities` existaient depuis le premier jour et
// n'étaient affichés nulle part : la fiche se résumait à un nom, une adresse
// et trois cases. Une équipe qui choisit entre deux terrains choisit sur la
// photo et le tarif, pas sur « synthétique ».
//
// Ce qui n'y est PAS, volontairement : le téléphone et l'email du
// propriétaire. On donne son nom et un lien vers sa fiche ; le contact se
// prend là, pas dans un annuaire ouvert aux robots.
//
// LES PHOTOS D'ABORD, LE TEXTE DESSOUS. Le nom et le tarif s'écrivaient sur
// la photo, sous un dégradé noir qui cachait la pelouse ; ils sont passés
// sur fond clair, et la photo se montre telle qu'elle est (voir
// GalerieTerrain). Sur ordinateur, la demande de créneau reste à droite,
// épinglée, pendant qu'on lit les horaires et les équipements.
//
// `revalidate` descend de 300 à 60 : au-dessus, un terrain passé en « fermé »
// continuait d'accepter des demandes pendant cinq minutes. Le formulaire
// relit de toute façon la disponibilité en direct (voir BookingRequest), le
// cache ne sert plus qu'au premier rendu.
// ============================================

export const revalidate = 60;

interface VenueView {
  ownerId: string | null;
  name: string;
  address: string | null;
  city: string | null;
  fieldSize: string | null;
  fieldSurface: string | null;
  pricePerHour: number;
  amenities: string[];
  /** La photo principale d'abord, puis la galerie ; vide sans photo. */
  photos: string[];
  available: boolean;
  horaires: HorairesOuverture | null;
}

async function readVenue(id: string): Promise<VenueView | null> {
  const snap = await adminDb.collection("venues").doc(id).get();
  if (!snap.exists) return null;

  const v = snap.data() as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
  const ownerId = s(v.owner_id);

  return {
    ownerId,
    name: s(v.name) ?? "Terrain",
    address: s(v.address),
    city: s(v.city),
    fieldSize: s(v.field_size),
    fieldSurface: s(v.field_surface),
    pricePerHour: typeof v.price_per_hour === "number" ? v.price_per_hour : 0,
    amenities: Array.isArray(v.amenities)
      ? (v.amenities as unknown[]).filter((a): a is string => typeof a === "string")
      : [],
    photos: photosDuTerrain(v.photo_url, v.gallery_urls),
    available: v.available !== false,
    horaires: horairesLus(v.opening_hours),
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = await readVenue(id).catch(() => null);
  if (!venue) return { title: "Terrain introuvable, KoppaFoot" };
  const where = venue.city ? ` à ${venue.city}` : "";
  return {
    title: `${venue.name}${where}, KoppaFoot`,
    description: `${venue.name}${where} : format, surface, équipements et tarif. Demandez un créneau au propriétaire.`,
    openGraph: venue.photos[0] ? { images: [venue.photos[0]] } : undefined,
  };
}

/** Un titre de rubrique, sous la fiche. */
function Rubrique({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-black uppercase tracking-[0.12em] text-gray-900">{children}</h2>
  );
}

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = await readVenue(id).catch(() => null);
  if (!venue) notFound();

  const faits = [
    { label: "Format", valeur: libelleFormat(venue.fieldSize) },
    { label: "Surface", valeur: libelleSurface(venue.fieldSurface) },
  ];

  return (
    <section className="pb-16 pt-4 sm:pb-20 sm:pt-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-10">
        <Link
          href="/terrains/annuaire"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft size={14} />
          Tous les terrains
        </Link>

        <GalerieTerrain photos={venue.photos} nomTerrain={venue.name} ferme={!venue.available} />

        {/* Téléphone : le titre, la demande, puis le reste. Ordinateur : la
            demande à droite, épinglée sur toute la hauteur. `auto 1fr` : la
            colonne de droite, plus haute, s'étend sur la seconde rangée, et
            le titre ne se retrouve pas suivi d'un grand vide. */}
        <div className="mt-6 grid gap-8 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-10">
          <div className="min-w-0">
            {venue.available ? (
              <span className="inline-flex items-center gap-2 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800">
                <span aria-hidden className="h-1.5 w-1.5 bg-emerald-500" />
                Ouvert aux demandes
              </span>
            ) : (
              <span className="inline-flex bg-gray-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                Fermé pour le moment
              </span>
            )}

            <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-5xl">
              {venue.name}
            </h1>

            {(venue.address || venue.city) && (
              <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-500 sm:text-base">
                <MapPin size={16} className="shrink-0 text-gray-400" />
                {[venue.address, venue.city].filter(Boolean).join(", ")}
              </p>
            )}

            {/* Ce qui fait choisir, en trois cases : un « 11 contre 11 » se
                lit sans légende, une icône de pelouse non. */}
            <dl className="mt-6 grid grid-cols-3 border border-gray-200/70 bg-white">
              {faits.map((f) => (
                <div key={f.label} className="border-r border-gray-200/70 px-3 py-3 sm:px-5 sm:py-4">
                  <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">{f.label}</dt>
                  <dd className="mt-1 text-sm font-bold text-gray-900 sm:text-base">{f.valeur}</dd>
                </div>
              ))}
              <div className="px-3 py-3 sm:px-5 sm:py-4">
                <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Tarif</dt>
                <dd className="mt-1 text-sm font-bold text-gray-900 sm:text-base">
                  {aUnPrix(venue.pricePerHour) ? (
                    <>
                      <span className="font-black tabular-nums">{venue.pricePerHour.toLocaleString("fr-FR")}</span>
                      {" "}
                      <span className="whitespace-nowrap text-xs font-bold text-gray-500">FCFA / h</span>
                    </>
                  ) : (
                    <span className="text-gray-500">À convenir</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {venue.ownerId && (
            <aside
              id="reserver"
              className="scroll-mt-[calc(var(--marketing-header-h,75px)+1rem)] lg:col-start-2 lg:row-span-2 lg:row-start-1"
            >
              <div className="lg:sticky lg:top-[calc(var(--marketing-header-h,75px)+1.5rem)]">
                {/* Suspense : le formulaire lit le créneau dans l'adresse
                    (useSearchParams), ce qui le rend côté navigateur. Sans
                    cette frontière, c'est toute la fiche qui perdait son
                    rendu serveur. */}
                <Suspense fallback={<div className="h-96 border border-gray-200/70 bg-white" />}>
                  <BookingRequest
                    venueId={id}
                    available={venue.available}
                    pricePerHour={venue.pricePerHour}
                    horaires={venue.horaires}
                  />
                </Suspense>
                <ContactResponsable venueId={id} className="mt-3 w-full" />
              </div>
            </aside>
          )}

          <div className="min-w-0 space-y-10 lg:col-start-1">
            {/* Les horaires, avant les équipements : ils disent QUAND on peut
                venir, ce qui décide d'une demande ; les douches, non. */}
            {venue.horaires && (
              <div>
                <Rubrique>Horaires d&apos;ouverture</Rubrique>
                <TableHoraires horaires={venue.horaires} />
              </div>
            )}

            {venue.amenities.length > 0 && (
              <div>
                <Rubrique>Sur place</Rubrique>
                <ListeEquipements valeurs={venue.amenities} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
