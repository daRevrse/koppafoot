"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Flame, Goal, Footprints, Hand, ShieldCheck, ChevronLeft, ChevronRight,
} from "lucide-react";
import { MouvementBadge } from "@/components/direct/DirectHomeV2";
import type { LigneClassement, LigneGardien, LignePubliee } from "@/lib/classement";

// ============================================
// Le classement complet : cent joueurs, dix par page.
//
// DEUX ONGLETS, parce qu'un gardien ne se compare pas a un attaquant. Il
// figure dans les deux : le premier classe TOUT LE MONDE sur les buts et les
// passes, gardiens compris — un gardien qui marque merite d'y etre —, le
// second ne classe que les gardiens, sur ce qu'ils produisent vraiment.
//
// LA PAGINATION EST FLECHEE, comme l'affiche du Direct, et pour la meme
// raison : dix lignes tiennent sur un ecran de telephone, cent demandent huit
// ecrans de defilement. Deux fleches et un compteur valent mieux qu'un pouce
// qui glisse pendant vingt secondes.
// ============================================

const PAR_PAGE = 10;

type Onglet = "performances" | "gardiens";

const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: "performances", libelle: "Top performances" },
  { cle: "gardiens", libelle: "Gardiens" },
];

/** Le profil du joueur, quand la ligne a ete revendiquee par un compte. */
function NomDuJoueur({ nom, uid }: { nom: string; uid: string | null }) {
  if (!uid) {
    return <span className="block truncate text-[13px] font-black text-gray-900">{nom}</span>;
  }
  return (
    <Link
      href={`/profile/${uid}`}
      className="block truncate text-[13px] font-black text-gray-900 hover:text-emerald-700"
    >
      {nom}
    </Link>
  );
}

function Rangee({
  rang, ligne, enfants, valeur, unite,
}: {
  rang: number;
  ligne: LignePubliee<LigneClassement>;
  /** Le detail sous le nom : buts et passes, ou arrets et clean sheets. */
  enfants: React.ReactNode;
  valeur: string;
  unite: string;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-gray-200/70 px-4 py-2.5 first:border-0">
      <span
        className={`w-6 shrink-0 text-center text-[12px] font-black tabular-nums ${
          rang === 1 ? "text-amber-500" : "text-gray-300"
        }`}
      >
        {rang}
      </span>

      <span className="min-w-0 flex-1">
        <NomDuJoueur nom={ligne.nom} uid={ligne.uid} />
        <span className="mt-0.5 flex items-center gap-2.5 text-[11px] font-black tabular-nums text-gray-500">
          {enfants}
          <span className="font-bold text-gray-300">{ligne.matchs} m</span>
        </span>
      </span>

      <span className="shrink-0 text-[13px] font-black tabular-nums text-gray-900">
        {valeur} <span className="text-gray-400">{unite}</span>
      </span>

      <MouvementBadge mouvement={ligne.mouvement} />
    </div>
  );
}

export default function ClassementComplet({
  performances, gardiens,
}: {
  performances: LignePubliee<LigneClassement>[];
  gardiens: LignePubliee<LigneGardien>[];
}) {
  const [onglet, setOnglet] = useState<Onglet>("performances");
  const [page, setPage] = useState(0);

  const lignes = onglet === "performances" ? performances : gardiens;
  const pages = Math.max(1, Math.ceil(lignes.length / PAR_PAGE));
  // La page courante est bornee a chaque rendu : changer d'onglet depuis la
  // page 7 d'un classement qui n'en compte que 2 ne doit pas vider l'ecran.
  const pageSure = Math.min(page, pages - 1);
  const tranche = lignes.slice(pageSure * PAR_PAGE, (pageSure + 1) * PAR_PAGE);

  const aller = (n: number) => setPage(Math.min(Math.max(n, 0), pages - 1));

  return (
    <div className="mx-auto max-w-2xl px-3 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 font-display text-xl font-black text-gray-900">
          <Flame size={20} className="text-amber-500" />
          Classement
        </h1>
        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-600">
          5 derniers matchs
        </span>
      </div>

      <div className="overflow-hidden border border-gray-200/70 bg-white">
        <div className="grid grid-cols-2 divide-x divide-gray-200/70 border-b border-gray-200/70">
          {ONGLETS.map((o) => {
            const actif = onglet === o.cle;
            return (
              <button
                key={o.cle}
                type="button"
                onClick={() => { setOnglet(o.cle); setPage(0); }}
                aria-pressed={actif}
                className={`px-3 py-3 text-[11px] font-black uppercase tracking-wide transition-colors ${
                  actif ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:text-gray-900"
                }`}
              >
                {o.libelle}
              </button>
            );
          })}
        </div>

        {lignes.length === 0 ? (
          <p className="px-4 py-12 text-center text-[12px] font-bold leading-relaxed text-gray-400">
            {onglet === "gardiens"
              ? "Aucun gardien classé pour l'instant."
              : "Le classement se remplit à la fin de chaque match."}
            <br />
            Personne n&apos;y figure encore.
          </p>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${onglet}-${pageSure}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {tranche.map((ligne, i) => {
                const rang = pageSure * PAR_PAGE + i + 1;
                if (onglet === "gardiens") {
                  const g = ligne as LignePubliee<LigneGardien>;
                  return (
                    <Rangee
                      key={g.cle}
                      rang={rang}
                      ligne={g}
                      valeur={g.note.toFixed(1)}
                      unite="/m"
                      enfants={
                        <>
                          <span className="flex items-center gap-1">
                            {g.arrets}
                            <Hand size={12} className="text-emerald-600" />
                          </span>
                          <span className="flex items-center gap-1">
                            {g.cleanSheets}
                            <ShieldCheck size={12} className="text-sky-500" />
                          </span>
                        </>
                      }
                    />
                  );
                }
                return (
                  <Rangee
                    key={ligne.cle}
                    rang={rang}
                    ligne={ligne}
                    valeur={String(ligne.total)}
                    unite="G/A"
                    enfants={
                      <>
                        <span className="flex items-center gap-1">
                          {ligne.buts}
                          <Goal size={12} className="text-emerald-600" />
                        </span>
                        <span className="flex items-center gap-1">
                          {ligne.passes}
                          <Footprints size={12} className="text-orange-500" />
                        </span>
                      </>
                    }
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200/70 px-3 py-2.5">
            <button
              type="button"
              onClick={() => aller(pageSure - 1)}
              disabled={pageSure === 0}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:opacity-30"
            >
              <ChevronLeft size={14} />
              Précédent
            </button>
            <span className="text-[11px] font-black tabular-nums text-gray-400">
              {pageSure * PAR_PAGE + 1}–{Math.min((pageSure + 1) * PAR_PAGE, lignes.length)}
              <span className="text-gray-300"> sur {lignes.length}</span>
            </span>
            <button
              type="button"
              onClick={() => aller(pageSure + 1)}
              disabled={pageSure >= pages - 1}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:opacity-30"
            >
              Suivant
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <p className="mt-3 px-1 text-[11px] font-medium leading-relaxed text-gray-400">
        Les buts et les passes décisives des cinq derniers matchs de chaque
        joueur, toutes compétitions locales et matchs amicaux confondus. Un
        joueur compte un match dès qu&apos;il figure sur la feuille. Les
        gardiens sont classés sur leurs arrêts par match, un match sans but
        encaissé valant deux arrêts.
      </p>
    </div>
  );
}
