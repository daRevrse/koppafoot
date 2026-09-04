"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MapPin, Plus, Trash2, Pencil, Check, X, Inbox, ImagePlus, ArrowRight, Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  onVenuesByOwner, createVenue, updateVenue, deleteVenue, onBookingsByOwner,
} from "@/lib/firestore";
import { uploadVenuePhoto } from "@/lib/storage";
import type { Venue, Booking } from "@/types";
import { isVenueOwner } from "@/lib/hats";
import {
  FORMATS, SURFACES, formatCourt, surfaceCourte, prixHeure, aUnPrix, aujourdhui,
} from "@/lib/terrains";
import {
  Panneau, FilAriane, Champ, Etiquette, Pastilles, ChoixEquipements, ListeEquipements,
  Bouton, LienBouton, EtatVide, EnCours, LignesDeTerrain, useConfirmation, classeChamp,
} from "@/components/venue/venue-ui";

// ============================================
// Mes terrains, la gestion, côté propriétaire.
//
// Un propriétaire peut en avoir plusieurs : c'est pour ça que le terrain est
// un document à part et non trois champs sur son compte.
//
// CETTE PAGE NE RÉPOND PLUS AUX DEMANDES. Elle affichait en tête les demandes
// en attente ET les créneaux confirmés, avec leurs boutons Confirmer et
// Refuser — exactement ce que fait /mes-terrains/reservations. Deux listes,
// deux jeux de boutons, une seule vérité : un correctif porté sur l'une ne
// l'était jamais sur l'autre. Il ne reste ici qu'un COMPTEUR, qui mène à la
// page qui traite. Gérer ses fiches et arbitrer ses créneaux sont deux
// journées de travail différentes.
//
// L'ANCIEN EN-TÊTE MENTAIT : il annonçait « la réservation en ligne n'existe
// pas encore » sur la page même d'un propriétaire qui recevait des demandes.
// ============================================

interface Brouillon {
  name: string;
  address: string;
  city: string;
  fieldSize: string;
  fieldSurface: string;
  prix: string;
  equipements: string[];
  photoUrl: string | null;
  available: boolean;
}

const brouillonVide = (city: string): Brouillon => ({
  name: "", address: "", city, fieldSize: "11v11", fieldSurface: "synthetic",
  prix: "", equipements: [], photoUrl: null, available: true,
});

const depuisTerrain = (v: Venue): Brouillon => ({
  name: v.name,
  address: v.address,
  city: v.city,
  fieldSize: v.fieldSize,
  fieldSurface: v.fieldSurface,
  prix: v.pricePerHour > 0 ? String(v.pricePerHour) : "",
  equipements: v.amenities ?? [],
  photoUrl: v.photoUrl,
  available: v.available,
});

/**
 * Ce qui manque à une fiche pour convaincre.
 *
 * Une équipe qui hésite entre deux terrains tranche sur la photo et le tarif.
 * Un propriétaire ne le sait pas forcément, et rien ne le lui disait : sa
 * fiche restait au minimum syndical sans qu'il comprenne pourquoi personne
 * ne le choisissait.
 */
function manques(v: Venue): string[] {
  const liste: string[] = [];
  if (!v.photoUrl) liste.push("une photo");
  if (!aUnPrix(v.pricePerHour)) liste.push("un tarif");
  if (!v.amenities?.length) liste.push("les équipements");
  if (!v.address?.trim()) liste.push("l'adresse");
  return liste;
}

function Formulaire({
  brouillon,
  setBrouillon,
  onSubmit,
  onCancel,
  occupe,
  libelle,
  fichier,
  setFichier,
}: {
  brouillon: Brouillon;
  setBrouillon: (b: Brouillon) => void;
  onSubmit: () => void;
  onCancel: () => void;
  occupe: boolean;
  libelle: string;
  fichier: File | null;
  setFichier: (f: File | null) => void;
}) {
  const [apercu, setApercu] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // L'URL d'aperçu naît DANS LE GESTIONNAIRE, pas dans un effet.
  //
  // La créer dans un effet obligeait à poser l'état depuis l'effet lui-même,
  // ce qui déclenche un second rendu en cascade à chaque choix de fichier
  // (react-hooks/set-state-in-effect). Choisir une image est un événement :
  // l'URL se fabrique au moment du clic, se révoque quand on la remplace, et
  // l'effet ne garde que le nettoyage au démontage — sans état.
  const apercuRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (apercuRef.current) URL.revokeObjectURL(apercuRef.current);
  }, []);

  const poser = (f: File | null) => {
    if (apercuRef.current) URL.revokeObjectURL(apercuRef.current);
    apercuRef.current = f ? URL.createObjectURL(f) : null;
    setApercu(apercuRef.current);
    setFichier(f);
  };

  const choisir = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Choisis une image (PNG, JPG, WebP)."); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Image trop lourde (5 Mo maximum)."); return; }
    poser(f);
  };

  const montree = apercu ?? brouillon.photoUrl;

  return (
    <div className="space-y-6 border border-gray-200/70 bg-white p-5 sm:p-6">
      {/* La photo d'abord : c'est le champ qui change le plus les demandes,
          et le mettre en dernier revenait à le faire sauter. */}
      <div>
        <Etiquette className="mb-2">Photo du terrain</Etiquette>
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative h-28 w-40 shrink-0 overflow-hidden border border-gray-200/70 bg-gray-900">
            {montree ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={montree} alt="" className="h-full w-full object-cover" />
            ) : (
              <>
                <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
                <LignesDeTerrain className="text-white/15" />
              </>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 border border-gray-200/70 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900">
              <ImagePlus size={14} />
              {montree ? "Changer la photo" : "Ajouter une photo"}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => choisir(e.target.files?.[0])}
              />
            </label>
            {(fichier || brouillon.photoUrl) && (
              <button
                type="button"
                onClick={() => {
                  poser(null);
                  setBrouillon({ ...brouillon, photoUrl: null });
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="w-fit text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-red-500"
              >
                Retirer la photo
              </button>
            )}
            <p className="text-[11px] leading-relaxed text-gray-400">
              5 Mo maximum. Une vue large de la pelouse vaut mieux qu&apos;un
              gros plan : c&apos;est l&apos;image sur laquelle une équipe choisit.
            </p>
          </div>
        </div>
      </div>

      <Champ label="Nom du terrain" htmlFor="v-nom">
        <input
          id="v-nom"
          type="text"
          value={brouillon.name}
          onChange={(e) => setBrouillon({ ...brouillon, name: e.target.value })}
          placeholder="ex: Terrain municipal"
          className={classeChamp}
        />
      </Champ>

      <div className="grid gap-5 sm:grid-cols-2">
        <Champ label="Ville" htmlFor="v-ville">
          <input
            id="v-ville"
            type="text"
            value={brouillon.city}
            onChange={(e) => setBrouillon({ ...brouillon, city: e.target.value })}
            placeholder="Ta ville"
            className={classeChamp}
          />
        </Champ>
        <Champ label="Adresse" htmlFor="v-adresse" optionnel>
          <input
            id="v-adresse"
            type="text"
            value={brouillon.address}
            onChange={(e) => setBrouillon({ ...brouillon, address: e.target.value })}
            placeholder="Rue, quartier"
            className={classeChamp}
          />
        </Champ>
      </div>

      <div>
        <Etiquette className="mb-2">Format</Etiquette>
        <Pastilles
          options={FORMATS}
          value={brouillon.fieldSize}
          onChange={(v) => setBrouillon({ ...brouillon, fieldSize: v })}
          nom="Format du terrain"
        />
      </div>

      <div>
        <Etiquette className="mb-2">Surface</Etiquette>
        <Pastilles
          options={SURFACES}
          value={brouillon.fieldSurface}
          onChange={(v) => setBrouillon({ ...brouillon, fieldSurface: v })}
          nom="Surface du terrain"
        />
      </div>

      <Champ
        label="Tarif horaire (FCFA)"
        htmlFor="v-prix"
        optionnel
        aide="Laissé vide, la fiche affiche « prix à convenir ». La plateforme n'encaisse rien : le règlement se fait entre vous et l'équipe."
      >
        <input
          id="v-prix"
          type="number"
          inputMode="numeric"
          min={0}
          step={500}
          value={brouillon.prix}
          onChange={(e) => setBrouillon({ ...brouillon, prix: e.target.value })}
          placeholder="ex: 10000"
          className={classeChamp}
        />
      </Champ>

      <div>
        <Etiquette className="mb-2">Sur place</Etiquette>
        <ChoixEquipements
          values={brouillon.equipements}
          onChange={(v) => setBrouillon({ ...brouillon, equipements: v })}
        />
      </div>

      {/* Un terrain fermé pour travaux reste référencé mais cesse d'être
          proposé : le retirer et le ressaisir ensuite serait une punition. */}
      <label className="flex cursor-pointer items-center gap-2.5 border-t border-gray-200/70 pt-5">
        <input
          type="checkbox"
          checked={brouillon.available}
          onChange={(e) => setBrouillon({ ...brouillon, available: e.target.checked })}
          className="h-4 w-4 accent-emerald-600"
        />
        <span className="text-[11px] font-bold text-gray-600">
          Ouvert aux demandes, décoche si le terrain est fermé pour le moment
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Bouton Icon={Check} onClick={onSubmit} occupe={occupe} disabled={!brouillon.name.trim()}>
          {libelle}
        </Bouton>
        <Bouton variante="contour" Icon={X} onClick={onCancel}>
          Annuler
        </Bouton>
      </div>
    </div>
  );
}

function CarteTerrain({
  v,
  onEdit,
  onRemove,
}: {
  v: Venue;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const aCompleter = manques(v);

  return (
    <article className="border border-gray-200/70 bg-white">
      <div className="flex flex-wrap gap-5 p-5">
        <div className="relative h-24 w-32 shrink-0 overflow-hidden bg-gray-900">
          {v.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.photoUrl}
              alt=""
              className={`h-full w-full object-cover ${v.available ? "" : "grayscale"}`}
            />
          ) : (
            <>
              <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
              <LignesDeTerrain className="text-white/15" />
            </>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-black uppercase tracking-tight text-gray-900">
                {v.name}
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                <MapPin size={12} />
                {[v.address, v.city].filter(Boolean).join(", ") || "Adresse non précisée"}
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <Link
                href={`/terrains/${v.id}`}
                aria-label={`Voir la fiche publique de ${v.name}`}
                className="border border-gray-200/70 p-2 text-gray-400 transition-colors hover:border-gray-900 hover:text-gray-900"
              >
                <Eye size={14} />
              </Link>
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Modifier ${v.name}`}
                className="border border-gray-200/70 p-2 text-gray-400 transition-colors hover:border-gray-900 hover:text-gray-900"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={onRemove}
                aria-label={`Retirer ${v.name}`}
                className="border border-gray-200/70 p-2 text-gray-400 transition-colors hover:border-red-500 hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
            <span>{formatCourt(v.fieldSize)}</span>
            <span>{surfaceCourte(v.fieldSurface)}</span>
            <span className={aUnPrix(v.pricePerHour) ? "text-gray-600" : ""}>
              {prixHeure(v.pricePerHour)}
            </span>
            <span className={v.available ? "text-emerald-700" : "text-red-500"}>
              {v.available ? "Ouvert" : "Fermé"}
            </span>
          </div>

          {v.amenities?.length > 0 && (
            <ListeEquipements valeurs={v.amenities} className="mt-4" />
          )}
        </div>
      </div>

      {aCompleter.length > 0 && (
        <p className="border-t border-gray-200/70 bg-amber-50 px-5 py-3 text-[11px] font-bold leading-relaxed text-amber-900">
          Il manque {aCompleter.join(", ")}. Une fiche complète est choisie plus souvent.
        </p>
      )}
    </article>
  );
}

export default function MyVenuesPage() {
  const { user, loading: authLoading } = useAuth();
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [ajout, setAjout] = useState(false);
  const [edition, setEdition] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon>(brouillonVide(""));
  const [fichier, setFichier] = useState<File | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [demandes, setDemandes] = useState<Booking[]>([]);
  const { demander, Dialogue } = useConfirmation();

  useEffect(() => {
    if (!user) return;
    return onVenuesByOwner(user.uid, setVenues);
  }, [user]);

  // Les demandes ne sont plus TRAITÉES ici, seulement COMPTÉES : le chiffre
  // renvoie vers la page qui les traite.
  useEffect(() => {
    if (!user) return;
    return onBookingsByOwner(user.uid, setDemandes);
  }, [user]);

  const enAttente = useMemo(() => {
    const today = aujourdhui();
    return demandes.filter((b) => b.status === "pending" && b.date >= today).length;
  }, [demandes]);

  if (authLoading) return <EnCours hauteur="h-[60vh] items-center" />;
  if (!user) return null;

  if (!isVenueOwner(user)) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <EtatVide
          Icon={MapPin}
          titre="Pas encore de terrain"
          action={<LienBouton href="/terrains/candidature">Référencer mon terrain</LienBouton>}
        >
          Référencer un terrain passe par une candidature : on relit la fiche
          avant de la publier. Ça ne change rien à votre rôle sur le terrain.
        </EtatVide>
      </div>
    );
  }

  const commencerAjout = () => {
    setBrouillon(brouillonVide(user.locationCity ?? ""));
    setFichier(null);
    setEdition(null);
    setAjout(true);
  };

  const commencerEdition = (v: Venue) => {
    setBrouillon(depuisTerrain(v));
    setFichier(null);
    setAjout(false);
    setEdition(v.id);
  };

  const fermer = () => {
    setAjout(false);
    setEdition(null);
    setFichier(null);
  };

  const enregistrer = async () => {
    setOccupe(true);
    try {
      const prix = Number(brouillon.prix);
      const commun = {
        name: brouillon.name.trim(),
        address: brouillon.address.trim(),
        city: brouillon.city.trim(),
        fieldSize: brouillon.fieldSize as Venue["fieldSize"],
        fieldSurface: brouillon.fieldSurface as Venue["fieldSurface"],
        fieldType: (brouillon.fieldSurface === "indoor" ? "indoor" : "outdoor") as Venue["fieldType"],
        pricePerHour: Number.isFinite(prix) && prix > 0 ? Math.round(prix) : 0,
        amenities: brouillon.equipements,
        available: brouillon.available,
      };

      // La photo a besoin de l'identifiant du terrain pour son chemin de
      // stockage : à la création, on écrit d'abord, on téléverse ensuite.
      if (edition) {
        const photoUrl = fichier ? await uploadVenuePhoto(edition, fichier) : brouillon.photoUrl;
        await updateVenue(edition, { ...commun, photoUrl });
        toast.success("Terrain mis à jour");
      } else {
        const id = await createVenue({ ...commun, ownerId: user.uid, photoUrl: null });
        if (fichier) {
          const photoUrl = await uploadVenuePhoto(id, fichier);
          await updateVenue(id, { photoUrl });
        }
        toast.success("Terrain référencé");
      }
      fermer();
    } catch (err) {
      console.error("Venue save failed:", err);
      toast.error("L'enregistrement a échoué");
    } finally {
      setOccupe(false);
    }
  };

  const retirer = async (v: Venue) => {
    const ok = await demander({
      titre: `Retirer ${v.name} ?`,
      corps: (
        <>
          Le terrain sortira de l&apos;annuaire et de la recherche : les équipes
          ne le trouveront plus et ne pourront plus demander de créneau.
          Les demandes déjà confirmées, elles, ne sont pas annulées.
        </>
      ),
      action: "Retirer le terrain",
      danger: true,
    });
    if (!ok) return;

    try {
      await deleteVenue(v.id);
      toast.success("Terrain retiré");
    } catch {
      toast.error("La suppression a échoué");
    }
  };

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <FilAriane
        items={[
          { href: "/", label: "Direct" },
          { href: "/evolution", label: "Mon rôle" },
          { label: "Mes terrains" },
        ]}
      />

      <Panneau
        surtitre="Espace terrain"
        titre="Mes terrains"
        compteur={venues?.length ? { valeur: venues.length, libelle: venues.length > 1 ? "terrains" : "terrain" } : undefined}
      >
        Un terrain référencé entre dans l&apos;annuaire, où les équipes le
        trouvent et vous demandent un créneau. Complétez sa fiche : la photo
        et le tarif décident plus que le reste.
      </Panneau>

      {/* Les demandes en attente : un compteur et une porte, pas une liste.
          Elles se traitent sur leur propre page. */}
      <Link
        href="/mes-terrains/reservations"
        className={`group mt-6 flex flex-wrap items-center justify-between gap-4 border p-5 transition-colors ${
          enAttente > 0
            ? "border-amber-200 bg-amber-50 hover:border-amber-300"
            : "border-gray-200/70 bg-white hover:border-gray-900"
        }`}
      >
        <div className="flex items-center gap-4">
          <Inbox size={22} className={enAttente > 0 ? "text-amber-600" : "text-gray-400"} />
          <div>
            <p className={`font-display text-lg font-black uppercase tracking-tight ${enAttente > 0 ? "text-amber-900" : "text-gray-900"}`}>
              {enAttente > 0
                ? `${enAttente} demande${enAttente > 1 ? "s" : ""} en attente`
                : "Aucune demande en attente"}
            </p>
            <p className={`mt-0.5 text-[11px] font-bold ${enAttente > 0 ? "text-amber-700" : "text-gray-500"}`}>
              {enAttente > 0
                ? "Une équipe attend votre réponse."
                : "Les demandes reçues apparaissent ici."}
            </p>
          </div>
        </div>
        <ArrowRight
          size={18}
          className={`shrink-0 transition-transform group-hover:translate-x-1 ${enAttente > 0 ? "text-amber-600" : "text-gray-400"}`}
        />
      </Link>

      <div className="mt-8 space-y-4">
        {!ajout && !edition && (
          <Bouton Icon={Plus} onClick={commencerAjout} petit>
            Ajouter un terrain
          </Bouton>
        )}

        {ajout && (
          <Formulaire
            brouillon={brouillon}
            setBrouillon={setBrouillon}
            onSubmit={enregistrer}
            onCancel={fermer}
            occupe={occupe}
            libelle="Référencer"
            fichier={fichier}
            setFichier={setFichier}
          />
        )}

        {venues === null ? (
          <EnCours />
        ) : venues.length === 0 && !ajout ? (
          <EtatVide
            Icon={MapPin}
            titre="Aucun terrain"
            action={<Bouton Icon={Plus} onClick={commencerAjout}>Ajouter mon terrain</Bouton>}
          >
            Référence ton premier terrain pour qu&apos;on te trouve.
          </EtatVide>
        ) : (
          venues.map((v) =>
            edition === v.id ? (
              <Formulaire
                key={v.id}
                brouillon={brouillon}
                setBrouillon={setBrouillon}
                onSubmit={enregistrer}
                onCancel={fermer}
                occupe={occupe}
                libelle="Enregistrer"
                fichier={fichier}
                setFichier={setFichier}
              />
            ) : (
              <CarteTerrain
                key={v.id}
                v={v}
                onEdit={() => commencerEdition(v)}
                onRemove={() => retirer(v)}
              />
            ),
          )
        )}
      </div>

      <Dialogue />
    </div>
  );
}
