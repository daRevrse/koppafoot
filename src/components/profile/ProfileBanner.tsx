"use client";

import type { ReactNode, RefObject } from "react";

/**
 * LA BANNIÈRE D'UNE FICHE DE JOUEUR.
 *
 * Elle a deux visages, et c'est voulu.
 *
 * AVEC UNE PHOTO DE COUVERTURE, l'image prend l'écran. C'est l'image que le
 * joueur choisit pour lui — souvent une carte déjà composée, avec son numéro
 * et son nom dessus. Elle se voit donc en entier : on ouvre la fiche dessus,
 * le reste vient au défilement. Le dégradé ne sert qu'à porter le nom, il
 * part du bas et meurt avant le milieu.
 *
 * SANS COUVERTURE, LE VERT. Pas un dégradé vide sur une demi-page : le vert
 * KoppaFoot, court, qui tient l'avatar, le nom, le poste et la devise. C'est
 * le repli, et c'est aussi la seule surface du produit qui reste verte
 * maintenant que l'en-tête de l'application est blanc — la fiche d'un joueur
 * n'a pas la même direction artistique que le reste, elle lui appartient.
 *
 * On n'étire que ce qu'il y a à regarder : la version verte fait le tiers de
 * ce que fait la version illustrée, et elle est mesurée en `rem` et non en
 * `svh` — elle tient un avatar, deux lignes de texte et une devise, ce qui
 * est une hauteur fixe, pas une fraction d'écran. En `svh` elle laissait un
 * grand vide vert au milieu sur les écrans hauts.
 */
export default function ProfileBanner({
  coverUrl,
  avatarUrl,
  initials,
  name,
  eyebrow,
  slogan,
  topBar,
  meta,
  actions,
  avatarBadge,
  afficheRef,
}: {
  coverUrl: string | null;
  avatarUrl: string | null;
  /** Repli de l'avatar quand il n'y a pas de photo. */
  initials: string;
  name: string;
  /** La ligne au-dessus du nom : poste, club. */
  eyebrow?: ReactNode;
  /** La devise : une ligne, tirée de la bio. */
  slogan?: string | null;
  /** Posé en haut : le retour, le menu. */
  topBar?: ReactNode;
  /** Abonnés, équipes, ancienneté — sous le nom. */
  meta?: ReactNode;
  /** Suivre, Mercato, Modifier. */
  actions?: ReactNode;
  /** Le bouton appareil photo, sur sa propre fiche. */
  avatarBadge?: ReactNode;
  /**
   * L'affiche, pour l'observateur qui décide du repli. Voir
   * `useReplieAuDefilement` : c'est ce bloc qu'on surveille, pas le
   * défilement.
   */
  afficheRef?: RefObject<HTMLDivElement | null>;
}) {
  const illustree = Boolean(coverUrl);

  return (
    <section
      ref={afficheRef}
      className="relative -mx-3 -mt-3 overflow-hidden bg-emerald-900 text-white lg:-mx-5 lg:-mt-5"
    >
      {coverUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          {/* Le dégradé ne couvre que le bas : il porte le nom, il ne teinte
              pas l'image. Les arrêts sont posés à la main — sans eux le
              milieu tombe à 45 % d'opacité et noircit le sujet ; ici il est
              éteint à 45 % de hauteur, et la moitié haute de l'image, où se
              trouvent d'ordinaire le numéro et le nom de la carte, ne reçoit
              rien du tout. */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 from-0% via-gray-950/55 via-18% to-transparent to-45%" />
          {/* De quoi lire le retour et le menu sur une image claire. */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />
        </>
      ) : (
        /* Le vert plein, et une nuance plus claire en haut à droite pour que
           la surface ne soit pas une plaque morte. */
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_85%_0%,theme(colors.emerald.800),theme(colors.emerald.950))]" />
      )}

      <div
        // `pt-14` : la barre flotte par-dessus, l'affiche lui laisse sa
        // hauteur plutot que de glisser dessous.
        className={`relative mx-auto flex max-w-6xl flex-col px-5 pb-6 pt-14 sm:px-8 sm:pb-8 ${
          illustree
            ? "min-h-[62svh] max-h-[620px] sm:min-h-[70svh]"
            : "min-h-[15rem] max-h-[17rem]"
        }`}
      >
        {topBar}

        {/* `mt-auto` et non `justify-between` sur le parent : la barre du haut
            peut disparaitre — une regle globale masque par exemple tous les
            fils d'ariane — et un `justify-between` a un seul enfant le
            remonte en haut, ce qui posait l'identite par-dessus le numero de
            la banniere. La marge automatique colle le bloc au bas quoi qu'il
            arrive au-dessus. */}
        <div className="mt-auto">
          <div className="flex flex-wrap items-end gap-4">
            <div className="relative shrink-0">
              {/* CARRÉ ARRONDI ET NON ROND, et plus grand qu'avant : sur
                  l'esquisse c'est une vignette, pas une pastille. Une photo
                  de joueur y tient mieux qu'en médaillon. */}
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-xl font-black text-white/80 ring-2 ring-white/20 backdrop-blur-sm sm:h-24 sm:w-24">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              {avatarBadge}
            </div>

            {/* `min-w` et non `min-w-0` seul : sans plancher, la colonne du
                nom cede toute sa place aux actions et c'est le NOM qui se
                tronque, a cote d'un bouton entier. Avec un plancher, c'est le
                bouton qui passe a la ligne. */}
            <div className="min-w-[13rem] flex-1">
              {/* UN NOM NE SE COUPE PAS. Il etait `truncate` :
                  « Gilles-Christ Gas… » sur un telephone, c'est-a-dire une
                  fiche qui ne dit pas de qui elle parle. Il passe a la ligne,
                  et `text-balance` repartit les lignes plutot que de laisser
                  un mot seul en bas.

                  `drop-shadow` plutôt qu'une plaque : le nom tient sur une
                  image claire sans lui poser un rectangle dessus. */}
              <h1 className="text-balance font-display text-2xl font-black uppercase leading-tight tracking-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.55)] sm:text-4xl">
                {name}
              </h1>
              {eyebrow && (
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                  {eyebrow}
                </p>
              )}
            </div>

            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>

          {/* LA DEVISE, SUR UNE LIGNE. Elle sort de la bio, qui peut faire
              trois phrases : `line-clamp-2` la coupe ici, et l'onglet
              « Aperçu » la donne en entier plus bas. */}
          {slogan && (
            <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-relaxed text-white/75">
              {slogan}
            </p>
          )}

          {meta && (
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-black uppercase tracking-[0.15em] text-white/70">
              {meta}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
