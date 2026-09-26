// ============================================
// Le classement des joueurs de la plateforme, sur leurs cinq derniers matchs.
//
// Pur : aucun SDK, aucun reseau. Il prend des matchs, il rend des rangs. C'est
// ce qui permet de le faire tourner cote serveur apres chaque rencontre, et
// de le verifier sans base.
//
// UNE SEULE LISTE, GARDIENS COMPRIS, CLASSEE SUR UNE NOTE. Il y avait deux
// classements : les buts et les passes pour tout le monde, les arrets pour
// les gardiens. Deux listes pour une question — qui est le meilleur en ce
// moment —, et un gardien qui ne pouvait figurer dans la premiere qu'en
// marquant. Chacun est maintenant classe sur sa NOTE DE MATCH (voir
// lib/notes), celle que la console calcule pendant le direct : elle juge un
// gardien sur ce qu'on attend d'un gardien (arrets, but inviole, buts
// encaisses) et un joueur de champ sur ce qu'on attend de lui (buts, passes,
// tirs, discipline). Les deux tiennent sur la meme echelle, et le chiffre
// affiche est celui de la pastille d'etat de forme du joueur (meme moyenne
// ponderee, voir `moyennePonderee`).
//
// Les buts et les passes restent un tri a part : c'est une autre question —
// qui marque et fait marquer —, et elle a ses lecteurs.
//
// CINQ DERNIERS MATCHS « JOUES », ce qui veut dire FIGURER SUR LA FEUILLE. Un
// remplacant qui n'est pas entre y figure quand meme : la feuille est la seule
// trace qu'on ait de qui etait la. Il n'a en revanche pas de note — il n'a
// pas assez joue pour en meriter une —, et ce match-la ne compte pas dans sa
// moyenne.
//
// L'IDENTITE EST LE COMPTE. `player_id` designe une ligne d'effectif, propre a
// une equipe dans une competition : le meme homme inscrit dans deux clubs y
// porte deux identifiants, et un classement de plateforme en ferait deux
// joueurs. On lit donc `user_id`, recopie sur la feuille a sa validation.
//
// Faute de compte, on retombe sur le NOM. C'est un pis-aller, et il faut le
// dire : deux homonymes fusionnent, et un joueur dont on ecrit le nom de deux
// facons se dedouble. La revendication de ligne d'effectif est la sortie de
// ce probleme, pas ce module.
// ============================================

import { normaliserPoste } from "@/lib/postes";
import { OWN_GOAL_DETAIL } from "@/lib/evenements";
import { moyennePonderee, notesDuCamp, type NoteJoueur } from "@/lib/notes";
import { DUREE_MATCH_DEFAUT } from "@/lib/player-stats";
import type { CompMatch, LineupEntry } from "@/types";

/** Combien de matchs recents comptent. */
export const FENETRE = 5;

/** La longueur de chaque classement publie. */
export const TAILLE_CLASSEMENT = 100;

/**
 * Combien de matchs NOTES il faut pour etre classe a la note.
 *
 * Deux suffisent a une forme (voir lib/etat-de-forme) ; un classement est une
 * comparaison, et deux gros matchs d'affilee ne doivent pas suffire a passer
 * devant celui qui tient sa note depuis cinq. Le tri par buts et passes, lui,
 * n'a pas de seuil : un but est un but.
 */
export const MATCHS_NOTES_CLASSEMENT = 3;

/** Une ligne du classement : un joueur, et ce que ses cinq derniers matchs disent de lui. */
export interface LigneJoueur {
  /** L'identite : `uid:<compte>` ou, faute de compte, `nom:<nom normalise>`. */
  cle: string;
  nom: string;
  /** Le compte, quand on le connait. Null pour une ligne jamais revendiquee. */
  uid: string | null;
  /**
   * Gardien de but : il a garde les buts sur au moins la moitie de ses
   * matchs. C'est ce qui decide de ce qu'on affiche sous son nom — ses arrets
   * plutot que ses buts —, pas de la facon dont il est note : la note sait
   * deja, match par match, qui etait dans les buts.
   */
  gardien: boolean;
  /** Le club de son dernier match. */
  equipe: string | null;
  /** Combien de matchs de la fenetre le concernent. */
  matchs: number;
  buts: number;
  passes: number;
  /** Buts + passes : le tri secondaire. */
  total: number;
  arrets: number;
  cleanSheets: number;
  /** Les notes de la fenetre, la plus recente d'abord. Null : pas assez joue ce jour-la. */
  notes: (number | null)[];
  /** La moyenne ponderee des notes. Null sous `MATCHS_NOTES_CLASSEMENT` matchs notes. */
  note: number | null;
}

/** Une ligne publiee : le calcul, son rang dans chacun des deux tris, et ses fleches. */
export type LigneJoueurPubliee = LigneJoueur & {
  /** Rang a la note, 1 en tete. Null quand il n'y est pas classe. */
  rangNote: number | null;
  /** Rang aux buts et passes. Null quand il n'y est pas classe. */
  rangContribution: number | null;
  /**
   * Places gagnees depuis le calcul precedent, dans chaque tri. Negatif pour
   * une descente, `null` pour une entree qui n'etait pas la — elle n'a pas
   * grimpe de vingt places, elle vient d'arriver, et la fleche ne s'affiche
   * pas.
   */
  mouvementNote: number | null;
  mouvementContribution: number | null;
  /**
   * La photo de profil, relevée au calcul (voir lib/classement-admin). Absente
   * d'une ligne sans compte, qui garde ses initiales.
   */
  photo?: string | null;
};

export interface ClassementsPublies {
  /** Les deux classements a la fois, sans doublon : chaque ligne porte ses deux rangs. */
  joueurs: LigneJoueurPubliee[];
  matchsRetenus: number;
  /** ISO. Null quand le classement n'a jamais ete calcule. */
  calculeLe: string | null;
}

/**
 * Ce qu'un match RENSEIGNE APRES COUP apporte.
 *
 * Un match saisi depuis « Renseigner un match joue » n'a ni feuille ni
 * evenements : il n'a jamais eu de console. Il porte en revanche la liste de
 * ses buteurs et passeurs, et c'est ce que le tri par buts et passes demande.
 * Les joueurs nommes la comptent donc un match chacun — a defaut de feuille,
 * la liste des buteurs EST la seule trace de qui etait sur le terrain.
 *
 * Ce que ca coute, et il faut le dire : un joueur qui a joue ce match sans
 * marquer ni faire marquer n'y figure pas, donc ce match ne compte pas dans SA
 * fenetre de cinq. Et personne n'y est NOTE — on ne note pas ce qu'on n'a pas
 * vu. Un match renseigne apres coup vaut moins qu'un match tenu a la console :
 * c'est le prix du raccourci, pas un defaut du calcul.
 */
export interface ContributionDirecte {
  playerId: string;
  nom: string;
  userId: string | null;
  buts: number;
  passes: number;
}

/** Un match, avec ce que la console n'a pas pu enregistrer. */
export type MatchAClasser = CompMatch & {
  contributionsDirectes?: ContributionDirecte[];
  /**
   * La duree reglementaire, pour la note (voir `MINUTES_MINIMUM`) : un 7v7 en
   * deux fois vingt minutes ne dure pas quatre-vingt-dix. Absente, les deux
   * mi-temps par defaut.
   */
  dureeMatchMin?: number;
};

export interface Classements {
  /** Tout le monde, gardiens compris, a la note. */
  parNote: LigneJoueur[];
  /** Tout le monde, aux buts et passes. */
  parContribution: LigneJoueur[];
  /** Combien de matchs ont nourri le calcul, pour savoir s'il vaut quelque chose. */
  matchsRetenus: number;
}

function cleDe(entry: Pick<LineupEntry, "userId" | "name">): string | null {
  if (entry.userId) return `uid:${entry.userId}`;
  const nom = entry.name.trim().toLowerCase();
  return nom === "" ? null : `nom:${nom}`;
}

/** Le plus recent d'abord. Une date manquante passe en dernier. */
function parDateDecroissante(a: CompMatch, b: CompMatch): number {
  const da = `${a.date ?? ""}T${a.time ?? ""}`;
  const db = `${b.date ?? ""}T${b.time ?? ""}`;
  return db.localeCompare(da);
}

interface Cumul {
  cle: string;
  nom: string;
  uid: string | null;
  equipe: string | null;
  buts: number;
  passes: number;
  arrets: number;
  cleanSheets: number;
  matchs: number;
  /** Matchs de la fenetre joues avec le poste de gardien sur la feuille. */
  matchsAuBut: number;
  /** A-t-il un poste declare, quel qu'il soit, sur l'une de ses feuilles ? */
  posteConnu: boolean;
  notes: (number | null)[];
}

function nouveauCumul(cle: string, nom: string, uid: string | null): Cumul {
  return {
    cle, nom, uid, equipe: null,
    buts: 0, passes: 0, arrets: 0, cleanSheets: 0, matchs: 0,
    matchsAuBut: 0, posteConnu: false, notes: [],
  };
}

/**
 * Est-il gardien ? Au but sur au moins la moitie de ses matchs.
 *
 * SANS AUCUN POSTE DECLARE, les arrets le designent : deux tiers des lignes
 * d'effectif n'ont pas de poste, et la console ouvre alors l'arret a tout le
 * monde. Il faut qu'il en fasse en moyenne un par match — un defenseur qui a
 * detourne un tir une fois dans la saison n'en devient pas gardien.
 */
function estGardien(c: Cumul): boolean {
  if (c.matchsAuBut > 0) return c.matchsAuBut * 2 >= c.matchs;
  return !c.posteConnu && c.matchs > 0 && c.arrets >= c.matchs;
}

/**
 * Le classement, calcule sur les matchs TERMINES fournis.
 *
 * L'appelant choisit le perimetre : les competitions locales et les amicaux,
 * jamais le football mondial — le fournisseur externe ne donne pas le detail
 * par joueur, et ses matchs n'ont pas de feuille chez nous.
 */
export function calculerClassements(matchs: MatchAClasser[]): Classements {
  const termines = matchs
    .filter((m) => m.status === "completed")
    .sort(parDateDecroissante);

  // Combien de matchs de la fenetre chaque joueur a deja consommes. Les matchs
  // etant parcourus du plus recent au plus ancien, on s'arrete a cinq.
  const vus = new Map<string, number>();
  const cumuls = new Map<string, Cumul>();
  let matchsRetenus = 0;

  for (const match of termines) {
    // Un match renseigne apres coup n'a ni feuille ni evenements : ses buteurs
    // et passeurs sont sa seule trace. Traite ICI, dans la meme boucle
    // chronologique, et non a part : la fenetre de cinq est une fenetre de
    // DATES, et compter les feuilles d'abord la remplirait dans le desordre.
    if (match.contributionsDirectes?.length) {
      let compte = false;
      for (const c of match.contributionsDirectes) {
        const nom = c.nom.trim();
        const cle = c.userId ? `uid:${c.userId}` : `nom:${nom.toLowerCase()}`;
        if (cle === "nom:") continue;
        const deja = vus.get(cle) ?? 0;
        if (deja >= FENETRE) continue;
        vus.set(cle, deja + 1);
        compte = true;

        const cumul = cumuls.get(cle) ?? nouveauCumul(cle, nom, c.userId);
        cumul.matchs += 1;
        cumul.buts += c.buts;
        cumul.passes += c.passes;
        if (cumul.nom === "" && nom !== "") cumul.nom = nom;
        if (!cumul.uid && c.userId) cumul.uid = c.userId;
        cumuls.set(cle, cumul);
      }
      if (compte) matchsRetenus += 1;
      // Il n'a pas de feuille : rien d'autre a lire sur ce match.
      continue;
    }

    // Les faits qui comptent : un but annule par la VAR est efface du tableau
    // d'affichage, il ne compte ni dans les buts ni dans la note.
    const faits = (match.liveState?.events ?? []).filter((e) => e.varStatus !== "cancelled");
    const camps = [
      { entries: match.homeLineup, teamId: match.homeTeamId, equipe: match.homeTeamName, encaisses: match.scoreAway ?? 0 },
      { entries: match.awayLineup, teamId: match.awayTeamId, equipe: match.awayTeamName, encaisses: match.scoreHome ?? 0 },
    ];

    // Qui, sur cette feuille, entre dans sa fenetre. Un joueur qui a deja ses
    // cinq matchs plus recents ne compte plus, et ses buts de ce soir-la non
    // plus : la fenetre porte sur le joueur, pas sur le match.
    const retenus = new Map<string, Cumul>();

    for (const camp of camps) {
      // Les notes du camp se calculent ensemble — le but encaisse du gardien
      // depend du match entier —, et seulement si quelqu'un en a besoin.
      let notes: Map<string, NoteJoueur> | null = null;

      for (const entry of camp.entries) {
        const cle = cleDe(entry);
        if (!cle) continue;
        const deja = vus.get(cle) ?? 0;
        if (deja >= FENETRE) continue;
        vus.set(cle, deja + 1);

        const cumul = cumuls.get(cle) ?? nouveauCumul(cle, entry.name.trim(), entry.userId ?? null);
        cumul.matchs += 1;
        // Le premier nom non vide gagne, comme le classement des buteurs ; le
        // premier club aussi, et c'est celui du match le plus recent.
        if (cumul.nom === "" && entry.name.trim() !== "") cumul.nom = entry.name.trim();
        if (!cumul.uid && entry.userId) cumul.uid = entry.userId;
        if (!cumul.equipe && camp.equipe) cumul.equipe = camp.equipe;

        const poste = normaliserPoste(entry.position);
        if (poste) cumul.posteConnu = true;
        if (poste === "goalkeeper") {
          cumul.matchsAuBut += 1;
          if (camp.encaisses === 0) cumul.cleanSheets += 1;
        }

        notes ??= notesDuCamp(
          match, camp.entries, faits, camp.teamId, match.dureeMatchMin ?? DUREE_MATCH_DEFAUT,
        );
        cumul.notes.push(notes.get(entry.playerId)?.note ?? null);

        cumuls.set(cle, cumul);
        // La feuille peut porter deux fois le meme identifiant si un effectif
        // a ete saisi de travers : la premiere ligne fait foi.
        if (!retenus.has(entry.playerId)) retenus.set(entry.playerId, cumul);
      }
    }

    if (retenus.size === 0) continue;
    matchsRetenus += 1;

    for (const event of faits) {
      const acteur = event.playerId ? retenus.get(event.playerId) : undefined;

      if (event.type === "goal") {
        // Le but contre son camp ne crédite ni son auteur ni personne.
        if (event.detail === OWN_GOAL_DETAIL) continue;
        if (acteur) acteur.buts += 1;
        const passeur = event.assistPlayerId ? retenus.get(event.assistPlayerId) : undefined;
        // On ne se sert pas soi-meme.
        if (passeur && passeur !== acteur) passeur.passes += 1;
      } else if (event.type === "save" && acteur) {
        acteur.arrets += 1;
      }
    }
  }

  const joueurs: LigneJoueur[] = [...cumuls.values()].map((c) => {
    const notees = c.notes.filter((n): n is number => n !== null);
    return {
      cle: c.cle,
      nom: c.nom,
      uid: c.uid,
      gardien: estGardien(c),
      equipe: c.equipe,
      matchs: c.matchs,
      buts: c.buts,
      passes: c.passes,
      total: c.buts + c.passes,
      arrets: c.arrets,
      cleanSheets: c.cleanSheets,
      notes: c.notes,
      note: notees.length >= MATCHS_NOTES_CLASSEMENT ? moyennePonderee(notees, FENETRE) : null,
    };
  });

  const parNote = joueurs
    .filter((l) => l.note !== null)
    // A note egale, celui qui a le plus contribue, puis celui qui l'a tenue
    // sur le plus de matchs.
    .sort((a, b) =>
      (b.note as number) - (a.note as number)
      || b.total - a.total
      || b.matchs - a.matchs
      || a.nom.localeCompare(b.nom))
    .slice(0, TAILLE_CLASSEMENT);

  const parContribution = joueurs
    // Un joueur sans la moindre contribution n'a rien a faire dans un
    // classement de contributions : il y serait a zero, comme des centaines
    // d'autres, et le classement n'aurait plus de fin.
    .filter((l) => l.total > 0)
    .sort((a, b) => b.total - a.total || b.buts - a.buts || a.nom.localeCompare(b.nom))
    .slice(0, TAILLE_CLASSEMENT);

  return { parNote, parContribution, matchsRetenus };
}

/**
 * Le mouvement de chaque ligne depuis le calcul precedent.
 *
 * `null` sur une entree nouvelle : elle n'a pas grimpe de vingt places, elle
 * n'etait pas la. La fleche ne s'affiche donc pas, plutot que d'annoncer un
 * bond qui n'a pas eu lieu.
 */
export function mouvements<T extends { cle: string }>(
  courant: T[],
  precedent: string[],
): Map<string, number | null> {
  const rangsAvant = new Map(precedent.map((cle, i) => [cle, i]));
  const out = new Map<string, number | null>();
  courant.forEach((ligne, i) => {
    const avant = rangsAvant.get(ligne.cle);
    out.set(ligne.cle, avant === undefined ? null : avant - i);
  });
  return out;
}

/**
 * Les deux classements en une seule liste, pour le document publie.
 *
 * Un meme joueur est souvent dans les deux : il n'y figure qu'une fois, avec
 * ses deux rangs. L'ordre de la liste est celui de la note, puis ceux qui ne
 * sont classes qu'aux buts et passes.
 */
export function fusionnerClassements(
  c: Pick<Classements, "parNote" | "parContribution">,
  precedent: { note: string[]; contribution: string[] },
): LigneJoueurPubliee[] {
  const mvtNote = mouvements(c.parNote, precedent.note);
  const mvtContribution = mouvements(c.parContribution, precedent.contribution);
  const rangNote = new Map(c.parNote.map((l, i) => [l.cle, i + 1]));
  const rangContribution = new Map(c.parContribution.map((l, i) => [l.cle, i + 1]));

  const vues = new Set<string>();
  const out: LigneJoueurPubliee[] = [];
  for (const l of [...c.parNote, ...c.parContribution]) {
    if (vues.has(l.cle)) continue;
    vues.add(l.cle);
    out.push({
      ...l,
      rangNote: rangNote.get(l.cle) ?? null,
      rangContribution: rangContribution.get(l.cle) ?? null,
      mouvementNote: mvtNote.get(l.cle) ?? null,
      mouvementContribution: mvtContribution.get(l.cle) ?? null,
    });
  }
  return out;
}

/** Le tri d'un classement publie : la note, ou les buts et passes. */
export type TriClassement = "note" | "contribution";

/**
 * Les lignes classees dans ce tri, dans l'ordre. Une ligne publiee porte ses
 * deux rangs ; celles qui n'en ont pas dans ce tri n'y figurent pas.
 */
export function classementPar(joueurs: LigneJoueurPubliee[], tri: TriClassement): LigneJoueurPubliee[] {
  const rang = (l: LigneJoueurPubliee) => (tri === "note" ? l.rangNote : l.rangContribution);
  return joueurs
    .filter((l) => rang(l) !== null)
    .sort((a, b) => (rang(a) as number) - (rang(b) as number));
}
