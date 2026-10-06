// Le montage des plans réels : quel morceau de quel plan, à quel moment de la
// vidéo, et ce qu'on fait de son son. Lu par preparer-plans.mjs (extraction),
// rendu.mjs (via source/plans/plans.js) et mixage.mjs (le son).
//
// Les deux plans d'origine, filmés au bord du terrain (iPhone, 1214 × 2158,
// 60 i/s), ne sont pas dans le dépôt : ils portent la position GPS du
// tournage. Seuls les morceaux retenus y sont, sans métadonnées
// (source/plans/*.mp4).
//
//   but    « plan qui finit sur un but de Gilles »   27,2 s
//   faute  « plan qui finit sur une faute sifflée »  20,5 s
//
// t : début dans la vidéo (s) · de, a : morceau du plan d'origine (s)
// vitesse : 0,5 = ralenti · son : "plein", "lointain" (étouffé, bas), "aucun"

export const PLANS = [
  // Ouverture : « Ton équipe joue. »
  { id: "p1", plan: "faute", de: 4.0, a: 5.4, t: 0, son: "plein" },
  { id: "p2", plan: "but", de: 5.5, a: 7.6, t: 1.4, son: "plein" },
  // « Mais tu n'es pas au stade » : l'image se floute, le son s'éloigne,
  // et le groupe de discussion s'agite par-dessus.
  { id: "p3", plan: "but", de: 13.0, a: 21.6, t: 3.5, son: "lointain", depuis: 3.6 },
  // La réponse au groupe, sur fond flou.
  { id: "p4", plan: "faute", de: 5.6, a: 10.0, t: 34.2, son: "lointain" },
  // « Le foot amateur mérite aussi d'être suivi » : le but de Gilles.
  { id: "p5", plan: "but", de: 20.6, a: 25.2, t: 38.6, son: "plein" },
  // La fin, au ralenti, sous la joie de l'équipe.
  { id: "p6", plan: "but", de: 25.2, a: 27.2, t: 43.2, vitesse: 0.5, son: "plein" },
];

/**
 * Du son seul, sans l'image : le coup de sifflet qui fait passer au noir, et
 * le match qui continue au loin pendant les scènes de téléphone (sans lui, un
 * silence complet, qui sonne comme une panne). `fondu` : entrée et sortie (s).
 */
export const SONS_DE_PLAN = [
  { plan: "faute", de: 19.1, a: 20.4, t: 11.85, son: "plein", gain: 0.75, fondu: 0.1 },
  { plan: "but", de: 0.2, a: 13.0, t: 15.2, son: "lointain", gain: 0.7, fondu: 0.8 },
  { plan: "faute", de: 10.0, a: 16.6, t: 27.8, son: "lointain", gain: 0.7, fondu: 0.8 },
  // Sous la fin : la joie de l'équipe passée, le match continue, doucement.
  { plan: "faute", de: 15.0, a: 18.4, t: 44.9, son: "plein", gain: 0.35, fondu: 1.0 },
];

export const DUREE = 48;
