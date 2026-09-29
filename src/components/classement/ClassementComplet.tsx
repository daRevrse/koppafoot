"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Flame, ChevronLeft, ChevronRight, Info } from "lucide-react";
import LigneDeClassement from "@/components/classement/LigneDeClassement";
import {
  MATCHS_NOTES_CLASSEMENT, classementPar,
  type LigneJoueurPubliee, type TriClassement,
} from "@/lib/classement";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";

// ============================================
// Le classement complet : cent joueurs, dix par page.
//
// UNE SEULE LISTE, GARDIENS COMPRIS. Il y avait deux onglets — les buts et
// les passes pour tout le monde, les arrêts pour les gardiens —, et donc deux
// réponses à une seule question. Tout le monde est maintenant classé sur sa
// note (voir lib/classement), qui juge chacun sur ce qu'on attend de son
// poste. Le filtre montre les gardiens entre eux, AVEC LEUR RANG DANS LA
// LISTE COMMUNE : c'est tout l'intérêt de les y avoir mis.
//
// LES BUTS ET LES PASSES RESTENT UN TRI. C'est une autre question — qui
// marque, qui fait marquer —, et elle a ses lecteurs.
//
// LA PAGINATION EST FLECHEE, comme l'affiche du Direct, et pour la meme
// raison : dix lignes tiennent sur un ecran de telephone, cent demandent huit
// ecrans de defilement. Deux fleches et un compteur valent mieux qu'un pouce
// qui glisse pendant vingt secondes.
// ============================================

const PAR_PAGE = 10;

type Filtre = "tous" | "joueurs" | "gardiens";

const TRIS: TriClassement[] = ["note", "contribution"];

const FILTRES: Filtre[] = ["tous", "joueurs", "gardiens"];

const N = MATCHS_NOTES_CLASSEMENT;

const T = textes(
  {
    tri: (c: TriClassement) => ({ note: "Note", contribution: "Buts + passes" })[c],
    filtre: (f: Filtre) => ({ tous: "Tous", joueurs: "Joueurs", gardiens: "Gardiens" })[f],
    classement: "Classement",
    cinqDerniers: "5 derniers matchs",
    commentCalcule: "Comment ce classement est calculé",
    methode1: (
      <>
        Tout le monde est classé sur sa <b>note moyenne</b> des cinq derniers matchs, celle que
        la console calcule pendant le direct. Les plus récents comptent davantage : c&apos;est le
        même chiffre que l&apos;état de forme du joueur.
      </>
    ),
    methode2: (
      <>
        Un <b>joueur de champ</b> est noté sur ses buts, ses passes décisives et ses tirs, et perd
        des points sur ses fautes et ses cartons. Un <b>gardien</b> gagne des points sur ses arrêts
        et quand il ne prend pas de but, et en perd sur chaque but encaissé.
      </>
    ),
    methode3: (
      <>
        Il faut {N} matchs notés pour être classé : une entrée en jeu trop courte n&apos;est pas
        notée. Le tri « Buts + passes » compte, lui, toutes les contributions, dès le premier but.
        Compétitions locales et matchs amicaux confondus.
      </>
    ),
    trierPar: "Trier par",
    afficher: "Afficher",
    videTotal: "Le classement se remplit à la fin de chaque match.",
    videNote: `Personne ici n'a encore ${N} matchs notés.`,
    videContribution: "Personne ici n'a encore marqué ni fait marquer.",
    personneEncore: "Personne n'y figure encore.",
    essaieAutre: "Essaie l'autre tri, ou un autre filtre.",
    precedent: "Précédent",
    suivant: "Suivant",
    sur: (n: number) => ` sur ${n}`,
  },
  {
    tri: (c: TriClassement) => ({ note: "Rating", contribution: "Goals + assists" })[c],
    filtre: (f: Filtre) => ({ tous: "All", joueurs: "Outfield", gardiens: "Keepers" })[f],
    classement: "Rankings",
    cinqDerniers: "Last 5 matches",
    commentCalcule: "How these rankings are calculated",
    methode1: (
      <>
        Everyone is ranked on their <b>average rating</b> over their last five matches, the one
        the console calculates during the live coverage. Recent matches weigh more: it is the same
        figure as the player&apos;s form.
      </>
    ),
    methode2: (
      <>
        An <b>outfield player</b> is rated on goals, assists and shots, and loses points for fouls
        and cards. A <b>goalkeeper</b> earns points for saves and for keeping a clean sheet, and
        loses some for every goal conceded.
      </>
    ),
    methode3: (
      <>
        You need {N} rated matches to be ranked: a cameo that is too short is not rated. The
        “Goals + assists” sort counts every contribution, from the very first goal. Local
        competitions and friendlies alike.
      </>
    ),
    trierPar: "Sort by",
    afficher: "Show",
    videTotal: "The rankings fill up at the end of each match.",
    videNote: `Nobody here has ${N} rated matches yet.`,
    videContribution: "Nobody here has scored or assisted yet.",
    personneEncore: "Nobody is in them yet.",
    essaieAutre: "Try the other sort, or another filter.",
    precedent: "Previous",
    suivant: "Next",
    sur: (n: number) => ` of ${n}`,
  },
);

export default function ClassementComplet({ joueurs }: { joueurs: LigneJoueurPubliee[] }) {
  // Tant que personne n'a assez de matchs notés — les premières semaines —, le
  // tri par note serait une page vide : on ouvre alors sur les buts et passes.
  const [tri, setTri] = useState<TriClassement>(() =>
    classementPar(joueurs, "note").length === 0 && classementPar(joueurs, "contribution").length > 0
      ? "contribution"
      : "note",
  );
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [page, setPage] = useState(0);
  const [methodeOuverte, setMethodeOuverte] = useState(false);
  const t = useTextes(T);

  const lignes = classementPar(joueurs, tri).filter((l) =>
    filtre === "tous" ? true : filtre === "gardiens" ? l.gardien : !l.gardien,
  );
  const pages = Math.max(1, Math.ceil(lignes.length / PAR_PAGE));
  // La page courante est bornee a chaque rendu : changer de tri depuis la
  // page 7 d'un classement qui n'en compte que 2 ne doit pas vider l'ecran.
  const pageSure = Math.min(page, pages - 1);
  const tranche = lignes.slice(pageSure * PAR_PAGE, (pageSure + 1) * PAR_PAGE);

  const aller = (n: number) => setPage(Math.min(Math.max(n, 0), pages - 1));

  const bouton = (actif: boolean) =>
    `px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors ${
      actif ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-900"
    }`;

  return (
    <div className="mx-auto max-w-2xl px-3 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 font-display text-xl font-black text-gray-900">
          <Flame size={20} className="text-amber-500" />
          {t.classement}
        </h1>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-600">
            {t.cinqDerniers}
          </span>
          {/* LE MODE DE CALCUL SE DEMANDE, IL NE S'IMPOSE PAS. On le consulte
              une fois, pas a chaque visite : le badge garde la seule reserve
              qui compte, la fenetre de cinq matchs. */}
          <button
            type="button"
            onClick={() => setMethodeOuverte((v) => !v)}
            aria-expanded={methodeOuverte}
            aria-label={t.commentCalcule}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              methodeOuverte ? "bg-gray-900 text-white" : "text-gray-400 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <Info size={15} />
          </button>
        </div>
      </div>

      {methodeOuverte && (
        <div className="mb-3 space-y-2 border border-gray-200/70 bg-gray-50/60 p-3 text-[11px] font-medium leading-relaxed text-gray-500">
          <p>{t.methode1}</p>
          <p>{t.methode2}</p>
          <p>{t.methode3}</p>
        </div>
      )}

      <div className="overflow-hidden border border-gray-200/70 bg-white">
        {/* Le tri à gauche, le filtre à droite : deux réglages, deux groupes. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/70 px-3 py-2">
          <div role="group" aria-label={t.trierPar} className="flex border border-gray-200/70">
            {TRIS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setTri(c); setPage(0); }}
                aria-pressed={tri === c}
                className={bouton(tri === c)}
              >
                {t.tri(c)}
              </button>
            ))}
          </div>
          <div role="group" aria-label={t.afficher} className="flex gap-1">
            {FILTRES.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFiltre(f); setPage(0); }}
                aria-pressed={filtre === f}
                className={bouton(filtre === f)}
              >
                {t.filtre(f)}
              </button>
            ))}
          </div>
        </div>

        {lignes.length === 0 ? (
          <p className="px-4 py-12 text-center text-[12px] font-bold leading-relaxed text-gray-400">
            {joueurs.length === 0
              ? t.videTotal
              : tri === "note"
                ? t.videNote
                : t.videContribution}
            <br />
            {joueurs.length === 0 ? t.personneEncore : t.essaieAutre}
          </p>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${tri}-${filtre}-${pageSure}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {tranche.map((ligne) => (
                <LigneDeClassement key={ligne.cle} ligne={ligne} tri={tri} />
              ))}
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
              {t.precedent}
            </button>
            <span className="text-[11px] font-black tabular-nums text-gray-400">
              {pageSure * PAR_PAGE + 1}–{Math.min((pageSure + 1) * PAR_PAGE, lignes.length)}
              <span className="text-gray-300">{t.sur(lignes.length)}</span>
            </span>
            <button
              type="button"
              onClick={() => aller(pageSure + 1)}
              disabled={pageSure >= pages - 1}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:opacity-30"
            >
              {t.suivant}
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
