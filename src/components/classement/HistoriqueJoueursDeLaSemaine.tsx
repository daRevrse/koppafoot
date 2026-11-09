"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import {
  ancreDuJoueur, nomEnPhrase, noteEnTexte, resumeDuJoueur, type JoueurDeLaSemaine,
} from "@/lib/joueur-semaine-publie";
import AvatarJoueurSemaine from "@/components/ui/AvatarJoueurSemaine";
import { TeamCrest } from "@/components/ui/EntityAvatar";
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
// CHAQUE CARTE MONTRE LE JOUEUR, PAS SON AFFICHE (2026-11-05) : sa photo
// couronnée, sa semaine, son équipe et ce qu'il y a fait. L'affiche est faite
// pour être partagée, depuis le Direct.
//
// La carte mène à sa fiche ; un joueur sans compte n'en a pas.
// ============================================

const T = textes(
  {
    titre: "Joueurs de la semaine",
    semaine: (n: number) => `Semaine ${n}`,
    note: (n: string) => `Note ${n}`,
    hommeDuMatch: "Homme du match",
  },
  {
    titre: "Players of the week",
    semaine: (n: number) => `Week ${n}`,
    note: (n: string) => `Rating ${n}`,
    hommeDuMatch: "Man of the match",
  },
);

export default function HistoriqueJoueursDeLaSemaine({ joueurs }: { joueurs: JoueurDeLaSemaine[] }) {
  const t = useTextes(T);
  const { langue } = useLangue();
  const lng = langue === "en" ? "en" : "fr";
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
          const equipe = j.equipes[0] ?? null;
          const contenu = (
            <>
              <span className="relative flex flex-col items-center overflow-hidden bg-emerald-950 px-2 pb-3 pt-2.5">
                <Trophy aria-hidden size={86} strokeWidth={1.5} className="pointer-events-none absolute -right-5 -top-4 text-white/[0.06]" />
                <span className="relative text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">{t.semaine(j.numero)}</span>
                <span className="relative mt-2">
                  <AvatarJoueurSemaine nom={nom} photo={j.photo} genre={j.genre} size={60} className="ring-[3px] ring-amber-300" />
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-300 text-emerald-950 ring-2 ring-emerald-950">
                    <Trophy size={12} />
                  </span>
                </span>
              </span>
              <span className="flex flex-1 flex-col items-center px-2.5 pb-2.5 pt-2 text-center">
                <span className="line-clamp-2 text-[13px] font-black leading-tight text-gray-900">{nom}</span>
                {equipe && (
                  <span className="mt-1 flex max-w-full items-center gap-1 text-[11px] font-bold text-gray-400">
                    <TeamCrest name={equipe.nom} logo={equipe.logo} size={14} className="rounded-full" />
                    <span className="truncate">{equipe.nom}</span>
                  </span>
                )}
                <span className="mt-1.5 text-[12px] font-black text-emerald-600">{resumeDuJoueur(j, lng)}</span>
                {(j.note !== null || j.hommeDuMatch > 0) && (
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    {j.note !== null ? t.note(noteEnTexte(j.note, lng)) : t.hommeDuMatch}
                  </span>
                )}
              </span>
            </>
          );
          const classe = "flex h-full flex-col border border-gray-200/70 bg-white transition-colors hover:border-gray-300";
          return (
            <li
              key={j.lundi}
              id={ancreDuJoueur(j.lundi)}
              className="w-[148px] shrink-0 snap-start scroll-mt-24 target:outline target:outline-2 target:outline-emerald-500"
            >
              {j.uid ? (
                <Link href={`/profile/${j.uid}`} className={classe}>{contenu}</Link>
              ) : (
                <div className={classe}>{contenu}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
