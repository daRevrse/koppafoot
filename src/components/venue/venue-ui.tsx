"use client";

import { useSyncExternalStore } from "react";
import {
  DoorOpen, ShowerHead, Lightbulb, ParkingCircle, CupSoda,
  Armchair, Goal, Droplets, ShieldCheck, BriefcaseMedical, Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  EQUIPEMENTS, JOURS, libelleEquipement, libellePlage, horairesParDefaut,
} from "@/lib/terrains";
import type { HorairesOuverture } from "@/types";

// ============================================
// Ce qui n'appartient qu'aux terrains.
//
// Le reste — champs, pastilles, boutons, fanions, confirmation, marquage de
// terrain — vit dans components/ui/socle : ces primitives ont quitté ce
// fichier le jour où l'authentification en a eu besoin, et les réexporter
// ici évite de réécrire les imports des huit écrans du parcours.
// ============================================

export * from "@/components/ui/socle";

/**
 * L'en-tête d'un écran du parcours.
 *
 * Il était recopié trois fois, avec à chaque fois un léger écart : l'un
 * portait une phrase d'explication, l'autre non, le troisième un dégradé
 * inversé. Un seul composant, donc.
 *
 * FOND NOIR UNI, SANS PHRASE. Il portait un dégradé sur trois teintes, le
 * marquage d'un terrain en filigrane, et cinq lignes de texte qui
 * expliquaient l'écran. Sur un téléphone, cette explication occupait un tiers
 * de la hauteur au-dessus du contenu — et on ne la lit qu'une fois, à la
 * première visite, alors qu'on la traverse à chaque passage. Le titre et le
 * compteur suffisent à dire où l'on est.
 *
 * La phrase disparaît aussi de la signature : une propriété qu'on accepte
 * sans la rendre est un piège pour le prochain qui la passera. Git garde les
 * textes si la décision change.
 */
export function Panneau({
  surtitre,
  titre,
  actions,
  compteur,
}: {
  surtitre: string;
  titre: string;
  actions?: React.ReactNode;
  /** Un chiffre qui compte, posé en grand à droite : demandes en attente, terrains. */
  compteur?: { valeur: number | string; libelle: string };
}) {
  return (
    <section className="relative -mx-3 bg-black text-white lg:-mx-5">
      <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-between gap-6 px-5 py-7 sm:px-8 sm:py-9">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
            {surtitre}
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-black uppercase leading-[0.95] tracking-[-0.02em] sm:text-4xl">
            {titre}
          </h1>
          {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
        </div>

        {compteur && (
          <div className="shrink-0 border-l border-white/15 pl-6">
            <p className="font-display text-4xl font-black tabular-nums leading-none sm:text-5xl">
              {compteur.valeur}
            </p>
            <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/50">
              {compteur.libelle}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================
// Les équipements
//
// Leur liste est du DOMAINE et vit dans lib/terrains, que le serveur lit
// aussi. Leurs icônes sont de la VUE et vivent ici : faire entrer dix
// composants lucide dans le module de domaine l'aurait rendu inimportable
// depuis une route serveur sans traîner React avec lui.
// ============================================

const ICONES_EQUIPEMENT: Record<string, LucideIcon> = {
  vestiaires: DoorOpen,
  douches: ShowerHead,
  eclairage: Lightbulb,
  parking: ParkingCircle,
  buvette: CupSoda,
  gradins: Armchair,
  filets: Goal,
  eau: Droplets,
  gardiennage: ShieldCheck,
  secours: BriefcaseMedical,
};

/** Un équipement écrit avant que la liste soit fermée garde une coche. */
export const iconeEquipement = (cle: string): LucideIcon => ICONES_EQUIPEMENT[cle] ?? Check;

/**
 * Ce qu'un terrain propose, en lecture. Rend `null` s'il ne propose rien.
 *
 * `dense` sert là où la place manque — la carte d'un terrain dans son espace,
 * où huit pastilles à taille normale tombaient une par ligne et faisaient de
 * la fiche une colonne interminable.
 */
export function ListeEquipements({
  valeurs,
  className = "",
  dense = false,
}: {
  valeurs: string[];
  className?: string;
  dense?: boolean;
}) {
  const connus = valeurs.map((v) => ({ cle: v, label: libelleEquipement(v) })).filter((e) => e.label);
  if (!connus.length) return null;

  const taille = dense
    ? "gap-1 px-2 py-1 text-[9px] tracking-[0.08em]"
    : "gap-1.5 px-3 py-2 text-[10px] tracking-[0.12em]";

  return (
    <ul className={`flex flex-wrap ${dense ? "gap-1.5" : "gap-2"} ${className}`}>
      {connus.map((e) => {
        const Icon = iconeEquipement(e.cle);
        return (
          <li
            key={e.cle}
            className={`flex items-center border border-gray-200/70 bg-white font-black uppercase text-gray-600 ${taille}`}
          >
            <Icon size={dense ? 11 : 13} strokeWidth={2} className="shrink-0 text-emerald-600" />
            {e.label}
          </li>
        );
      })}
    </ul>
  );
}

/** Les équipements, en saisie : plusieurs choix cumulables. */
export function ChoixEquipements({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const bascule = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div role="group" aria-label="Équipements du terrain" className="flex flex-wrap gap-2">
      {EQUIPEMENTS.map((o) => {
        const actif = values.includes(o.value);
        const Icon = iconeEquipement(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={actif}
            onClick={() => bascule(o.value)}
            className={`flex items-center gap-1.5 border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
              actif
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
            }`}
          >
            <Icon size={13} strokeWidth={2} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Les horaires d'ouverture, en saisie.
 *
 * FACULTATIFS, ET ÇA SE VOIT. Sans horaires, toute heure se demande ; avec,
 * une demande hors plage est refusée dès le formulaire. Un propriétaire qui
 * ne les pose pas ne doit rien perdre, d'où le bouton qui les ouvre plutôt
 * qu'une grille imposée.
 */
export function ChoixHoraires({
  value,
  onChange,
}: {
  value: HorairesOuverture | null;
  onChange: (h: HorairesOuverture | null) => void;
}) {
  if (!value) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-gray-200/70 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-gray-500">
          Non précisés : les équipes peuvent demander n&apos;importe quelle heure.
        </p>
        <button
          type="button"
          onClick={() => onChange(horairesParDefaut())}
          className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 transition-colors hover:text-gray-900"
        >
          Préciser les horaires
        </button>
      </div>
    );
  }

  const poser = (cle: keyof HorairesOuverture, plage: HorairesOuverture[typeof cle]) =>
    onChange({ ...value, [cle]: plage });

  // Recopier le lundi partout : la plupart des terrains ont un seul horaire.
  const commeLeLundi = () => {
    const lundi = value["1"];
    const h = { ...value };
    for (const j of JOURS) h[j.cle] = lundi ? { ...lundi } : null;
    onChange(h);
  };

  return (
    <div className="border border-gray-200/70">
      <ul className="divide-y divide-gray-200/70">
        {JOURS.map((j) => {
          const plage = value[j.cle];
          const incoherent = plage && plage.ouvre >= plage.ferme;
          return (
            <li key={j.cle} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
              <label className="flex w-28 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!plage}
                  onChange={(e) => poser(j.cle, e.target.checked ? { ouvre: "08:00", ferme: "22:00" } : null)}
                  className="h-4 w-4 accent-emerald-600"
                />
                <span className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-700">{j.nom}</span>
              </label>
              {plage ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    step={1800}
                    value={plage.ouvre}
                    aria-label={`${j.nom}, ouverture`}
                    onChange={(e) => poser(j.cle, { ...plage, ouvre: e.target.value })}
                    className="border border-gray-200/70 px-2 py-1.5 text-sm font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
                  />
                  <span className="text-gray-300">→</span>
                  <input
                    type="time"
                    step={1800}
                    value={plage.ferme}
                    aria-label={`${j.nom}, fermeture`}
                    onChange={(e) => poser(j.cle, { ...plage, ferme: e.target.value })}
                    className="border border-gray-200/70 px-2 py-1.5 text-sm font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
                  />
                  {incoherent && (
                    <span role="alert" className="text-[11px] font-bold text-red-600">
                      Fermeture avant l&apos;ouverture
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[11px] font-bold text-gray-400">Fermé</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap justify-between gap-3 border-t border-gray-200/70 px-4 py-2.5">
        <button
          type="button"
          onClick={commeLeLundi}
          className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-500 transition-colors hover:text-gray-900"
        >
          Le lundi pour tous les jours
        </button>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-red-500"
        >
          Ne pas préciser
        </button>
      </div>
    </div>
  );
}

/** Des horaires saisis sont-ils utilisables ? Aucune plage à l'envers. */
export const horairesCoherents = (h: HorairesOuverture | null) =>
  !h || JOURS.every((j) => !h[j.cle] || h[j.cle]!.ouvre < h[j.cle]!.ferme);

const rienAEcouter = () => () => {};

/**
 * Les horaires, en lecture : une ligne par jour, celui d'aujourd'hui en avant.
 *
 * LE JOUR SE LIT DANS LE NAVIGATEUR. La fiche est rendue par le serveur, à
 * Paris ; autour de minuit, il n'est pas le même jour qu'à Lomé, et le rendu
 * serveur mettait en avant un autre jour que celui du téléphone. Côté
 * serveur, aucun jour n'est mis en avant.
 */
export function TableHoraires({ horaires }: { horaires: HorairesOuverture }) {
  const aujourdhui = useSyncExternalStore(rienAEcouter, () => String(new Date().getDay()), () => null);
  return (
    <dl className="grid grid-cols-1 gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-2">
      {JOURS.map((j) => {
        const actif = j.cle === aujourdhui;
        return (
          <div key={j.cle} className={`flex items-baseline justify-between gap-4 px-4 py-2.5 ${actif ? "bg-emerald-50" : "bg-white"}`}>
            <dt className={`text-[11px] font-black uppercase tracking-[0.1em] ${actif ? "text-emerald-800" : "text-gray-500"}`}>
              {j.nom}
            </dt>
            <dd className={`text-sm font-bold tabular-nums ${horaires[j.cle] ? "text-gray-900" : "text-gray-400"}`}>
              {libellePlage(horaires[j.cle])}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
