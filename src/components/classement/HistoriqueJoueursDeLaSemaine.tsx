"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import {
  adresseDeLAffiche, ancreDuJoueur, nomEnPhrase, resumeDuJoueur, type JoueurDeLaSemaine,
} from "@/lib/joueur-semaine-publie";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";

// ============================================
// L'historique des joueurs de la semaine, en tête de Top performances.
//
// UNE FRISE QUI DÉFILE DE CÔTÉ, la semaine la plus récente à gauche : elle
// tient en une hauteur de carte, et le classement reste dans le premier
// écran d'un téléphone. Chaque élu porte son ancre : le lien que partage la
// diapositive du Direct ouvre la page sur lui, et le cadre vert dit lequel.
//
// La carte mène à sa fiche ; un joueur sans compte n'en a pas, elle ouvre
// alors son affiche.
// ============================================

const T = textes(
  {
    titre: "Joueurs de la semaine",
    semaine: (n: number) => `Semaine ${n}`,
    afficheDe: (nom: string) => `L'affiche de ${nom}`,
  },
  {
    titre: "Players of the week",
    semaine: (n: number) => `Week ${n}`,
    afficheDe: (nom: string) => `${nom}'s poster`,
  },
);

export default function HistoriqueJoueursDeLaSemaine({ joueurs }: { joueurs: JoueurDeLaSemaine[] }) {
  const t = useTextes(T);
  const { langue } = useLangue();
  if (joueurs.length === 0) return null;

  return (
    <section aria-labelledby="joueurs-de-la-semaine" className="mb-3">
      <h2 id="joueurs-de-la-semaine" className="mb-2 flex items-center gap-1.5 font-display text-sm font-black text-gray-900">
        <Trophy size={15} className="text-amber-500" />
        {t.titre}
      </h2>
      <ol className="-mx-3 flex snap-x gap-2.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {joueurs.map((j) => {
          const nom = nomEnPhrase(j.nom);
          const contenu = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={adresseDeLAffiche(j, "publication", true)}
                alt={t.afficheDe(nom)}
                width={136}
                height={170}
                loading="lazy"
                className="aspect-[4/5] w-full bg-gray-50 object-cover"
              />
              <span className="block px-2.5 pb-2.5 pt-2">
                <span className="block text-[10px] font-black uppercase tracking-wide text-amber-600">{t.semaine(j.numero)}</span>
                <span className="mt-0.5 line-clamp-2 block text-[13px] font-black leading-tight text-gray-900">{nom}</span>
                {j.equipes[0] && (
                  <span className="mt-0.5 block truncate text-[11px] font-bold text-gray-400">{j.equipes[0].nom}</span>
                )}
                <span className="mt-1 block truncate text-[11px] font-black text-emerald-600">
                  {resumeDuJoueur(j, langue === "en" ? "en" : "fr")}
                </span>
              </span>
            </>
          );
          const classe = "block h-full border border-gray-200/70 bg-white transition-colors hover:border-gray-300";
          return (
            <li
              key={j.lundi}
              id={ancreDuJoueur(j.lundi)}
              className="w-[136px] shrink-0 snap-start scroll-mt-24 target:outline target:outline-2 target:outline-emerald-500"
            >
              {j.uid ? (
                <Link href={`/profile/${j.uid}`} className={classe}>{contenu}</Link>
              ) : (
                <a href={adresseDeLAffiche(j, "vertical")} target="_blank" rel="noopener" className={classe}>{contenu}</a>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
