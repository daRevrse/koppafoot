// ============================================
// La seance de tirs au but, tir par tir.
//
// ELLE SE SAISISSAIT EN UN CHIFFRE, apres coup : « 4 – 3 ». Le moment le plus
// suivi d'une phase finale etait raconte quand il etait fini, et personne ne
// savait qui avait rate. La console la tient desormais comme elle se joue :
// qui tire en premier, puis chaque tir — son issue, et son tireur quand le
// scoreur l'a vu.
//
// CE MODULE SAIT TOUT CE QUI SE DEDUIT : a qui le tour, le score, si la
// seance est jouee. Cinq tirs chacun, en alternance ; elle s'arrete des
// qu'une equipe ne peut plus revenir ; a egalite apres cinq, mort subite, un
// tir chacun jusqu'a ce que l'un marque et l'autre non.
//
// La seance vit a part des evenements du match (`live_state.tirs_au_but`) :
// un tir au but n'est ni un but, ni un tir, et ne compte dans aucune
// statistique de joueur. C'est la regle.
// ============================================

export type Cote = "home" | "away";

export interface Tir {
  cote: Cote;
  issue: "marque" | "rate" | "arrete";
  playerId: string | null;
  playerName: string | null;
}

export interface Seance {
  /** L'equipe qui tire en premier, au tirage au sort ; `null` avant. */
  premier: Cote | null;
  tirs: Tir[];
}

export const SEANCE_VIDE: Seance = { premier: null, tirs: [] };

/** Les tirs de chaque equipe avant la mort subite. */
export const TIRS_PAR_EQUIPE = 5;

export interface EtatSeance {
  score: { home: number; away: number };
  /** A qui le tour ; `null` avant le tirage, ou seance jouee. */
  prochain: Cote | null;
  terminee: boolean;
  vainqueur: Cote | null;
  /** Les cinq tirs de chacun sont passes, a egalite. */
  mortSubite: boolean;
}

const autre = (c: Cote): Cote => (c === "home" ? "away" : "home");

export function etatDeLaSeance(s: Seance, tirsParEquipe: number = TIRS_PAR_EQUIPE): EtatSeance {
  const score = { home: 0, away: 0 };
  const tires = { home: 0, away: 0 };
  for (const t of s.tirs) {
    tires[t.cote] += 1;
    if (t.issue === "marque") score[t.cote] += 1;
  }
  const fin = (vainqueur: Cote): EtatSeance => ({
    score, prochain: null, terminee: true, vainqueur, mortSubite: tires.home > tirsParEquipe,
  });

  if (!s.premier) return { score, prochain: null, terminee: false, vainqueur: null, mortSubite: false };

  const second = autre(s.premier);
  // Les cinq premiers tours : on s'arrete des que le retard ne peut plus se
  // combler avec les tirs qui restent.
  if (tires.home <= tirsParEquipe && tires.away <= tirsParEquipe) {
    const restants = { home: tirsParEquipe - tires.home, away: tirsParEquipe - tires.away };
    if (score.home > score.away + restants.away) return fin("home");
    if (score.away > score.home + restants.home) return fin("away");
  }

  // La mort subite : un tour se juge quand les deux ont tire.
  const mortSubite = tires.home >= tirsParEquipe && tires.away >= tirsParEquipe
    && tires.home === tires.away;
  if (mortSubite && score.home !== score.away) return fin(score.home > score.away ? "home" : "away");

  const prochain = tires[s.premier] === tires[second] ? s.premier : second;
  return { score, prochain, terminee: false, vainqueur: null, mortSubite };
}
