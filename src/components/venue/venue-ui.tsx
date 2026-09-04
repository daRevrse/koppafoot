"use client";

import {
  DoorOpen, ShowerHead, Lightbulb, ParkingCircle, CupSoda,
  Armchair, Goal, Droplets, ShieldCheck, BriefcaseMedical, Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EQUIPEMENTS, libelleEquipement } from "@/lib/terrains";
import { LignesDeTerrain } from "@/components/ui/socle";

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
 * inversé. Un seul composant, donc, et la phrase devient facultative plutôt
 * qu'oubliée.
 */
export function Panneau({
  surtitre,
  titre,
  children,
  actions,
  compteur,
}: {
  surtitre: string;
  titre: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  /** Un chiffre qui compte, posé en grand à droite : demandes en attente, terrains. */
  compteur?: { valeur: number | string; libelle: string };
}) {
  return (
    <section className="relative -mx-3 overflow-hidden bg-gray-900 text-white lg:-mx-5">
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
      <LignesDeTerrain className="text-white/[0.07]" />

      <div className="relative mx-auto flex max-w-4xl flex-wrap items-end justify-between gap-6 px-5 py-7 sm:px-8 sm:py-9">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
            {surtitre}
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-black uppercase leading-[0.95] tracking-[-0.02em] sm:text-4xl">
            {titre}
          </h1>
          {children && (
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">{children}</p>
          )}
          {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
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

/** Ce qu'un terrain propose, en lecture. Rend `null` s'il ne propose rien. */
export function ListeEquipements({ valeurs, className = "" }: { valeurs: string[]; className?: string }) {
  const connus = valeurs.map((v) => ({ cle: v, label: libelleEquipement(v) })).filter((e) => e.label);
  if (!connus.length) return null;

  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {connus.map((e) => {
        const Icon = iconeEquipement(e.cle);
        return (
          <li
            key={e.cle}
            className="flex items-center gap-1.5 border border-gray-200/70 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-600"
          >
            <Icon size={13} strokeWidth={2} className="text-emerald-600" />
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
