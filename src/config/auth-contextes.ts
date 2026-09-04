// ============================================
// D'où vient-on, et que lui promet-on.
//
// UNE SEULE MÉCANIQUE D'AUTHENTIFICATION, PLUSIEURS VISAGES. La tentation,
// quand une section veut sa propre page de connexion, est de lui en écrire
// une : /myfields/login à côté de /login. Ce serait dupliquer Google, le
// formulaire email, reCAPTCHA, la redirection `?next=`, la création de profil
// — c'est-à-dire refabriquer, dans le seul écran où une divergence se paie en
// comptes perdus, exactement le doublon qu'on vient de retirer du parcours
// des terrains.
//
// Ce fichier fait donc l'inverse : la mécanique reste unique, et c'est
// l'HABILLAGE qui change. `?for=terrain` ouvre une page de connexion qui
// parle de terrains, porte la marque MyFields et ramène à sa vitrine. Le
// visiteur voit une porte différente ; le produit n'entretient qu'une serrure.
//
// `?next=` ramène ensuite à l'endroit exact d'où l'on venait, et le contexte
// se transmet de /login à /signup pour que la traversée reste d'un bloc.
// ============================================

export interface ContexteAuth {
  /** Le nom de la section, en surtitre. */
  marque: string;
  /** Ce que la section promet, en très gros, sur le panneau sombre. */
  accroche: string;
  /** Une phrase, sous l'accroche. */
  promesse: string;
  /** Le titre au-dessus du formulaire de CONNEXION. */
  titreConnexion: string;
  phraseConnexion: string;
  /** Le titre au-dessus du formulaire d'INSCRIPTION. */
  titreInscription: string;
  phraseInscription: string;
  /** La vitrine de la section, pour repartir sans perdre le fil. */
  retour: { href: string; label: string } | null;
}

export const CONTEXTES_AUTH: Record<string, ContexteAuth> = {
  terrain: {
    marque: "MyFields",
    accroche: "Sans pelouse, pas de match",
    promesse:
      "Référencez votre terrain, recevez les demandes de créneau des équipes, et répondez-y. La plateforme n'encaisse rien : le règlement reste entre vous.",
    titreConnexion: "Référencer un terrain",
    phraseConnexion: "Un compte d'abord, la fiche de ton terrain se saisit ensuite.",
    titreInscription: "Référencer un terrain",
    phraseInscription: "Crée ton compte : la fiche du terrain viendra juste après.",
    retour: { href: "/terrains", label: "MyFields" },
  },

  // Demander un créneau, par opposition à en louer un. Même section, autre
  // bout : celui qui cherche où jouer n'a pas à lire une promesse de
  // propriétaire au moment de créer son compte.
  creneau: {
    marque: "MyFields",
    accroche: "Trouvez où jouer",
    promesse:
      "Choisissez un terrain, demandez une date et une heure. Le propriétaire confirme ou refuse, et vous suivez sa réponse dans votre espace.",
    titreConnexion: "Demander un créneau",
    phraseConnexion: "Le propriétaire doit savoir à qui il confie son terrain.",
    titreInscription: "Demander un créneau",
    phraseInscription: "Un compte, et vous pouvez réserver sur n'importe quel terrain référencé.",
    retour: { href: "/terrains/annuaire", label: "Où jouer" },
  },

  organisateur: {
    marque: "Koppafoot Organize",
    accroche: "Votre compétition, tenue",
    promesse:
      "Calendrier, classements, tableau final et diffusion en direct. Un compte d'abord, la candidature d'organisateur se dépose ensuite.",
    titreConnexion: "Organiser une compétition",
    phraseConnexion: "Un compte d'abord, ta candidature d'organisateur se dépose ensuite.",
    titreInscription: "Organiser une compétition",
    phraseInscription: "Crée ton compte, la candidature se dépose juste après.",
    retour: { href: "/organisateurs", label: "Koppafoot Organize" },
  },

  scoreur: {
    marque: "Koppafoot Score",
    accroche: "Faites vivre le direct",
    promesse:
      "Tenez la console d'un match et faites-le vivre pour ceux qui ne sont pas au bord du terrain.",
    titreConnexion: "Tenir la console",
    phraseConnexion: "Un compte d'abord, ta candidature de scoreur se dépose ensuite.",
    titreInscription: "Tenir la console",
    phraseInscription: "Crée ton compte, la candidature se dépose juste après.",
    retour: { href: "/scoreurs", label: "Koppafoot Score" },
  },
};

export const CONTEXTE_AUTH_DEFAUT: ContexteAuth = {
  marque: "Koppafoot",
  accroche: "Le football d'ici, en direct",
  promesse:
    "Les compétitions, les équipes et les matchs de votre ville, suivis minute par minute.",
  titreConnexion: "Connexion",
  phraseConnexion: "Connecte-toi pour accéder à ton espace.",
  titreInscription: "Créer un compte",
  phraseInscription: "Suis tes compétitions en direct et rejoins la communauté.",
  retour: null,
};

export function contexteAuth(cle: string | null | undefined): ContexteAuth {
  return (cle && CONTEXTES_AUTH[cle]) || CONTEXTE_AUTH_DEFAUT;
}

/**
 * Le contexte se transmet d'un écran d'authentification à l'autre.
 *
 * Sans ça, « Pas encore de compte ? Créer un compte » faisait passer d'une
 * page qui parle de terrains à une page qui parle de tout : le visiteur
 * arrivé par « référencer mon terrain » perdait le fil au milieu du geste, et
 * `?next=` avec lui.
 */
export function lienAuth(base: string, params: URLSearchParams): string {
  const garde = new URLSearchParams();
  const four = params.get("for");
  const next = params.get("next");
  if (four) garde.set("for", four);
  // `next` n'est suivi que s'il reste sur le site : une adresse absolue ferait
  // de la connexion un tremplin vers l'extérieur.
  if (next && next.startsWith("/") && !next.startsWith("//")) garde.set("next", next);
  const q = garde.toString();
  return q ? `${base}?${q}` : base;
}
