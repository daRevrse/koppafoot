import * as yup from "yup";

// ============================================
// Ce qu'on accepte dans un champ, écrit une fois.
//
// D'OÙ ÇA VIENT : un testeur a saisi « 1m89 » dans le champ Ville. Ce n'est
// pas une faute d'inattention isolée, c'est ce que fait un formulaire dont
// les champs n'exigent rien — on remplit la case qu'on a sous le doigt avec
// ce qu'on a en tête. Et une fois enregistrée, cette ville-là se retrouve sur
// une fiche publique, dans une recherche par ville, dans un filtre de mercato.
//
// LA RÈGLE N'EST PAS « INTERDIRE LES CHIFFRES ». Une ville peut légitimement
// en porter un — « Lomé 2 », « Paris 15 » — et refuser ces adresses-là pour
// attraper « 1m89 » ferait plus de dégâts que le problème d'origine. On exige
// donc une quantité minimale de LETTRES : « 1m89 » n'en a qu'une, « Lomé 2 »
// en a quatre. Le nombre, lui, ne gêne personne.
//
// UN NOM, EN REVANCHE, N'A JAMAIS DE CHIFFRE. Là, l'interdiction est nette :
// aucun prénom ni nom de famille ne s'écrit avec des nombres, et laisser
// passer « Jean2 » revient à publier une identité fausse.
//
// Ce module est le SEUL endroit où ces règles s'écrivent. Elles vivaient
// dispersées dans trois formulaires — inscription, complétion de profil,
// édition de profil — chacun avec son propre `min(2)` et rien d'autre.
// ============================================

/** Lettres de toutes les écritures, espaces, apostrophes, traits d'union, points. */
const LETTRES_ET_SEPARATEURS = /^[\p{L}\p{M}\s'’.-]+$/u;

/** Au moins trois lettres : « 1m89 » n'en a qu'une, « Kara » en a quatre. */
function auMoinsTroisLettres(valeur: string | undefined): boolean {
  if (!valeur) return true;
  return (valeur.match(/\p{L}/gu) ?? []).length >= 3;
}

/**
 * Un prénom ou un nom de famille.
 *
 * Deux caractères au minimum, parce que des noms de deux lettres existent, et
 * aucun chiffre, parce qu'aucun nom n'en porte.
 */
export const nomPersonne = (champ: string) =>
  yup
    .string()
    .trim()
    .min(2, "Min. 2 caractères")
    .max(40, "Max. 40 caractères")
    .matches(LETTRES_ET_SEPARATEURS, `${champ} : lettres, tirets et apostrophes seulement`)
    .required(`${champ} requis`);

/**
 * Une ville.
 *
 * Le chiffre est toléré, l'absence de mot ne l'est pas : c'est le test qui
 * distingue « Lomé 2 » de « 1m89 ».
 */
export const villeRequise = yup
  .string()
  .trim()
  .min(2, "Min. 2 caractères")
  .max(60, "Max. 60 caractères")
  .test("a-des-lettres", "Indiquez un nom de ville", auMoinsTroisLettres)
  .required("Ville requise");

export const villeOptionnelle = yup
  .string()
  .trim()
  .max(60, "Max. 60 caractères")
  .test("a-des-lettres", "Indiquez un nom de ville", (v) => !v || auMoinsTroisLettres(v))
  .optional();

/**
 * Un numéro de téléphone, saisi à la main.
 *
 * On ne valide pas le PAYS ni l'opérateur : le produit sert plusieurs
 * indicatifs, et une liste blanche d'indicatifs se périme. On vérifie la
 * forme — un « + » facultatif, entre huit et quinze chiffres, et les
 * séparateurs qu'on écrit naturellement — ce qui suffit à écarter une adresse
 * ou une taille saisies dans la mauvaise case.
 */
export const telephoneOptionnel = yup
  .string()
  .trim()
  .test("forme-telephone", "Numéro invalide", (v) => {
    if (!v) return true;
    if (!/^\+?[\d\s.-]+$/.test(v)) return false;
    const chiffres = (v.match(/\d/g) ?? []).length;
    return chiffres >= 8 && chiffres <= 15;
  })
  .optional();
