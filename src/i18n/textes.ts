import type { ReactElement } from "react";
import type { Langue } from "./config";

// ============================================
// Les textes d'un écran, dans les deux langues, côte à côte.
//
// LE DICTIONNAIRE CENTRAL (fr.ts, en.ts) GARDE CE QUI SERT PARTOUT : la
// navigation, le menu du compte, les réglages. Il est chargé sur chaque page.
// Y verser aussi les milliers de phrases des écrans ferait télécharger la
// page d'un organisateur à qui ouvre le score d'un match, dans les deux
// langues : sur un forfait mobile, ce n'est pas un détail.
//
// Les phrases d'un écran vivent donc DANS son fichier, en tête :
//
//   const T = textes(
//     { titre: "Classement", buts: (n: number) => `${n} but${n > 1 ? "s" : ""}` },
//     { titre: "Standings", buts: (n: number) => `${n} goal${n === 1 ? "" : "s"}` },
//   );
//   …
//   const t = useTextes(T);          // un composant client
//   const t = await textesServeur(T); // un composant serveur
//   <h1>{t.titre}</h1> <p>{t.buts(3)}</p>
//
// POURQUOI DES FONCTIONS, et pas des « {jetons} » à remplacer : les deux
// langues n'accordent pas pareil. Le pluriel, l'élision (« d'Avenir » mais
// « de Espoir » n'existe pas), l'ordre des mots — une fonction dit tout ça
// en clair, et le compilateur vérifie qu'on lui passe ce qu'elle attend.
//
// UN PARAGRAPHE QUI MET UN MOT EN GRAS s'écrit en JSX, dans un fichier .tsx :
// `methode: <>Classé sur sa <b>note</b>.</>`. Le couper en trois clés autour
// du mot gras interdirait au traducteur de déplacer le mot dans la phrase.
//
// L'ANGLAIS EST OBLIGATOIRE, CLÉ PAR CLÉ. Une clé oubliée, ou une fonction qui
// n'a pas les mêmes paramètres qu'en français, est une erreur de compilation.
// Le repli silencieux sur le français, c'est celui du dictionnaire central :
// ici, un écran qu'on déclare traduit l'est entièrement.
// ============================================

/**
 * Une phrase : un texte, un paragraphe mis en forme, ou une fonction quand
 * elle dépend d'un nombre ou d'un nom.
 */
type Phrase = string | ReactElement | ((...args: never[]) => unknown);

export type Phrases = Record<string, Phrase>;

/**
 * Une phrase française, élargie : `"but"` devient `string`, et une fonction
 * qui rend `"but" | "buts"` rend `string`. Sans cela, l'anglais devrait
 * rendre… `"but" | "buts"`.
 */
type Elargie<P> = P extends string
  ? string
  : P extends (...args: infer A) => infer R
    ? (...args: A) => R extends string ? string : R
    : P;

/** La forme du français, imposée à l'anglais : mêmes clés, mêmes paramètres. */
export type Traduction<F extends Phrases> = {
  [K in keyof F]: Elargie<F[K]>;
};

export type Textes<F extends Phrases> = Record<Langue, Traduction<F>>;

export function textes<F extends Phrases>(fr: F, en: Traduction<F>): Textes<F> {
  return { fr: fr as Traduction<F>, en };
}
