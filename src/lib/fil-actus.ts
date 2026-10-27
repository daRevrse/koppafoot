// ============================================
// Le fil d'Actus découpé pour la lecture : la une du jour, puis une journée
// après l'autre. Pur et sans SDK : la page /actus du site et l'onglet Actus
// de l'application le lisent tous deux, pour que la une soit la même ici et là.
//
// Le fil lui-même (les flux, le dédoublonnage) reste dans `news-rss`, côté
// serveur : ce module ne fait que ranger ce qu'il a rendu.
// ============================================

import { cleDuJour } from "@/lib/dates";

export interface Article {
  id: string;
  title: string;
  /** Le média qui publie, affiché, et c'est la moindre des choses. */
  source: string;
  url: string;
  /** ISO, ou "" si le flux n'a pas donné de date lisible. */
  at: string;
  /**
   * Vignette de l'article, telle que le flux de l'éditeur la donne.
   *
   * Toujours `null` pour Google Actualités. Ce qui a été essayé de ce côté :
   * gratter la balise og:image de la page intermédiaire. Ça rend LA MÊME
   * vignette générique pour tous les articles, pas celle du sujet.
   */
  image: string | null;
}

export interface JourneeDuFil {
  /** « 2026-10-27 », ou `null` pour les articles sans date (« Plus tôt »). */
  cle: string | null;
  articles: Article[];
}

export interface FilDuJour {
  /** Ce qui passe en grand : cinq articles du jour au plus. */
  une: Article[];
  journees: JourneeDuFil[];
}

/** Combien d'articles du jour passent en grand. */
const TAILLE_DE_LA_UNE = 5;

/**
 * Le jour d'un article, à l'heure de celui qui lit. Un article daté plus tard
 * que maintenant (un éditeur qui se trompe de fuseau) compte pour aujourd'hui.
 */
export function jourDeLArticle(at: string, maintenant: Date): string | null {
  const d = new Date(at);
  if (!at || Number.isNaN(d.getTime())) return null;
  const cle = cleDuJour(d);
  const aujourdhui = cleDuJour(maintenant);
  return cle > aujourdhui ? aujourdhui : cle;
}

/**
 * La une et les journées. Le fil arrive du plus récent au plus ancien : une
 * journée s'ouvre à chaque changement de jour, les articles sans date à la fin.
 *
 * Les cinq premiers du jour passent en grand, ceux qui ont une photo d'abord :
 * la une est le seul endroit où elle se voit en entier. Elle ne dépend pas
 * d'en avoir une, Google Actualités n'en donne jamais. Ce qui est à la une
 * quitte sa journée, et une journée vidée disparaît.
 */
export function filParJour(articles: Article[], maintenant: Date): FilDuJour {
  const journees: JourneeDuFil[] = [];
  for (const a of articles) {
    const cle = jourDeLArticle(a.at, maintenant);
    const derniere = journees[journees.length - 1];
    if (derniere && derniere.cle === cle) derniere.articles.push(a);
    else journees.push({ cle, articles: [a] });
  }

  const duJour = journees[0]?.cle === cleDuJour(maintenant) ? journees[0] : null;
  const une = duJour
    ? [...duJour.articles].sort((a, b) => Number(!!b.image) - Number(!!a.image)).slice(0, TAILLE_DE_LA_UNE)
    : [];
  const aLaUne = new Set(une.map((a) => a.id));

  return {
    une,
    journees: journees
      .map((j) => (j === duJour ? { ...j, articles: j.articles.filter((a) => !aLaUne.has(a.id)) } : j))
      .filter((j) => j.articles.length > 0),
  };
}
