"use client";

import type { ReactNode } from "react";

/**
 * LA BANNIÈRE D'UNE FICHE DE JOUEUR.
 *
 * La photo de couverture était posée en fond à `opacity-35` sous un dégradé
 * qui la recouvrait de haut en bas. Elle ne servait donc qu'à teinter un
 * bandeau : ce qu'on y voyait d'une image, on ne pouvait pas le nommer.
 *
 * Or c'est l'image que le joueur choisit pour lui — souvent une carte déjà
 * composée, avec son numéro et son nom dessus. La recouvrir à 65 %, c'est
 * jeter la seule chose de cette page qu'il a fabriquée.
 *
 * Elle se voit donc en entier, et elle prend la hauteur qu'il faut pour se
 * voir : on ouvre la fiche sur l'image, le reste vient au défilement. Le
 * dégradé ne sert plus qu'à porter la ligne d'identité, il part du bas et
 * meurt avant le milieu — un numéro posé en haut de l'image reste net.
 *
 * SANS COUVERTURE, LA BANNIÈRE RESTE COURTE. Une demi-page de dégradé vide
 * serait pire que le bandeau qu'on remplace : on n'étire que ce qu'il y a à
 * regarder.
 */
export default function ProfileBanner({
  coverUrl,
  avatarUrl,
  initials,
  name,
  eyebrow,
  topBar,
  meta,
  actions,
  avatarBadge,
}: {
  coverUrl: string | null;
  avatarUrl: string | null;
  /** Repli de l'avatar quand il n'y a pas de photo. */
  initials: string;
  name: string;
  /** La ligne au-dessus du nom : poste, club, ville. */
  eyebrow?: ReactNode;
  /** Posé en haut de l'image : fil d'ariane, retour. */
  topBar?: ReactNode;
  /** Abonnés, équipes, ancienneté — sous le nom. */
  meta?: ReactNode;
  /** Suivre, Mercato, Modifier. */
  actions?: ReactNode;
  /** Le bouton appareil photo, sur sa propre fiche. */
  avatarBadge?: ReactNode;
}) {
  const illustree = Boolean(coverUrl);

  return (
    <section className="relative -mx-3 -mt-3 overflow-hidden bg-gray-900 text-white lg:-mx-5 lg:-mt-5">
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
          {/* De quoi lire le fil d'ariane sur une image claire. */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
      )}

      <div
        className={`relative mx-auto flex max-w-6xl flex-col px-5 pb-6 pt-4 sm:px-8 sm:pb-8 ${
          illustree ? "min-h-[62svh] max-h-[620px] sm:min-h-[70svh]" : "gap-6 py-6 sm:py-8"
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
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white/10 text-lg font-black text-white/80 ring-2 ring-white/20 backdrop-blur-sm">
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
                tronque — « Morgan … » a cote d'un bouton « Modifier » entier.
                Avec un plancher, c'est le bouton qui passe a la ligne. */}
            <div className="min-w-[13rem] flex-1">
              {eyebrow && (
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                  {eyebrow}
                </p>
              )}
              {/* `drop-shadow` plutôt qu'une plaque : le nom tient sur une
                  image claire sans lui poser un rectangle dessus. */}
              <h1 className="mt-1 truncate font-display text-2xl font-black uppercase leading-tight tracking-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.55)] sm:text-4xl">
                {name}
              </h1>
            </div>

            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>

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
