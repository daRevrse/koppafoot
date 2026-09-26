"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MapPin, Search, SlidersHorizontal, X, Clock, CalendarCheck, CalendarDays, Camera, ArrowRight,
} from "lucide-react";
import {
  FORMATS, SURFACES, formatCourt, surfaceCourte, aUnPrix, libelleEquipement,
  dateCourte, finCreneau, libreA, libellePlage, plageDuJour, type Occupation,
} from "@/lib/terrains";
import { Etiquette, EtatVide, Bouton, Pelouse, iconeEquipement } from "@/components/venue/venue-ui";
import type { HorairesOuverture } from "@/types";

// ============================================
// L'annuaire, côté navigation.
//
// UNE PAGE POUR CELUI QUI CHERCHE OÙ JOUER, et rien d'autre. Les chiffres de
// la plateforme (« tant de terrains référencés, tant d'ouverts ») et l'appel
// aux propriétaires en pied de page parlaient à un autre public ; l'en-tête
// du site garde « J'ai un terrain » pour eux.
//
// DES IMAGES, PAS DES DÉGRADÉS. La photo du terrain quand il en a une — sa
// photo principale, sinon la première de sa galerie — et une pelouse
// dessinée sinon. Le dégradé sombre qui tenait lieu de photo faisait de la
// grille un mur de cases noires identiques.
//
// LE FILTRAGE EST LOCAL : la liste tient en mémoire, quelques centaines de
// terrains au plus, et le navigateur la trie en une milliseconde. LES VILLES
// VIENNENT DES DONNÉES, jamais d'une liste écrite en dur.
//
// « QUAND JOUER ? » EST LA PREMIÈRE QUESTION de celui qui arrive. Un jour et
// une heure posés, la liste ne garde que les terrains ouverts ET libres, et
// le créneau suit jusqu'au formulaire de la fiche.
//
// SUR TÉLÉPHONE, UNE LIGNE PAR TERRAIN : on ne compare pas trois terrains en
// faisant défiler trois écrans.
// ============================================

export interface TerrainListe {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  fieldSize: string | null;
  fieldSurface: string | null;
  pricePerHour: number;
  amenities: string[];
  /** La photo principale d'abord, puis la galerie ; vide sans photo. */
  photos: string[];
  available: boolean;
  horaires: HorairesOuverture | null;
  /** Les créneaux déjà pris à venir : date, heure, durée, rien d'autre. */
  occupations: Occupation[];
}

/** Le créneau cherché, quand il y en a un. */
interface Creneau {
  date: string;
  time: string;
  duration: number;
}

const DUREES = [
  { value: "1", label: "1 h" },
  { value: "1.5", label: "1 h 30" },
  { value: "2", label: "2 h" },
];

const rienAEcouter = () => () => {};

/**
 * La date du jour, LUE DANS LE NAVIGATEUR : le rendu serveur se fait à Paris,
 * et autour de minuit il n'y est pas le même jour qu'à Lomé. Côté serveur,
 * `null` : la carte n'annonce pas d'horaires plutôt que ceux d'un autre jour.
 */
function useAujourdhui(): string | null {
  return useSyncExternalStore(
    rienAEcouter,
    () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    },
    () => null,
  );
}

/**
 * Sans accent ni casse : « Bè » et « be » doivent se trouver l'un l'autre.
 *
 * La plage des diacritiques est écrite en échappements plutôt qu'en
 * caractères combinants littéraux : ces derniers sont invisibles dans un
 * éditeur et ne survivent pas à un copier-coller entre encodages.
 */
const plie = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const TOUS = "tous";

/** La hauteur commune des champs de la barre : ils s'alignent au pixel. */
const CHAMP =
  "h-11 w-full min-w-0 border border-gray-200/70 bg-white text-sm font-semibold text-gray-900 placeholder:font-medium placeholder:text-gray-400 focus:border-gray-900 focus:outline-none";

/** « ?date=…&heure=…&duree=… » : le créneau cherché, pour préremplir la fiche. */
const versLaFiche = (id: string, c: Creneau | null) =>
  c
    ? `/terrains/${id}?${new URLSearchParams({ date: c.date, heure: c.time, duree: String(c.duration) })}#reserver`
    : `/terrains/${id}`;

/** La photo du terrain, ou sa pelouse dessinée. */
function Visuel({ terrain }: { terrain: TerrainListe }) {
  const photo = terrain.photos[0];
  return (
    <div className="relative aspect-square w-28 shrink-0 overflow-hidden bg-emerald-700 sm:aspect-[4/3] sm:w-full">
      {photo ? (
        // next/image plutôt qu'`<img>` : la vignette fait 400px de large au
        // plus, la photo stockée en fait 1600.
        <Image
          src={photo}
          alt=""
          fill
          sizes="(max-width: 640px) 112px, (max-width: 1024px) 50vw, 400px"
          className={`object-cover transition-transform duration-500 group-hover:scale-[1.03] ${
            terrain.available ? "" : "grayscale"
          }`}
        />
      ) : (
        <Pelouse className={terrain.available ? "" : "grayscale"} />
      )}

      {!terrain.available && (
        <span className="absolute left-0 top-0 bg-gray-900 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white sm:px-3 sm:py-1.5 sm:text-[10px]">
          Fermé
        </span>
      )}

      {/* Les autres photos attendent sur la fiche : on dit qu'elles existent. */}
      {terrain.photos.length > 1 && (
        <span className="absolute bottom-2 right-2 hidden items-center gap-1 bg-white px-2 py-1 text-[10px] font-black text-gray-900 sm:inline-flex">
          <Camera size={12} />
          {terrain.photos.length}
        </span>
      )}
    </div>
  );
}

/** Le tarif, le montant en avant. */
function Prix({ montant }: { montant: number }) {
  if (!aUnPrix(montant)) {
    return <span className="text-xs font-bold text-gray-500">Prix à convenir</span>;
  }
  return (
    <span className="text-gray-900">
      <span className="text-base font-black tabular-nums">{montant.toLocaleString("fr-FR")}</span>
      <span className="ml-1 text-[11px] font-bold text-gray-500">FCFA / h</span>
    </span>
  );
}

function Carte({
  terrain,
  creneau,
  aujourdhui,
}: {
  terrain: TerrainListe;
  creneau: Creneau | null;
  aujourdhui: string | null;
}) {
  const equipements = terrain.amenities
    .map((cle) => ({ cle, label: libelleEquipement(cle) }))
    .filter((e): e is { cle: string; label: string } => Boolean(e.label));

  // Les horaires du jour qui intéresse : celui du créneau cherché, sinon
  // aujourd'hui. Rien quand le propriétaire ne les a pas posés.
  const jour = creneau?.date ?? aujourdhui;
  const plage = jour ? plageDuJour(terrain.horaires, jour) : undefined;
  const faits = [formatCourt(terrain.fieldSize), surfaceCourte(terrain.fieldSurface)].filter((f) => f !== "—");

  return (
    <Link
      href={versLaFiche(terrain.id, creneau)}
      className="group flex gap-3 border border-gray-200/70 bg-white p-3 transition-colors hover:border-gray-900 sm:flex-col sm:gap-0 sm:p-0"
    >
      <Visuel terrain={terrain} />

      <div className="flex min-w-0 flex-1 flex-col sm:p-5">
        <h2 className="font-display text-[15px] font-black uppercase leading-[1.1] tracking-tight text-gray-900 sm:text-lg">
          {terrain.name}
        </h2>

        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
          <MapPin size={12} className="shrink-0 text-gray-400" />
          <span className="truncate">
            {[terrain.address, terrain.city].filter(Boolean).join(", ") || "Adresse non précisée"}
          </span>
        </p>

        {faits.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5 sm:mt-3">
            {faits.map((f) => (
              <li
                key={f}
                className="border border-gray-200/70 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-gray-600"
              >
                {f}
              </li>
            ))}
          </ul>
        )}

        {creneau ? (
          <p className="mt-2 inline-flex w-fit items-center gap-1.5 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 sm:mt-3">
            <CalendarCheck size={12} />
            {/* Le jour est déjà dans le compteur, au-dessus de la liste. */}
            Libre {creneau.time} → {finCreneau(creneau.time, creneau.duration)}
          </p>
        ) : plage !== undefined ? (
          <p className={`mt-2 flex items-center gap-1.5 text-xs font-semibold sm:mt-3 ${plage ? "text-gray-700" : "text-gray-400"}`}>
            <Clock size={12} className="shrink-0 text-gray-400" />
            {plage ? `Aujourd'hui ${libellePlage(plage)}` : "Fermé aujourd'hui"}
          </p>
        ) : null}

        {/* Trois équipements, les autres sur la fiche : sur ordinateur
            seulement, la ligne de téléphone n'a pas la place. */}
        {equipements.length > 0 && (
          <ul className="mt-3 hidden flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-gray-500 sm:flex">
            {equipements.slice(0, 3).map((e) => {
              const Icon = iconeEquipement(e.cle);
              return (
                <li key={e.cle} className="flex items-center gap-1">
                  <Icon size={12} className="shrink-0 text-emerald-600" />
                  {e.label}
                </li>
              );
            })}
            {equipements.length > 3 && <li className="text-gray-400">+{equipements.length - 3}</li>}
          </ul>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2 sm:mt-5 sm:border-t sm:border-gray-200/70 sm:pt-4">
          <Prix montant={terrain.pricePerHour} />
          <span className="hidden items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-900 transition-colors group-hover:text-emerald-700 sm:inline-flex">
            {creneau ? "Demander" : "Voir"}
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Un choix parmi quelques-uns : format, surface. */
function Choix({
  options,
  valeur,
  onChange,
}: {
  options: { value: string; label: string }[];
  valeur: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={valeur === o.value}
          className={`h-9 border px-3 text-xs font-bold transition-colors ${
            valeur === o.value
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200/70 bg-white text-gray-600 hover:border-gray-900 hover:text-gray-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Un filtre en cours, qu'on retire d'un geste. */
function FiltreActif({ children, onRetirer }: { children: React.ReactNode; onRetirer: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetirer}
      className="inline-flex h-8 items-center gap-1.5 border border-gray-900 bg-white px-2.5 text-xs font-bold text-gray-900 transition-colors hover:bg-gray-900 hover:text-white"
    >
      {children}
      <X size={12} aria-label="Retirer" />
    </button>
  );
}

export default function AnnuaireTerrains({ terrains }: { terrains: TerrainListe[] }) {
  const [q, setQ] = useState("");
  const [ville, setVille] = useState(TOUS);
  const [format, setFormat] = useState(TOUS);
  const [surface, setSurface] = useState(TOUS);
  const [ouvertsSeuls, setOuvertsSeuls] = useState(false);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [duree, setDuree] = useState("1.5");
  const [tri, setTri] = useState<"pertinence" | "prix">("pertinence");
  const aujourdhui = useAujourdhui();

  /** Un créneau ne vaut que complet : un jour sans heure ne dit pas quand. */
  const creneau = useMemo<Creneau | null>(
    () => (date && heure ? { date, time: heure, duration: Number(duree) } : null),
    [date, heure, duree],
  );

  const villes = useMemo(() => {
    const set = new Set(terrains.map((t) => t.city).filter((c): c is string => Boolean(c)));
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [terrains]);

  const resultats = useMemo(() => {
    const besoin = plie(q.trim());
    const garde = terrains.filter((t) => {
      if (ouvertsSeuls && !t.available) return false;
      if (ville !== TOUS && t.city !== ville) return false;
      if (format !== TOUS && t.fieldSize !== format) return false;
      if (surface !== TOUS && t.fieldSurface !== surface) return false;
      // Un créneau posé écarte les terrains fermés à ce moment, ceux déjà
      // pris, et ceux qui ne prennent pas de demande du tout.
      if (creneau) {
        if (!t.available) return false;
        const { ouvert, libre } = libreA(t.horaires, t.occupations, creneau);
        if (!ouvert || !libre) return false;
      }
      if (!besoin) return true;
      return plie(`${t.name} ${t.city ?? ""} ${t.address ?? ""}`).includes(besoin);
    });
    if (tri === "prix") {
      // Les « prix à convenir » à la fin : on ne compare pas un tarif à rien.
      const prix = (t: TerrainListe) => (aUnPrix(t.pricePerHour) ? t.pricePerHour : Infinity);
      return [...garde].sort((a, b) => prix(a) - prix(b));
    }
    return garde;
  }, [terrains, q, ville, format, surface, ouvertsSeuls, creneau, tri]);

  /** Les filtres du panneau : leur nombre s'affiche sur le bouton qui l'ouvre. */
  const dansLePanneau = [ville !== TOUS, format !== TOUS, surface !== TOUS, ouvertsSeuls].filter(Boolean).length;
  const filtre = dansLePanneau > 0 || q.trim() !== "" || !!creneau;

  const reinitialiser = () => {
    setQ("");
    setVille(TOUS);
    setFormat(TOUS);
    setSurface(TOUS);
    setOuvertsSeuls(false);
    setDate("");
    setHeure("");
  };

  const libelle = (liste: readonly { value: string; label: string }[], v: string) =>
    liste.find((o) => o.value === v)?.label ?? v;

  return (
    <>
      {/* L'en-tête dit ce qu'on vient faire ici, et le montre : une photo de
          terrain, pas un fond sombre. */}
      <section className="border-b border-gray-200/70 bg-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 pb-8 pt-4 sm:px-10 sm:pb-12 sm:pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-12 lg:py-10">
          <div className="order-2 lg:order-1">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Terrains de foot</p>
            <h1 className="mt-3 font-display text-5xl font-black uppercase leading-[0.9] tracking-[-0.03em] text-gray-900 sm:text-7xl">
              Où jouer
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-gray-600">
              Choisis un terrain et demande ton créneau : le propriétaire te répond directement.
            </p>
          </div>
          <div className="relative order-1 aspect-[2/1] overflow-hidden bg-emerald-800 sm:aspect-[16/9] lg:order-2 lg:aspect-[2/1]">
            <Image
              src="/branding/fan_terrain.png"
              alt="Un terrain de foot à cinq éclairé, en soirée"
              fill
              fetchPriority="high"
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover object-[50%_60%]"
            />
          </div>
        </div>
      </section>

      {/* La barre de recherche colle en haut : sur une liste qu'on parcourt,
          le filtre qu'il faut remonter chercher n'est pas utilisé. */}
      <div className="sticky top-[var(--marketing-header-h,75px)] z-40 border-b border-gray-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-10">
          {/* Téléphone : la recherche et le bouton Filtres, puis « quand ».
              Ordinateur : tout sur une rangée. */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Terrain, quartier, ville…"
                aria-label="Rechercher un terrain"
                className={`${CHAMP} pl-10 pr-3`}
              />
            </div>

            {/* « Quand ? » reste hors du panneau : c'est LA question. */}
            <div className="order-3 col-span-2 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] gap-2 lg:order-2 lg:col-span-1 lg:flex">
              <label className="relative block lg:w-44">
                <CalendarDays size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={date}
                  min={aujourdhui ?? undefined}
                  onChange={(e) => setDate(e.target.value)}
                  aria-label="Quand jouer : le jour"
                  className={`${CHAMP} pl-8 pr-1.5 text-[13px] sm:pl-9 sm:pr-2 sm:text-sm`}
                />
              </label>
              <label className="relative block lg:w-32">
                <Clock size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="time"
                  step={1800}
                  value={heure}
                  onChange={(e) => setHeure(e.target.value)}
                  aria-label="Quand jouer : l'heure"
                  className={`${CHAMP} pl-8 pr-1.5 text-[13px] sm:pl-9 sm:pr-2 sm:text-sm`}
                />
              </label>
              <select
                value={duree}
                onChange={(e) => setDuree(e.target.value)}
                aria-label="Quand jouer : la durée"
                className={`${CHAMP} w-auto px-2`}
              >
                {DUREES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setFiltresOuverts((v) => !v)}
              aria-expanded={filtresOuverts}
              aria-label="Filtres"
              className={`order-2 flex h-11 items-center gap-2 border px-3 text-xs font-bold transition-colors sm:px-4 lg:order-3 ${
                filtresOuverts
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200/70 bg-white text-gray-700 hover:border-gray-900"
              }`}
            >
              <SlidersHorizontal size={15} />
              <span className="hidden sm:inline">Filtres</span>
              {dansLePanneau > 0 && (
                <span className={`px-1.5 text-[10px] font-black ${filtresOuverts ? "bg-white text-gray-900" : "bg-gray-900 text-white"}`}>
                  {dansLePanneau}
                </span>
              )}
            </button>
          </div>

          {date && !heure && (
            <p className="mt-2 text-xs font-semibold text-gray-500">Ajoute une heure pour voir les terrains libres.</p>
          )}

          {/* Le panneau vit dans la barre qui colle en haut : sur téléphone,
              il défile en lui-même plutôt que de pousser la liste hors de
              l'écran, et se ferme sur le nombre de terrains qu'il garde. */}
          {filtresOuverts && (
            <div className="mt-3 grid max-h-[60vh] gap-4 overflow-y-auto border-t border-gray-200/70 pb-1 pt-4 sm:max-h-none sm:grid-cols-2 sm:overflow-visible lg:grid-cols-[auto_auto_minmax(0,14rem)_auto] lg:gap-8">
              <div>
                <Etiquette className="mb-2">Format</Etiquette>
                <Choix
                  options={[{ value: TOUS, label: "Tous" }, ...FORMATS.map((f) => ({ value: f.value, label: f.court }))]}
                  valeur={format}
                  onChange={setFormat}
                />
              </div>
              <div>
                <Etiquette className="mb-2">Surface</Etiquette>
                <Choix
                  options={[{ value: TOUS, label: "Toutes" }, ...SURFACES.map((s) => ({ value: s.value, label: s.court }))]}
                  valeur={surface}
                  onChange={setSurface}
                />
              </div>
              {villes.length > 1 && (
                <div>
                  <Etiquette className="mb-2">Ville</Etiquette>
                  <select
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    aria-label="Filtrer par ville"
                    className={`${CHAMP} h-9 px-2 text-xs`}
                  >
                    <option value={TOUS}>Toutes les villes</option>
                    {villes.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <Etiquette className="mb-2">Disponibilité</Etiquette>
                <label className="flex h-9 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={ouvertsSeuls}
                    onChange={(e) => setOuvertsSeuls(e.target.checked)}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <span className="text-xs font-bold text-gray-700">Ouverts aux demandes</span>
                </label>
              </div>
              <Bouton petit onClick={() => setFiltresOuverts(false)} className="w-full sm:hidden">
                Voir {resultats.length} terrain{resultats.length > 1 ? "s" : ""}
              </Bouton>
            </div>
          )}
        </div>
      </div>

      <section className="bg-gray-50 py-6 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-10">
          {/* Ce qu'on voit, et pourquoi : le compte, les filtres posés (un
              clic les retire), le tri. */}
          <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6">
            <p aria-live="polite" className="mr-2 text-sm font-bold text-gray-900">
              {resultats.length} terrain{resultats.length > 1 ? "s" : ""}
              {creneau && (
                <span className="font-semibold text-gray-500">
                  {" "}libre{resultats.length > 1 ? "s" : ""} {dateCourte(creneau.date)} à {creneau.time}
                </span>
              )}
            </p>

            {creneau && (
              <FiltreActif onRetirer={() => { setDate(""); setHeure(""); }}>
                {dateCourte(creneau.date)} · {creneau.time}
              </FiltreActif>
            )}
            {format !== TOUS && <FiltreActif onRetirer={() => setFormat(TOUS)}>{libelle(FORMATS, format)}</FiltreActif>}
            {surface !== TOUS && <FiltreActif onRetirer={() => setSurface(TOUS)}>{libelle(SURFACES, surface)}</FiltreActif>}
            {ville !== TOUS && <FiltreActif onRetirer={() => setVille(TOUS)}>{ville}</FiltreActif>}
            {ouvertsSeuls && <FiltreActif onRetirer={() => setOuvertsSeuls(false)}>Ouverts</FiltreActif>}
            {filtre && (
              <button
                type="button"
                onClick={reinitialiser}
                className="h-8 px-1 text-xs font-bold text-gray-500 underline-offset-2 transition-colors hover:text-gray-900 hover:underline"
              >
                Tout effacer
              </button>
            )}

            <label className="ml-auto flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Trier</span>
              <select
                value={tri}
                onChange={(e) => setTri(e.target.value as "pertinence" | "prix")}
                aria-label="Trier les terrains"
                className="h-8 border border-gray-200/70 bg-white px-2 text-xs font-bold text-gray-900 focus:border-gray-900 focus:outline-none"
              >
                <option value="pertinence">Ouverts d&apos;abord</option>
                <option value="prix">Prix croissant</option>
              </select>
            </label>
          </div>

          {resultats.length === 0 ? (
            terrains.length === 0 ? (
              <EtatVide Icon={MapPin} titre="Aucun terrain pour l'instant">
                Les terrains apparaîtront ici dès qu&apos;ils seront référencés.
              </EtatVide>
            ) : (
              <EtatVide
                Icon={Search}
                titre="Rien ne correspond"
                action={<Bouton onClick={reinitialiser}>Effacer les filtres</Bouton>}
              >
                {creneau
                  ? "Aucun terrain n'est ouvert et libre à ce moment. Essaie une autre heure ou un autre jour."
                  : "Aucun terrain ne réunit ces critères. Élargis la recherche."}
              </EtatVide>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {resultats.map((t) => (
                <Carte key={t.id} terrain={t} creneau={creneau} aujourdhui={aujourdhui} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
