"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Search, SlidersHorizontal, X, Clock, CalendarCheck } from "lucide-react";
import {
  FORMATS, SURFACES, formatCourt, surfaceCourte, prixHeure, aUnPrix, libelleEquipement,
  dateCourte, finCreneau, libreA, libellePlage, plageDuJour, type Occupation,
} from "@/lib/terrains";
import { LignesDeTerrain, Etiquette, Fanion, EtatVide, LienBouton } from "@/components/venue/venue-ui";
import type { HorairesOuverture } from "@/types";

// ============================================
// L'annuaire, côté navigation.
//
// LE FILTRAGE EST LOCAL, et c'est un choix de taille : la liste tient en
// mémoire, quelques centaines de terrains au plus. Une requête par frappe
// aurait coûté un aller-retour à chaque lettre pour un tri que le navigateur
// fait en une milliseconde.
//
// LES VILLES VIENNENT DES DONNÉES, jamais d'une liste écrite en dur. La
// version au placard proposait « Paris, Lyon, Marseille, Toulouse » à un
// produit dont les terrains sont à Lomé : trois filtres sur quatre ne
// rendaient rien, et le quatrième non plus.
//
// « QUAND JOUER ? » EST LA PREMIÈRE QUESTION de celui qui arrive, et la liste
// n'y répondait pas : il fallait ouvrir chaque fiche pour découvrir que le
// terrain fermait à 20 h, ou qu'il était déjà pris samedi. Un jour et une
// heure posés, la liste ne garde que les terrains ouverts ET libres, et le
// créneau suit jusqu'au formulaire de la fiche.
//
// SUR TÉLÉPHONE, UNE LIGNE PAR TERRAIN. La carte d'ordinateur, photo 4:3
// pleine largeur, montrait un terrain par écran : on ne compare pas trois
// terrains en faisant défiler trois écrans.
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
  photoUrl: string | null;
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
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const TOUS = "tous";

/**
 * La vignette d'un terrain sans photo.
 *
 * Une case grise aurait dit « il manque quelque chose ». Le marquage vert dit
 * « c'est un terrain », ce qui est exactement l'information disponible.
 */
function Vignette({ terrain }: { terrain: TerrainListe }) {
  return (
    <div className="relative aspect-square w-24 shrink-0 overflow-hidden bg-gray-900 sm:aspect-[4/3] sm:w-full">
      {terrain.photoUrl ? (
        <>
          {/* next/image plutôt qu'`<img>` : la vignette fait 400px de large au
              plus, la photo stockée en fait 1600. Ce n'est possible que depuis
              que next.config n'accepte plus que Firebase Storage. */}
          <Image
            src={terrain.photoUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 96px, (max-width: 1024px) 50vw, 33vw"
            className={`object-cover transition-transform duration-500 group-hover:scale-[1.03] ${
              terrain.available ? "" : "grayscale"
            }`}
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </>
      ) : (
        <>
          <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
          <LignesDeTerrain className="text-white/15" />
        </>
      )}

      {!terrain.available && (
        <span className="absolute left-0 top-0 bg-gray-900 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white sm:px-3 sm:py-1.5 sm:text-[10px]">
          Fermé
        </span>
      )}

      <p className="absolute bottom-0 left-0 right-0 hidden px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/90 sm:block">
        {aUnPrix(terrain.pricePerHour) ? prixHeure(terrain.pricePerHour) : "Prix à convenir"}
      </p>
    </div>
  );
}

/** « ?date=…&heure=…&duree=… » : le créneau cherché, pour préremplir la fiche. */
const versLaFiche = (id: string, c: Creneau | null) =>
  c
    ? `/terrains/${id}?${new URLSearchParams({ date: c.date, heure: c.time, duree: String(c.duration) })}#reserver`
    : `/terrains/${id}`;

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
    .map((a) => libelleEquipement(a))
    .filter((l): l is string => Boolean(l));

  // Les horaires du jour qui intéresse : celui du créneau cherché, sinon
  // aujourd'hui. Rien quand le propriétaire ne les a pas posés.
  const jour = creneau?.date ?? aujourdhui;
  const plage = jour ? plageDuJour(terrain.horaires, jour) : undefined;

  return (
    <Link
      href={versLaFiche(terrain.id, creneau)}
      className="group flex gap-4 bg-white p-3 transition-colors hover:bg-gray-50 sm:flex-col sm:gap-0 sm:p-0"
    >
      <Vignette terrain={terrain} />

      <div className="flex min-w-0 flex-1 flex-col sm:p-5">
        <h2 className="font-display text-base font-black uppercase leading-[1.05] tracking-tight text-gray-900 sm:text-xl">
          {terrain.name}
        </h2>

        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-gray-500 sm:mt-2">
          <MapPin size={12} className="shrink-0 text-gray-400" />
          <span className="truncate">
            {[terrain.address, terrain.city].filter(Boolean).join(", ") || "Adresse non précisée"}
          </span>
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 sm:mt-4 sm:gap-x-4">
          <span>{formatCourt(terrain.fieldSize)}</span>
          <span aria-hidden className="text-gray-200">/</span>
          <span>{surfaceCourte(terrain.fieldSurface)}</span>
        </div>

        {/* Sur téléphone, le tarif quitte la photo, trop petite pour lui. */}
        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-gray-700 sm:hidden">
          {aUnPrix(terrain.pricePerHour) ? prixHeure(terrain.pricePerHour) : "Prix à convenir"}
        </p>

        {creneau ? (
          <p className="mt-2 inline-flex w-fit items-center gap-1.5 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-800 sm:mt-3">
            <CalendarCheck size={12} />
            {/* Le jour est déjà dans le compteur, au-dessus de la liste. */}
            Libre {creneau.time} → {finCreneau(creneau.time, creneau.duration)}
          </p>
        ) : plage !== undefined ? (
          <p className={`mt-2 flex items-center gap-1.5 text-[11px] font-bold sm:mt-3 ${plage ? "text-gray-600" : "text-gray-400"}`}>
            <Clock size={12} className="shrink-0 text-gray-400" />
            {plage ? `Aujourd'hui ${libellePlage(plage)}` : "Fermé aujourd'hui"}
          </p>
        ) : null}

        {equipements.length > 0 && (
          <p className="mt-3 hidden line-clamp-1 text-[11px] font-semibold text-gray-500 sm:block">
            {equipements.slice(0, 3).join(" · ")}
            {equipements.length > 3 && ` +${equipements.length - 3}`}
          </p>
        )}

        <span className="mt-5 hidden items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-900 transition-colors group-hover:text-emerald-700 sm:inline-flex">
          {creneau ? "Demander ce créneau" : "Voir le terrain"}
          <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
        </span>
      </div>
    </Link>
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

  const filtre = ville !== TOUS || format !== TOUS || surface !== TOUS || ouvertsSeuls || q.trim() !== ""
    || !!creneau;

  const reinitialiser = () => {
    setQ("");
    setVille(TOUS);
    setFormat(TOUS);
    setSurface(TOUS);
    setOuvertsSeuls(false);
    setDate("");
    setHeure("");
  };

  const ouverts = terrains.filter((t) => t.available).length;

  return (
    <>
      {/* L'en-tête dit d'emblée ce qu'on peut faire ici — demander un créneau —
          parce que c'est la question de celui qui arrive, pas « qu'est-ce que
          MyFields ». La vitrine des propriétaires est un clic plus loin. */}
      <section className="relative overflow-hidden bg-gray-900 text-white">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
        <LignesDeTerrain className="text-white/[0.07]" />

        <div className="relative mx-auto max-w-7xl px-6 pb-14 pt-28 sm:px-10 sm:pb-20 sm:pt-36">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300">MyFields</p>
          <h1 className="mt-5 max-w-4xl font-display text-[13vw] font-black uppercase leading-[0.86] tracking-[-0.03em] sm:text-[9vw] lg:text-[7vw]">
            Où jouer
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-relaxed text-white/70">
            {terrains.length === 0
              ? "Aucun terrain n'est encore référencé. Le premier peut être le vôtre."
              : `${terrains.length} terrain${terrains.length > 1 ? "s" : ""} référencé${terrains.length > 1 ? "s" : ""}, ${ouverts} ouvert${ouverts > 1 ? "s" : ""} aux demandes. Choisissez, demandez un créneau, le propriétaire répond.`}
          </p>
        </div>
      </section>

      {/* La barre de filtres colle en haut : sur une liste qu'on parcourt, le
          filtre qu'il faut remonter chercher n'est pas utilisé. */}
      <div className="sticky top-[var(--marketing-header-h,75px)] z-40 border-b border-gray-200/70 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 py-4 sm:px-10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom du terrain, quartier, ville…"
                aria-label="Rechercher un terrain"
                className="w-full border border-gray-200/70 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-gray-900 placeholder:font-medium placeholder:text-gray-300 focus:border-gray-900 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setFiltresOuverts((v) => !v)}
              aria-expanded={filtresOuverts}
              className={`flex shrink-0 items-center gap-2 border px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
                filtresOuverts || filtre
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
              }`}
            >
              <SlidersHorizontal size={14} />
              Filtrer
            </button>

            {filtre && (
              <button
                type="button"
                onClick={reinitialiser}
                aria-label="Tout effacer"
                className="flex shrink-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-red-500"
              >
                {/* L'icône seule sur téléphone : le libellé mangeait le champ
                    de recherche, réduit à trois lettres. */}
                <X size={13} /> <span className="hidden sm:inline">Tout effacer</span>
              </button>
            )}
          </div>

          {/* Quand jouer : hors du panneau replié, parce que c'est LA question. */}
          {/* UNE SEULE RANGÉE, même sur téléphone : la barre colle en haut, et
              chaque ligne qu'elle gagne est une ligne de liste en moins. */}
          <div className="mt-3 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
            <span className="hidden text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 sm:inline">
              Quand ?
            </span>
            <input
              type="date"
              value={date}
              min={aujourdhui ?? undefined}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Quand jouer : le jour"
              className="min-w-0 border border-gray-200/70 bg-white px-2 py-2 text-xs font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
            />
            <input
              type="time"
              step={1800}
              value={heure}
              onChange={(e) => setHeure(e.target.value)}
              aria-label="Quand jouer : l'heure"
              className="min-w-0 border border-gray-200/70 bg-white px-2 py-2 text-xs font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
            />
            <select
              value={duree}
              onChange={(e) => setDuree(e.target.value)}
              aria-label="Quand jouer : la durée"
              className="border border-gray-200/70 bg-white px-2 py-2 text-xs font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
            >
              {DUREES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            {date && !heure && (
              <span className="col-span-3 text-[11px] font-bold text-gray-400">Ajoutez une heure</span>
            )}
          </div>

          {filtresOuverts && (
            <div className="mt-5 grid gap-5 border-t border-gray-200/70 pt-5 sm:grid-cols-2">
              {villes.length > 0 && (
                <div>
                  <Etiquette className="mb-2">Ville</Etiquette>
                  <select
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    aria-label="Filtrer par ville"
                    className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
                  >
                    <option value={TOUS}>Toutes les villes</option>
                    {villes.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={ouvertsSeuls}
                    onChange={(e) => setOuvertsSeuls(e.target.checked)}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <span className="text-[11px] font-bold text-gray-600">
                    Masquer les terrains fermés
                  </span>
                </label>
              </div>

              <div>
                <Etiquette className="mb-2">Trier</Etiquette>
                <select
                  value={tri}
                  onChange={(e) => setTri(e.target.value as "pertinence" | "prix")}
                  aria-label="Trier les terrains"
                  className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
                >
                  <option value="pertinence">Les ouverts d&apos;abord</option>
                  <option value="prix">Prix croissant</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <Etiquette className="mb-2">Format</Etiquette>
                <div className="flex flex-wrap gap-2">
                  {[{ value: TOUS, label: "Tous" }, ...FORMATS].map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setFormat(o.value)}
                      aria-pressed={format === o.value}
                      className={`border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
                        format === o.value
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <Etiquette className="mb-2">Surface</Etiquette>
                <div className="flex flex-wrap gap-2">
                  {[{ value: TOUS, label: "Toutes" }, ...SURFACES].map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setSurface(o.value)}
                      aria-pressed={surface === o.value}
                      className={`border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
                        surface === o.value
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
            <Etiquette aria-live="polite">
              {resultats.length} terrain{resultats.length > 1 ? "s" : ""}
              {creneau && ` libre${resultats.length > 1 ? "s" : ""} ${dateCourte(creneau.date)} à ${creneau.time}`}
              {filtre && ` sur ${terrains.length}`}
            </Etiquette>
            <Link
              href="/terrains"
              className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-emerald-700"
            >
              J&apos;ai un terrain à référencer →
            </Link>
          </div>

          {resultats.length === 0 ? (
            terrains.length === 0 ? (
              <EtatVide
                Icon={MapPin}
                titre="Aucun terrain référencé"
                action={<LienBouton href="/terrains">Référencer le premier</LienBouton>}
              >
                La liste s&apos;ouvrira dès qu&apos;un propriétaire aura déposé sa fiche.
              </EtatVide>
            ) : (
              <EtatVide
                Icon={Search}
                titre="Rien ne correspond"
                action={
                  <button
                    type="button"
                    onClick={reinitialiser}
                    className="inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
                  >
                    Effacer les filtres
                  </button>
                }
              >
                {creneau
                  ? "Aucun terrain n'est ouvert et libre à ce moment. Essayez une autre heure ou un autre jour."
                  : "Aucun terrain ne réunit ces critères. Élargissez la recherche."}
              </EtatVide>
            )
          ) : (
            // Le filet d'un cheveu entre les cartes plutôt qu'un espace : la
            // grille se lit comme un tableau d'affichage, pas comme un tas de
            // vignettes flottantes.
            <div className="grid gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-2 lg:grid-cols-3">
              {resultats.map((t) => (
                <Carte key={t.id} terrain={t} creneau={creneau} aujourdhui={aujourdhui} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* La sortie pour l'autre public : celui qui possède le terrain qu'il
          ne trouve pas dans cette liste. */}
      <section className="border-t border-gray-200/70 bg-gray-50 py-16 sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-8 px-6 sm:px-10">
          <div className="max-w-xl">
            <Fanion ton="ok">Propriétaires</Fanion>
            <h2 className="mt-4 font-display text-3xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-4xl">
              Votre terrain n&apos;est pas dans la liste ?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600">
              Déposez sa fiche : on la relit, puis il apparaît ici et les
              équipes peuvent vous demander un créneau.
            </p>
          </div>
          <LienBouton href="/terrains/candidature">Référencer mon terrain</LienBouton>
        </div>
      </section>
    </>
  );
}
