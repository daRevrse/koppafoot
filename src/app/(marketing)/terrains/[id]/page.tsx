import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ArrowRight, ArrowDown } from "lucide-react";
import { adminDb } from "@/lib/firebase-admin";
import BookingRequest from "@/components/venue/BookingRequest";
import {
  libelleFormat, libelleSurface, prixHeure, aUnPrix,
} from "@/lib/terrains";
import { LignesDeTerrain, FilAriane, Etiquette, ListeEquipements } from "@/components/venue/venue-ui";

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
  photoUrl: string | null;
  available: boolean;
  owner: { uid: string; name: string } | null;
}

async function readVenue(id: string): Promise<VenueView | null> {
  const snap = await adminDb.collection("venues").doc(id).get();
  if (!snap.exists) return null;

  const v = snap.data() as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
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
    photoUrl: s(v.photo_url),
    available: v.available !== false,
    owner,
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
    openGraph: venue.photoUrl ? { images: [venue.photoUrl] } : undefined,
  };
}

/**
 * Un fait, dans le bandeau.
 *
 * Ils vivaient dans une grille sous le hero, et cette grille tombait à UNE
 * colonne sous 640px : quatre informations de trois mots y occupaient 353px,
 * soit 43% d'un écran de téléphone, et repoussaient la réservation à 1215px —
 * un écran et demi. Portés par le bandeau, ils ne coûtent plus une ligne.
 */
function FaitBandeau({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1 font-display text-base font-black uppercase leading-none tracking-tight text-white sm:text-lg">
        {value}
      </p>
    </div>
  );
}

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = await readVenue(id).catch(() => null);
  if (!venue) notFound();

  return (
    <>
      {/* LE BANDEAU PORTE LA DÉCISION.
          Il ne montrait qu'un nom et une ville sur 374px de photo, pendant que
          les faits qui font choisir — format, surface, tarif — s'empilaient
          plus bas et repoussaient la réservation hors de l'écran. Ils sont
          ici, avec le tarif en grand et l'ancre vers le formulaire : la
          réservation s'annonce avant le premier scroll, sans que le
          formulaire lui-même s'invite dans une photo.

          La photo si elle existe, le marquage du terrain sinon : dans les deux
          cas le texte se lit en blanc sur du sombre, donc la page a la même
          silhouette avec ou sans photo. */}
      <section className="relative flex min-h-[62vh] items-end overflow-hidden bg-gray-900 sm:min-h-[66vh]">
        {venue.photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={venue.photoUrl}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover ${venue.available ? "" : "grayscale"}`}
            />
            {/* Dégradé plus appuyé qu'avant : il porte maintenant six lignes
                de texte, pas deux, et un tarif doit rester lisible sur une
                pelouse claire comme sur un ciel. */}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/25" />
          </>
        ) : (
          <>
            <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
            <LignesDeTerrain className="text-white/10" />
          </>
        )}

        <div className="relative mx-auto w-full max-w-4xl px-6 pb-8 pt-28 sm:px-10 sm:pb-10">
          {venue.available ? (
            <span className="mb-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-300">
              <span aria-hidden className="h-1.5 w-1.5 bg-emerald-400" />
              Ouvert aux demandes
            </span>
          ) : (
            <span className="mb-4 inline-flex bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-900">
              Fermé pour le moment
            </span>
          )}

          <h1 className="font-display text-4xl font-black uppercase leading-[0.9] tracking-[-0.02em] text-white sm:text-6xl">
            {venue.name}
          </h1>

          {(venue.address || venue.city) && (
            <p className="mt-4 flex items-center gap-2 text-base text-white/70 sm:text-lg">
              <MapPin size={17} className="shrink-0" />
              {[venue.address, venue.city].filter(Boolean).join(", ")}
            </p>
          )}

          {/* Format et surface : deux valeurs, pas deux symboles. Un « 11
              contre 11 » se lit sans légende, une icône de pelouse non. */}
          <div className="mt-7 flex flex-wrap items-end gap-x-10 gap-y-5 border-t border-white/15 pt-6">
            <FaitBandeau label="Format" value={libelleFormat(venue.fieldSize)} />
            <FaitBandeau label="Surface" value={libelleSurface(venue.fieldSurface)} />

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">Tarif</p>
              <p
                className={`mt-1 font-display font-black uppercase leading-none tracking-tight ${
                  aUnPrix(venue.pricePerHour)
                    ? "text-2xl text-emerald-300 sm:text-3xl"
                    : "text-base text-white/70 sm:text-lg"
                }`}
              >
                {prixHeure(venue.pricePerHour)}
              </p>
            </div>

            {/* L'ancre, pas le formulaire : elle annonce la réservation dès le
                premier écran et y emmène d'un geste. */}
            {venue.available && (
              <a
                href="#reserver"
                className="flex w-full items-center justify-center gap-2 border border-white bg-white px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-gray-900 transition-colors hover:border-emerald-400 hover:bg-emerald-400 sm:ml-auto sm:w-auto"
              >
                Demander un créneau
                <ArrowDown size={15} />
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-6 sm:px-10">
          <FilAriane
            items={[
              { href: "/", label: "Direct" },
              { href: "/terrains/annuaire", label: "Où jouer" },
              { label: venue.name },
            ]}
          />

          {/* LA RÉSERVATION PASSE DEVANT LES ÉQUIPEMENTS.
              Ils la précédaient, et leurs dix pastilles la repoussaient de
              285px de plus. On vérifie les douches APRÈS avoir décidé qu'un
              terrain nous intéresse, pas avant : l'ordre suit la décision. */}
          {venue.ownerId && (
            <div
              id="reserver"
              className="scroll-mt-[calc(var(--marketing-header-h,75px)+1.5rem)]"
            >
              <BookingRequest
                venueId={id}
                venueName={venue.name}
                ownerId={venue.ownerId}
                available={venue.available}
                pricePerHour={venue.pricePerHour}
              />
            </div>
          )}

          {venue.amenities.length > 0 && (
            <div className="mt-10">
              <Etiquette className="mb-3">Sur place</Etiquette>
              <ListeEquipements valeurs={venue.amenities} />
            </div>
          )}

          {venue.owner && (
            <div className="mt-10 border border-gray-200/70 bg-white p-6">
              <Etiquette>Géré par</Etiquette>
              <p className="mt-2 font-display text-xl font-black uppercase tracking-tight text-gray-900">
                {venue.owner.name}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-500">
                La demande de créneau passe par le formulaire ci-dessus. Sa fiche
                reste là si vous préférez le contacter directement.
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

          <p className="mt-10">
            <Link
              href="/terrains/annuaire"
              className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-emerald-700"
            >
              ← Tous les terrains
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
