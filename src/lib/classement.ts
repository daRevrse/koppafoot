// ============================================
// Le classement des joueurs de la plateforme, sur leurs cinq derniers matchs.
//
// Pur : aucun SDK, aucun reseau. Il prend des matchs, il rend des rangs. C'est
// ce qui permet de le faire tourner cote serveur apres chaque rencontre, et
// de le verifier sans base.
//
// CINQ DERNIERS MATCHS « JOUES », ce qui veut dire FIGURER SUR LA FEUILLE. Un
// remplacant qui n'est pas entre y figure quand meme : la feuille est la seule
// trace qu'on ait de qui etait la, et on ne sait pas distinguer celui qui a
// joue dix minutes de celui qui a regarde. C'est assume — la fenetre sert a
// mesurer une forme recente, pas un temps de jeu.
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
import type { CompMatch, LineupEntry } from "@/types";

/** Combien de matchs recents comptent. */
export const FENETRE = 5;

/** La longueur du classement publie. */
export const TAILLE_CLASSEMENT = 100;

/**
 * Ce qu'un clean sheet vaut, en arrets.
 *
 * Le classement des gardiens se lit « arrets par match », et le clean sheet
 * s'y ajoute en bonus : sans lui, un gardien tres sollicite derriere une
 * defense poreuse passerait devant celui qui n'encaisse jamais. Un match sans
 * but encaisse vaut donc autant qu'une paire d'arrets.
 */
export const BONUS_CLEAN_SHEET = 2;

export interface LigneClassement {
  /** L'identite : `uid:<compte>` ou, faute de compte, `nom:<nom normalise>`. */
  cle: string;
  nom: string;
  /** Le compte, quand on le connait. Null pour une ligne jamais revendiquee. */
  uid: string | null;
  buts: number;
  passes: number;
  /** Buts + passes : ce sur quoi le classement trie. */
  total: number;
  /** Combien de matchs de la fenetre le concernent. */
  matchs: number;
}

export interface LigneGardien extends LigneClassement {
  arrets: number;
  cleanSheets: number;
  /** Arrets par match, clean sheets compris en bonus. Le tri du classement. */
  note: number;
}

export interface Classements {
  performances: LigneClassement[];
  gardiens: LigneGardien[];
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
  buts: number;
  passes: number;
  arrets: number;
  cleanSheets: number;
  matchs: number;
  estGardien: boolean;
}

/**
 * Les deux classements, calcules sur les matchs TERMINES fournis.
 *
 * L'appelant choisit le perimetre : les competitions locales et les amicaux,
 * jamais le football mondial — le fournisseur externe ne donne pas le detail
 * par joueur, et ses matchs n'ont pas de feuille chez nous.
 */
export function calculerClassements(matchs: CompMatch[]): Classements {
  const termines = matchs
    .filter((m) => m.status === "completed")
    .sort(parDateDecroissante);

  // Combien de matchs de la fenetre chaque joueur a deja consommes. Les matchs
  // etant parcourus du plus recent au plus ancien, on s'arrete a cinq.
  const vus = new Map<string, number>();
  const cumuls = new Map<string, Cumul>();
  let matchsRetenus = 0;

  for (const match of termines) {
    const camps = [
      { entries: match.homeLineup, encaisses: match.scoreAway ?? 0 },
      { entries: match.awayLineup, encaisses: match.scoreHome ?? 0 },
    ];

    // Qui, sur cette feuille, entre dans sa fenetre. Un joueur qui a deja ses
    // cinq matchs plus recents ne compte plus, et ses buts de ce soir-la non
    // plus : la fenetre porte sur le joueur, pas sur le match.
    const retenus = new Map<string, Cumul>();

    for (const { entries, encaisses } of camps) {
      for (const entry of entries) {
        const cle = cleDe(entry);
        if (!cle) continue;
        const deja = vus.get(cle) ?? 0;
        if (deja >= FENETRE) continue;
        vus.set(cle, deja + 1);

        const cumul = cumuls.get(cle) ?? {
          cle,
          nom: entry.name.trim(),
          uid: entry.userId ?? null,
          buts: 0,
          passes: 0,
          arrets: 0,
          cleanSheets: 0,
          matchs: 0,
          estGardien: false,
        };
        cumul.matchs += 1;
        // Le premier nom non vide gagne, comme le classement des buteurs.
        if (cumul.nom === "" && entry.name.trim() !== "") cumul.nom = entry.name.trim();
        if (!cumul.uid && entry.userId) cumul.uid = entry.userId;
        if (normaliserPoste(entry.position) === "goalkeeper") {
          cumul.estGardien = true;
          if (encaisses === 0) cumul.cleanSheets += 1;
        }
        cumuls.set(cle, cumul);
        // La feuille peut porter deux fois le meme identifiant si un effectif
        // a ete saisi de travers : la premiere ligne fait foi.
        if (!retenus.has(entry.playerId)) retenus.set(entry.playerId, cumul);
      }
    }

    if (retenus.size === 0) continue;
    matchsRetenus += 1;

    for (const event of match.liveState?.events ?? []) {
      if (event.varStatus === "cancelled") continue;
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
        // Un arret designe un gardien, meme quand la feuille ne l'a pas dit :
        // deux tiers des lignes d'effectif n'ont pas de poste, et la console
        // ouvre alors l'arret a tout le monde.
        acteur.estGardien = true;
      }
    }
  }

  const tous = [...cumuls.values()];

  const performances: LigneClassement[] = tous
    .map((c) => ({
      cle: c.cle,
      nom: c.nom,
      uid: c.uid,
      buts: c.buts,
      passes: c.passes,
      total: c.buts + c.passes,
      matchs: c.matchs,
    }))
    // Un joueur sans la moindre contribution n'a rien a faire dans un
    // classement de contributions : il y serait a zero, comme des centaines
    // d'autres, et le classement n'aurait plus de fin.
    .filter((l) => l.total > 0)
    .sort((a, b) => b.total - a.total || b.buts - a.buts || a.nom.localeCompare(b.nom))
    .slice(0, TAILLE_CLASSEMENT);

  const gardiens: LigneGardien[] = tous
    .filter((c) => c.estGardien && c.matchs > 0)
    .map((c) => ({
      cle: c.cle,
      nom: c.nom,
      uid: c.uid,
      buts: c.buts,
      passes: c.passes,
      total: c.buts + c.passes,
      matchs: c.matchs,
      arrets: c.arrets,
      cleanSheets: c.cleanSheets,
      note: (c.arrets + c.cleanSheets * BONUS_CLEAN_SHEET) / c.matchs,
    }))
    .filter((l) => l.arrets > 0 || l.cleanSheets > 0)
    .sort((a, b) => b.note - a.note || b.arrets - a.arrets || a.nom.localeCompare(b.nom))
    .slice(0, TAILLE_CLASSEMENT);

  return { performances, gardiens, matchsRetenus };
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
