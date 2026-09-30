"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import MiniEcusson from "@/components/match/MiniEcusson";
import { RESULTATS } from "@/lib/forme";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import BadgeCategorie from "@/components/genre/BadgeCategorie";
import { categorieAffichee, type Categorie } from "@/lib/genre";

// ============================================
// Le bandeau d'une équipe : LE MÊME pour la fiche d'un club et pour celle
// d'une équipe dans une compétition.
//
// Il y en avait trois familles : une bannière photo encadrée sur la fiche du
// club, un dégradé vert collant sur la fiche en compétition, le noir de la
// page de match. Trois façons de dire « vous êtes chez cette équipe ». On
// reprend celle de la page de match (voir MatchHero) : NOIR, PLEINE LARGEUR,
// l'écusson et le nom qui éclairent le bandeau, et les boutons carrés en haut
// à droite.
//
// LA BANNIÈRE D'UN CLUB RESTE, EN FOND. Le manager l'a choisie et envoyée :
// c'est l'identité de son club. Elle passe derrière un noir qui la rend
// lisible quelle qu'elle soit — un ciel clair ne mange plus le nom.
//
// UN BOUTON RETOUR, PAS DE FIL D'ARIANE. Les fils sont masqués partout
// (voir globals.css, décision du 2026-09-05) ; celui de la fiche en
// compétition finissait de toute façon caché sous un bandeau collant. On
// revient d'où l'on vient, comme sur le tableau d'un match, et le fil ne sert
// plus que de repli : son dernier niveau cliquable, pour qui arrive par un
// lien partagé.
//
// Il ne colle plus. Collant, il gardait un quart d'écran de téléphone pour
// un nom qu'on a déjà lu.
// ============================================

const T = textes(
  {
    revenir: "Revenir à l'écran précédent",
    forme: (mots: string) => `Forme, du plus ancien au plus récent : ${mots}`,
  },
  {
    revenir: "Back to the previous screen",
    forme: (mots: string) => `Form, oldest to most recent: ${mots}`,
  },
);

export interface EtapeDuFil {
  label: string;
  href?: string | null;
}

export default function BandeauEquipe({
  fil, nom, logo, couleur, surtitre, devise, banniere, puces, actions, categorie,
}: {
  /** Le chemin jusqu'à l'équipe. Seul son dernier niveau cliquable sert : le repli du retour. */
  fil: EtapeDuFil[];
  nom: string;
  logo: string | null;
  /** La couleur de l'équipe : le fond de l'initiale, quand il n'y a pas de logo. */
  couleur?: string | null;
  /** Ce qui situe l'équipe : « Lomé · Amateur », ou le nom de la compétition. */
  surtitre?: React.ReactNode;
  devise?: string | null;
  banniere?: string | null;
  /** La rangée sous le nom : la forme, le rang, l'effectif. */
  puces?: React.ReactNode;
  /** Les boutons du coin : suivre, partager, modifier. */
  actions?: React.ReactNode;
  /** Féminine ou mixte : un badge à côté du surtitre (lib/genre). */
  categorie?: Categorie | null;
}) {
  const router = useRouter();
  const t = useTextes(T);
  const retour = [...fil].reverse().find((f) => f.href);
  const revenir = () => {
    // `history.length > 1` distingue une navigation interne d'une arrivée
    // directe (lien partagé, onglet neuf), où `back()` sortirait du site.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(retour?.href ?? "/");
  };

  return (
    <section className="relative -mx-3 -mt-3 overflow-hidden bg-black text-white lg:-mx-5 lg:-mt-5">
      {banniere && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banniere} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/40" />
        </>
      )}

      <div className="relative mx-auto max-w-6xl px-4 pb-5 pt-3 sm:px-6 sm:pb-7">
        <div className="flex min-h-9 items-center justify-between gap-3">
          <button type="button" onClick={revenir} aria-label={t.revenir} className={BOUTON_BANDEAU}>
            <ArrowLeft size={15} />
          </button>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>

        <div className="mt-4 flex items-center gap-4 sm:mt-6 sm:gap-5">
          {logo ? (
            <MiniEcusson nom={nom} logo={logo} taille={72} className="sm:h-24! sm:w-24!" />
          ) : (
            <span
              aria-hidden
              style={{ backgroundColor: couleur ?? undefined }}
              className="flex h-[72px] w-[72px] shrink-0 items-center justify-center border border-white/15 bg-white/10 font-display text-3xl font-black sm:h-24 sm:w-24 sm:text-4xl"
            >
              {nom?.[0]?.toUpperCase() || "?"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {(surtitre || categorieAffichee(categorie)) && (
              <p className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300 sm:text-[11px]">
                {surtitre}
                <BadgeCategorie categorie={categorie} sombre />
              </p>
            )}
            <h1 className="mt-1 line-clamp-2 break-words font-display text-2xl font-black uppercase leading-[1.05] tracking-tight sm:text-4xl">
              {nom}
            </h1>
            {devise && (
              <p className="mt-1.5 line-clamp-2 text-sm font-medium italic text-white/70">
                &laquo;&nbsp;{devise}&nbsp;&raquo;
              </p>
            )}
          </div>
        </div>

        {puces && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/60 sm:mt-5">
            {puces}
          </div>
        )}
      </div>
    </section>
  );
}

/** Le bouton du coin, carré, dans le vocabulaire du bandeau de match. */
export const BOUTON_BANDEAU =
  "flex h-9 shrink-0 items-center justify-center gap-2 border border-white/20 px-3 text-[11px] font-black uppercase tracking-[0.12em] text-white/80 transition-colors hover:border-white hover:text-white disabled:opacity-60";

/**
 * La forme en pastilles lettrées, sur le noir du bandeau : la même que celle
 * du tableau d'un match (voir MatchHero), le plus ancien à gauche, le plus
 * récent à droite et souligné.
 */
export function FormeEnLettres({ forme, sombre = true }: { forme: ("V" | "N" | "D")[]; sombre?: boolean }) {
  const { langue } = useLangue();
  const t = useTextes(T);
  if (forme.length === 0) return null;
  const fond: Record<"V" | "N" | "D", string> = sombre
    ? { V: "bg-emerald-400 text-black", N: "bg-white/25 text-white", D: "bg-red-500 text-white" }
    : { V: "bg-emerald-600 text-white", N: "bg-gray-200 text-gray-600", D: "bg-red-500 text-white" };
  const { mot, lettre } = RESULTATS[langue];
  return (
    <span
      role="img"
      aria-label={t.forme(forme.map((r) => mot[r].toLowerCase()).join(", "))}
      className="inline-flex items-end gap-0.5"
    >
      {forme.map((r, i) => (
        <span key={i} aria-hidden className="flex flex-col items-center gap-0.5">
          <span className={`flex h-5 w-5 items-center justify-center text-[10px] font-black leading-none ${fond[r]}`}>
            {lettre[r]}
          </span>
          <span className={`h-0.5 w-5 ${i === forme.length - 1 ? fond[r].split(" ")[0] : "bg-transparent"}`} />
        </span>
      ))}
    </span>
  );
}
