"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PiloteConsole } from "@/lib/console-pilote";
import {
  POSSESSION_VIDE, appuyer, basculer, reprendre, suspendre, versStockage, type Possession,
} from "@/lib/possession";
import type { CompMatch } from "@/types";
import type { Side } from "./types";

// Une pièce de la console live (LiveMatchConsole).

export function usePossession(pilote: PiloteConsole, match: CompMatch | null, ballonEnJeu: boolean) {
  /**
   * La possession de balle, tenue ICI et non dans le match.
   *
   * La console est le seul ecrivain : un match n'a qu'un scoreur. L'etat local
   * fait donc autorite tant qu'elle est ouverte, et l'abonnement ne le reseme
   * qu'une fois — au premier match recu. Sans cette regle, chaque ecriture
   * reviendrait par l'abonnement et ecraserait la bascule suivante, qui a eu
   * lieu entre-temps.
   */
  const [possession, setPossession] = useState<Possession>(POSSESSION_VIDE);
  const possessionRef = useRef<Possession | null>(null);
  const flushRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- La possession de balle ------------------------------------------------
  //
  // Le scoreur tient une bascule : le camp qui a le ballon. Tout le calcul vit
  // dans `lib/possession`, la console ne fait que declarer les bascules et
  // choisir QUAND elles partent en base.

  /**
   * Le delai avant qu'une bascule parte en base.
   *
   * Une possession change jusqu'a trois cents fois dans un match, et chaque
   * ecriture reveille tous ceux qui regardent la fiche publique. On n'ecrit
   * donc qu'une fois par fenetre, en gardant la derniere valeur — celui qui
   * regarde voit de toute facon sa barre avancer entre deux ecritures, puisque
   * le segment en cours se deduit de `since`.
   *
   * Le prix : les deux secondes et demie qui suivent une bascule sont creditees
   * au camp precedent chez le lecteur. Sur quatre-vingt-dix minutes, ces
   * erreurs se compensent d'un camp a l'autre et ne deplacent pas le chiffre.
   */
  const DELAI_ECRITURE_POSSESSION = 2500;

  const enAttenteRef = useRef<Possession | null>(null);

  const envoyerPossession = useCallback(() => {
    if (flushRef.current) {
      clearTimeout(flushRef.current);
      flushRef.current = null;
    }
    const p = enAttenteRef.current;
    enAttenteRef.current = null;
    if (!p) return;
    // Silencieuse : une possession perdue est un chiffre approximatif, pas un
    // match fausse. Interrompre le scoreur pour ca couterait plus que ca ne
    // rapporte.
    void pilote.poserPossession(versStockage(p)).catch(() => {});
  }, [pilote]);

  const majPossession = useCallback((next: Possession, immediat = false) => {
    possessionRef.current = next;
    setPossession(next);
    enAttenteRef.current = next;
    if (immediat) {
      envoyerPossession();
      return;
    }
    // Une ecriture est deja programmee : elle emportera cette valeur-ci.
    if (flushRef.current) return;
    flushRef.current = setTimeout(envoyerPossession, DELAI_ECRITURE_POSSESSION);
  }, [envoyerPossession]);

  /** Ballon en jeu ou non, tel que la possession l'a vu en dernier. */
  const ballonEnJeuRef = useRef<boolean | null>(null);

  // Semee UNE SEULE FOIS. Voir la declaration de `possessionRef` : l'abonnement
  // renvoie ce que la console vient d'ecrire, et le relire ecraserait la
  // bascule qui a eu lieu depuis.
  //
  // L'ETAT DU BALLON EST RETENU AU MEME MOMENT. Le match arrive apres le premier
  // rendu : l'effet ci-dessous, qui attend la possession, ne retenait donc
  // rien au montage, et prenait le premier vrai changement — le coup d'envoi —
  // pour une initialisation. La possession ne commencait a compter qu'au
  // premier appui du scoreur.
  useEffect(() => {
    if (possessionRef.current !== null || !match) return;
    const depart = match.liveState?.possession ?? POSSESSION_VIDE;
    possessionRef.current = depart;
    ballonEnJeuRef.current = ballonEnJeu;
    // Semée depuis le premier match reçu, voir plus haut : c'est le but de l'effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPossession(depart);
  }, [match, ballonEnJeu]);

  // Le ballon devient mort, le segment en cours se clot ; il revient en jeu, il
  // reprend. Un effet plutot que des appels dans chaque bouton : le but, le
  // penalty, l'arret de jeu, la mi-temps, l'interruption et la fin de match
  // passent par autant de chemins, et il en manquerait un.
  useEffect(() => {
    if (possessionRef.current === null || ballonEnJeuRef.current === null) return;
    if (ballonEnJeuRef.current === ballonEnJeu) return;
    ballonEnJeuRef.current = ballonEnJeu;
    const actuel = possessionRef.current;
    // Suivre le ballon, quel que soit le geste qui l'a rendu mort : voir plus haut.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    majPossession(ballonEnJeu ? reprendre(actuel) : suspendre(actuel), true);
  }, [ballonEnJeu, majPossession]);

  // La derniere bascule part avant que l'ecran ne disparaisse.
  useEffect(() => () => { envoyerPossession(); }, [envoyerPossession]);

  const basculerPossession = (side: Side | null) => {
    const actuel = possessionRef.current ?? POSSESSION_VIDE;
    majPossession(basculer(actuel, side, ballonEnJeu));
  };

  /** L'heure du dernier appui RETENU sur la pelouse. Voir `appuyer`. */
  const dernierAppuiRef = useRef<number | null>(null);

  /**
   * L'herbe d'un camp, ballon en jeu : elle lui donne le ballon, ou compte une
   * passe s'il l'a deja. Les passes partent avec la possession, dans la meme
   * fenetre d'ecriture — aucune ecriture de plus.
   */
  const appuyerSur = (side: Side) => {
    const actuel = possessionRef.current ?? POSSESSION_VIDE;
    const maintenant = Date.now();
    const next = appuyer(actuel, side, ballonEnJeu, maintenant, dernierAppuiRef.current);
    if (next === actuel) return;
    dernierAppuiRef.current = maintenant;
    majPossession(next);
  };

  /**
   * Jeter la possession en attente d'écriture, et repartir de zéro : le retour
   * aux feuilles le fait AVANT de refermer le direct (voir la console).
   */
  const jeterLaPossession = () => {
    if (flushRef.current) {
      clearTimeout(flushRef.current);
      flushRef.current = null;
    }
    enAttenteRef.current = null;
    possessionRef.current = POSSESSION_VIDE;
    setPossession(POSSESSION_VIDE);
  };

  return { possession, basculerPossession, appuyerSur, jeterLaPossession };
}
