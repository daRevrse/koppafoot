// ============================================
// Les actions qu'on propose pour un joueur touché sur le terrain de la console.
//
// Elles dépendent de lui, et c'est tout l'intérêt d'être parti du joueur :
// l'arrêt n'a de sens que pour un gardien, le hors-jeu n'en a aucun pour
// lui, et un remplaçant ne peut ni marquer ni sortir — il entre.
//
// Ce module dit QUOI proposer, dans quel ordre et avec quel verrou ; la
// console y attache ses gestes. Il vivait dans la console du site, d'où il
// sort pour que celle de l'application propose exactement la même chose.
// Voir scripts/test-actions-joueur.ts.
//
// Module pur, sans SDK.
// ============================================

import { EMOJI_EVENEMENT, LIBELLE_EVENEMENT, type TypeEvenementJoueur } from "@/lib/evenements";
import { actionDeBallon, dribblePossible, type Cote } from "@/lib/etat-du-jeu";
import { peutPrendreLesGants, type GardienEnPlace } from "@/lib/gardiens";

/** Un fait à enregistrer, ou l'un des deux gestes du remplacement. */
export type CleAction = TypeEvenementJoueur | "entrer" | "remplacer";

/** Une action proposée. La console lui ajoute son `onClick`. */
export interface ActionProposee {
  cle: CleAction;
  libelle: string;
  emoji: string;
  /** Le ton du bouton. « rouge » sert aussi bien au carton qu'à une sortie. */
  ton?: "neutre" | "vert" | "jaune" | "rouge";
  /** Verrouillée, avec la raison : le bouton reste visible et à sa place. */
  desactive?: string | null;
}

/**
 * Qui garde les cages du camp, selon la règle du match (voir lib/gardiens).
 *
 * - `designe` : le match a été lancé avec la case « sans gardien », cochée ou
 *   non. Le gardien est celui EN PLACE d'après les événements (`null` : cages
 *   vides, ou pas de gardien du tout).
 * - `poste` : un match lancé avant la case. Le gardien est la ligne de la
 *   feuille déclarée gardien (`null` : aucune).
 */
export type GardienDuCamp =
  | { regle: "designe"; enPlace: GardienEnPlace | null; sansGardien: boolean }
  | { regle: "poste"; gardienId: string | null };

export interface JoueurTouche {
  playerId: string;
  cote: Cote;
  surLeTerrain: boolean;
  /** Le camp a une équipe. Un camp sans équipe ne prend pas les gants. */
  equipeConnue: boolean;
  gardien: GardienDuCamp;
  /** Le camp qui a le ballon, ou `null`. */
  ballon: Cote | null;
  /** Pourquoi les actions de jeu sont fermées (voir `verrou`), ou `null`. */
  verrou: string | null;
}

/**
 * Les actions proposées pour ce joueur, dans l'ordre où la console les montre.
 *
 * L'ARRÊT S'OUVRE À TOUT LE MONDE QUAND AUCUN GARDIEN N'EST DÉCLARÉ. Deux
 * tiers des lignes d'effectif n'ont pas de poste : réserver l'arrêt au
 * gardien déclaré le rendrait impossible à saisir sur la plupart des
 * feuilles. Le scoreur touche alors le bon joueur lui-même.
 *
 * CE N'EST PLUS VRAI D'UN MATCH LANCÉ AVEC LA CASE « SANS GARDIEN » (voir
 * lib/gardiens), cochée ou non. L'arrêt y va au gardien EN PLACE et à lui
 * seul, et à personne dans un petits poteaux : la feuille a désigné le
 * gardien, il n'y a plus rien à deviner. Quand les cages sont vides — le
 * gardien expulsé, ou blessé sans changement possible —, tous ont « Prendre
 * les gants ». Un match lancé avant la case garde la règle ci-dessus.
 */
export function actionsDuJoueur(j: JoueurTouche): ActionProposee[] {
  const g = j.gardien;
  const estLeGardien = g.regle === "designe"
    ? g.enPlace?.playerId === j.playerId
    : g.gardienId === j.playerId;
  const peutArreter = estLeGardien || (g.regle === "poste" && g.gardienId === null);
  const prendreLesGants = g.regle === "designe" && !g.sansGardien && j.equipeConnue
    && peutPrendreLesGants(g.enPlace, j.playerId);

  const evenement = (cle: TypeEvenementJoueur, emoji: string, ton?: ActionProposee["ton"]): ActionProposee => ({
    cle,
    libelle: LIBELLE_EVENEMENT[cle],
    emoji,
    ton,
  });

  const jaune = evenement("yellow_card", "🟨", "jaune");
  const rouge = evenement("red_card", "🟥", "rouge");

  // Sur le banc : il ne joue pas, donc il n'a rien pu faire sur le terrain.
  // Il peut en revanche entrer, et prendre un carton en attendant.
  if (!j.surLeTerrain) {
    return [
      { cle: "entrer", libelle: "Faire entrer", emoji: "🔄", ton: "vert" },
      jaune,
      rouge,
    ];
  }

  // Les actions de jeu, verrouillées le temps que le ballon revienne au rond
  // central (voir lib/etat-du-jeu).
  const deJeu = (cle: TypeEvenementJoueur, emoji: string, ton?: ActionProposee["ton"]): ActionProposee =>
    ({ ...evenement(cle, emoji, ton), desactive: j.verrou });

  const ballon = actionDeBallon(j.cote, j.ballon);

  return [
    // Pas de second but sans engagement entre les deux : c'est l'état du jeu
    // qui l'interdit, plus un minuteur.
    { ...deJeu("goal", "⚽", "vert"), libelle: "But" },
    // LE TIR CADRE EST AUSSI UN TIR, et il n'est saisi qu'une fois : les
    // compteurs de l'onglet Stats additionnent les deux (voir lib/stats-match).
    // Demander au scoreur de taper « tir » puis « cadré » aurait double le
    // geste le plus frequent du match pour une information deja contenue
    // dans le second.
    ...(estLeGardien ? [] : [
      deJeu("shot_on_target", EMOJI_EVENEMENT.shot_on_target),
      deJeu("shot", EMOJI_EVENEMENT.shot),
    ]),
    // LE BALLON, selon qui l'a : son équipe l'a, il peut le perdre ; elle
    // ne l'a pas, ou personne, il peut le gagner. Une seule des deux, et la
    // saisie fait basculer la possession (voir actionDeBallon).
    deJeu(ballon, EMOJI_EVENEMENT[ballon]),
    // LE DRIBBLE, réussi ou raté, seulement avec le ballon (voir
    // dribblePossible). Pas pour le gardien, qui n'a pas non plus le tir :
    // sa fenêtre reste courte. Le ballon suit la saisie, comme ci-dessus.
    ...(!estLeGardien && dribblePossible(j.cote, j.ballon) ? [
      deJeu("dribble", EMOJI_EVENEMENT.dribble),
      deJeu("dribble_failed", EMOJI_EVENEMENT.dribble_failed),
    ] : []),
    ...(peutArreter ? [deJeu("save", "🧤")] : []),
    ...(estLeGardien ? [] : [deJeu("offside", "🚩")]),
    deJeu("foul", "⚠️"),
    // Les cages sont vides, ou un joueur de champ y dépanne : jamais
    // verrouillée, elle arrive justement ballon mort, après l'exclusion.
    ...(prendreLesGants
      ? [{ ...evenement("gants", EMOJI_EVENEMENT.gants, "vert"), libelle: "Prendre les gants" }]
      : []),
    // Le carton et le remplacement restent ouverts : ce sont les deux choses
    // qui arrivent justement pendant un arrêt de jeu.
    jaune,
    rouge,
    { cle: "remplacer", libelle: "Remplacer", emoji: "🔄" },
    // Blessé, plus de changement ou banc vide : il sort, personne n'entre.
    // Jamais verrouillée, comme le remplacement : elle arrive ballon mort.
    { ...evenement("sortie", EMOJI_EVENEMENT.sortie), libelle: "Sortie sans remplaçant" },
  ];
}
