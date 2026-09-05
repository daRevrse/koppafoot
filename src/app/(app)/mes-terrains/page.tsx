"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MapPin, Plus, Trash2, Pencil, Check, X, ImagePlus, ArrowRight, Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  onVenuesByOwner, createVenue, updateVenue, deleteVenue, onBookingsByOwner,
} from "@/lib/firestore";
import { uploadVenuePhoto } from "@/lib/storage";
import { alleger, poidsLisible, REGLAGES } from "@/lib/images";
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
  /** Les photos deja enregistrees. Les nouvelles arrivent a part, en fichiers. */
  galerie: string[];
  available: boolean;
}

/** Au-dela, une fiche devient un album et personne ne fait defiler. */
const GALERIE_MAX = 6;

const brouillonVide = (city: string): Brouillon => ({
  name: "", address: "", city, fieldSize: "11v11", fieldSurface: "synthetic",
  prix: "", equipements: [], photoUrl: null, galerie: [], available: true,
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
  galerie: v.galleryUrls ?? [],
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
  fichiersGalerie,
  setFichiersGalerie,
}: {
  brouillon: Brouillon;
  setBrouillon: (b: Brouillon) => void;
  onSubmit: () => void;
  onCancel: () => void;
  occupe: boolean;
  libelle: string;
  fichier: File | null;
  setFichier: (f: File | null) => void;
  fichiersGalerie: File[];
  setFichiersGalerie: (f: File[]) => void;
}) {
  const [apercu, setApercu] = useState<string | null>(null);
  const [gain, setGain] = useState<string | null>(null);
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

  const choisir = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Choisis une image (PNG, JPG, WebP)."); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("Image trop lourde (10 Mo maximum)."); return; }
    // Une photo de telephone fait 3 a 5 Mo pour 4000 pixels de large. Elle est
    // reduite ICI, avant l'envoi : ce qui part vers Storage est ce qui sera
    // reellement affiche, pas l'original.
    const leger = await alleger(f, REGLAGES.photo);
    poser(leger);
    setGain(leger.size < f.size * 0.9 ? `${poidsLisible(f.size)} → ${poidsLisible(leger.size)}` : null);
  };

  /** Les photos supplementaires, choisies plusieurs a la fois. */
  const ajouterALaGalerie = async (liste: FileList | null) => {
    if (!liste?.length) return;
    const place = GALERIE_MAX - (brouillon.galerie.length + fichiersGalerie.length);
    if (place <= 0) { toast.error(`${GALERIE_MAX} photos au maximum.`); return; }

    const retenus: File[] = [];
    for (const f of Array.from(liste).slice(0, place)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} dépasse 10 Mo.`); continue; }
      retenus.push(await alleger(f, REGLAGES.photo));
    }
    if (retenus.length) setFichiersGalerie([...fichiersGalerie, ...retenus]);
  };

  const montree = apercu ?? brouillon.photoUrl;

  return (
    <div className="space-y-6 border border-gray-200/70 bg-white p-5 sm:p-6">
      {/* La photo d'abord : c'est le champ qui change le plus les demandes,
          et le mettre en dernier revenait à le faire sauter. */}
      <div>
        <Etiquette className="mb-2">Photo de couverture</Etiquette>
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
            {gain ? (
              <p className="text-[11px] font-bold text-emerald-700">Allégée : {gain}</p>
            ) : (
              <p className="text-[11px] leading-relaxed text-gray-400">
                Une vue large de la pelouse vaut mieux qu&apos;un gros plan :
                c&apos;est l&apos;image du bandeau, celle sur laquelle une équipe
                choisit. Réduite automatiquement avant l&apos;envoi.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* LA GALERIE. Une seule photo pour louer un terrain, c'est peu : une
          equipe veut voir la pelouse, les vestiaires, l'eclairage de nuit.
          Les equipes et les profils avaient deja la leur ; le terrain, qui est
          pourtant ce qu'on loue, n'avait qu'une image. */}
      <div>
        <Etiquette className="mb-2">
          Autres photos ({brouillon.galerie.length + fichiersGalerie.length}/{GALERIE_MAX})
        </Etiquette>

        <div className="flex flex-wrap gap-3">
          {brouillon.galerie.map((u) => (
            <div key={u} className="group relative h-20 w-28 overflow-hidden border border-gray-200/70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Retirer cette photo"
                onClick={() => setBrouillon({ ...brouillon, galerie: brouillon.galerie.filter((x) => x !== u) })}
                className="absolute right-0 top-0 bg-gray-900/80 p-1.5 text-white transition-colors hover:bg-red-600"
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {fichiersGalerie.map((f, i) => (
            <div key={`${f.name}-${i}`} className="group relative h-20 w-28 overflow-hidden border border-emerald-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-0 left-0 bg-emerald-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                Nouvelle
              </span>
              <button
                type="button"
                aria-label="Retirer cette photo"
                onClick={() => setFichiersGalerie(fichiersGalerie.filter((_, j) => j !== i))}
                className="absolute right-0 top-0 bg-gray-900/80 p-1.5 text-white transition-colors hover:bg-red-600"
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {brouillon.galerie.length + fichiersGalerie.length < GALERIE_MAX && (
            <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-gray-200/70 text-gray-400 transition-colors hover:border-gray-900 hover:text-gray-900">
              <ImagePlus size={16} />
              <span className="text-[9px] font-black uppercase tracking-[0.1em]">Ajouter</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void ajouterALaGalerie(e.target.files)}
              />
            </label>
          )}
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
          Jusqu&apos;à {GALERIE_MAX} vues, réduites automatiquement. Elles
          apparaissent sur la fiche publique, sous la réservation.
        </p>
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
    // LA PHOTO PREND TOUTE LA LARGEUR SUR TÉLÉPHONE.
    //
    // Elle était une vignette de 128px posée à gauche : sur 375 pixels, il
    // restait ~180px à la colonne de droite, et les huit pastilles
    // d'équipement y tombaient UNE PAR LIGNE. La fiche d'un terrain équipé
    // faisait huit rangées pour dire ce qui tient en deux.
    <article className="border border-gray-200/70 bg-white">
      <div className="sm:flex sm:gap-5 sm:p-5">
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-gray-900 sm:aspect-auto sm:h-24 sm:w-32">
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

        <div className="min-w-0 flex-1 p-5 sm:p-0">
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

          {/* Quatre faits ÉTIQUETÉS plutôt qu'une ligne en vrac. « 11V11
              SYNTHÉTIQUE 25 000 FCFA / H OUVERT » se lisait comme une seule
              phrase sans ponctuation : rien ne disait lequel des nombres
              était le tarif. */}
          <dl className="mt-4 grid grid-cols-2 gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-4">
            {[
              { label: "Format", valeur: formatCourt(v.fieldSize) },
              { label: "Surface", valeur: surfaceCourte(v.fieldSurface) },
              { label: "Tarif", valeur: prixHeure(v.pricePerHour), fort: aUnPrix(v.pricePerHour) },
              {
                label: "État",
                valeur: v.available ? "Ouvert" : "Fermé",
                ton: v.available ? "text-emerald-700" : "text-red-500",
              },
            ].map((f) => (
              <div key={f.label} className="bg-white px-3 py-2.5">
                <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">
                  {f.label}
                </dt>
                <dd className={`mt-0.5 truncate text-[11px] font-black uppercase tracking-tight ${f.ton ?? (f.fort ? "text-gray-900" : "text-gray-600")}`}>
                  {f.valeur}
                </dd>
              </div>
            ))}
          </dl>

          {v.amenities?.length > 0 && (
            <ListeEquipements valeurs={v.amenities} dense className="mt-3" />
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
  const [fichiersGalerie, setFichiersGalerie] = useState<File[]>([]);
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
    setFichiersGalerie([]);
    setEdition(null);
    setAjout(true);
  };

  const commencerEdition = (v: Venue) => {
    setBrouillon(depuisTerrain(v));
    setFichier(null);
    setFichiersGalerie([]);
    setAjout(false);
    setEdition(v.id);
  };

  const fermer = () => {
    setAjout(false);
    setEdition(null);
    setFichier(null);
    setFichiersGalerie([]);
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

      // Les images ont besoin de l'identifiant du terrain pour leur chemin de
      // stockage : à la création, on écrit d'abord, on téléverse ensuite.
      //
      // Les envois de la galerie partent EN PARALLÈLE : les faire à la queue
      // leu leu ferait attendre six fois de suite quelqu'un qui a choisi six
      // photos d'un coup.
      const televerser = async (id: string) => {
        const [couverture, ajouts] = await Promise.all([
          fichier ? uploadVenuePhoto(id, fichier) : Promise.resolve(brouillon.photoUrl),
          Promise.all(fichiersGalerie.map((f) => uploadVenuePhoto(id, f))),
        ]);
        return { photoUrl: couverture, galleryUrls: [...brouillon.galerie, ...ajouts] };
      };

      if (edition) {
        const medias = await televerser(edition);
        await updateVenue(edition, { ...commun, ...medias });
        toast.success("Terrain mis à jour");
      } else {
        const id = await createVenue({
          ...commun, ownerId: user.uid, photoUrl: null, galleryUrls: [],
        });
        if (fichier || fichiersGalerie.length) {
          await updateVenue(id, await televerser(id));
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
      />

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
            fichiersGalerie={fichiersGalerie}
            setFichiersGalerie={setFichiersGalerie}
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
                fichiersGalerie={fichiersGalerie}
                setFichiersGalerie={setFichiersGalerie}
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
