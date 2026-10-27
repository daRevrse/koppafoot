// Pourquoi on demande un compte : la phrase de l'écran de connexion ou
// d'inscription quand on y arrive depuis un geste qui en demande un.

const PHRASES: Record<string, string> = {
  suivre: "Crée un compte pour suivre cette compétition.",
  pronostic: "Crée ton compte pour donner ton pronostic.",
  tchat: "Connecte-toi pour écrire dans le tchat du match.",
  role: "Crée ton compte pour choisir ton rôle : joueur, manager ou arbitre.",
  casquette: "Crée ton compte pour demander une casquette : organisateur, scoreur ou propriétaire de terrain.",
};

/** La phrase d'une raison connue ; sinon celle de l'écran par défaut. */
export function phraseDeRaison(raison: string | undefined, parDefaut: string): string {
  return raison && Object.hasOwn(PHRASES, raison) ? PHRASES[raison] : parDefaut;
}
