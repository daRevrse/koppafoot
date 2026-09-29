// ============================================
// Les tutoriels, dans le produit.
//
// Six guides PDF existaient (joueur, manager, arbitre, organisateur, terrain,
// installation), de dix à soixante pages, soignés, captures à l'appui — et
// introuvables : ils dormaient dans docs/, sans un lien depuis l'application.
// Les nouveaux inscrits, eux, disaient ne pas savoir quoi faire.
//
// Chaque profil a donc ici sa FICHE : l'essentiel en quelques étapes, à lire
// sur un téléphone, chacune avec le bouton qui mène à l'écran dont elle parle.
// Et le PDF complet à télécharger, pour qui veut tout lire ou l'imprimer (voir
// scripts/tutoriels.mjs, qui les copie dans public/tutoriels).
//
// LES FICHES DES RÔLES SONT EN FRANÇAIS, comme les outils qu'elles décrivent :
// une fiche anglaise qui dirait de toucher « Créer mon équipe » décrirait un
// écran qui n'existe pas en anglais. Le spectateur et l'installation, qui
// concernent tout le monde, sont dans les deux langues.
// ============================================

import type { Langue } from "@/i18n/config";

export interface EtapeTutoriel {
  titre: string;
  texte: string;
  lien?: { href: string; label: string };
}

export interface Tutoriel {
  slug: string;
  /** Le PDF complet, sous public/ ; null quand il n'existe pas (encore). */
  pdf: string | null;
  titre: Record<Langue, string>;
  pourQui: Record<Langue, string>;
  /** Les étapes ; sans `en`, la fiche s'affiche en français dans les deux langues. */
  etapes: { fr: EtapeTutoriel[]; en?: EtapeTutoriel[] };
}

export const TUTORIELS: Tutoriel[] = [
  {
    slug: "spectateur",
    pdf: null,
    titre: { fr: "Suivre le football", en: "Follow football" },
    pourQui: {
      fr: "Tu viens de créer ton compte, ou tu suis tes équipes sans jouer.",
      en: "You've just signed up, or you follow teams without playing.",
    },
    etapes: {
      fr: [
        {
          titre: "Le Direct, c'est l'accueil",
          texte: "Tous les matchs du jour, en cours, terminés et à venir. Les flèches changent de jour ; l'étoile garde un match ou une compétition dans « Favoris ».",
          lien: { href: "/", label: "Ouvrir le Direct" },
        },
        {
          titre: "Suis une compétition",
          texte: "Sur la page d'une compétition, touche la cloche : ses buts et ses résultats t'arrivent en notification.",
          lien: { href: "/competitions", label: "Voir les compétitions" },
        },
        {
          titre: "Ouvre un match",
          texte: "Le fil minute par minute, les compositions, les statistiques et le classement de la poule. Tu peux aussi pronostiquer avant le coup d'envoi.",
        },
        {
          titre: "Installe l'application",
          texte: "Depuis ton navigateur, en deux minutes, sans passer par un store : KoppaFoot s'ouvre alors depuis ton écran d'accueil.",
          lien: { href: "/aide/tutoriels/installation", label: "Comment l'installer" },
        },
        {
          titre: "Active les notifications",
          texte: "Dans les paramètres, sur cet appareil. Tu choisis ce que tu reçois : ce que tu suis, le direct, les annonces.",
          lien: { href: "/parametres", label: "Ouvrir les paramètres" },
        },
        {
          titre: "Tu joues, tu diriges, tu arbitres ?",
          texte: "Choisis ton rôle : il ouvre ton espace (effectif, convocations, feuilles de match, désignations). Tu peux en changer quand tu veux.",
          lien: { href: "/roles#choisir", label: "Choisir mon rôle" },
        },
      ],
      en: [
        {
          titre: "Live is the home page",
          texte: "Every match of the day: live, finished and upcoming. The arrows change the day; the star keeps a match or a competition in “Favourites”.",
          lien: { href: "/", label: "Open Live" },
        },
        {
          titre: "Follow a competition",
          texte: "On a competition's page, tap the bell: its goals and results come to you as notifications.",
          lien: { href: "/competitions", label: "See competitions" },
        },
        {
          titre: "Open a match",
          texte: "Minute-by-minute feed, line-ups, stats and the group table. You can also predict the result before kick-off.",
        },
        {
          titre: "Install the app",
          texte: "From your browser, in two minutes, no store needed: KoppaFoot then opens from your home screen.",
          lien: { href: "/aide/tutoriels/installation", label: "How to install" },
        },
        {
          titre: "Turn on notifications",
          texte: "In settings, on this device. You choose what you get: what you follow, live matches, announcements.",
          lien: { href: "/parametres", label: "Open settings" },
        },
        {
          titre: "You play, run a team or referee?",
          texte: "Choose your role: it opens your space (squad, call-ups, team sheets, appointments). The tools of these spaces are in French for now.",
          lien: { href: "/roles#choisir", label: "Choose my role" },
        },
      ],
    },
  },
  {
    slug: "installation",
    pdf: "/tutoriels/installation.pdf",
    titre: { fr: "Installer l'application", en: "Install the app" },
    pourQui: {
      fr: "Pour ouvrir KoppaFoot d'un geste et recevoir les notifications.",
      en: "To open KoppaFoot in one tap and get notifications.",
    },
    etapes: {
      fr: [
        {
          titre: "Sur Android (Chrome)",
          texte: "Touche la carte « Installer KoppaFoot » quand elle apparaît, ou le menu ⋮ de Chrome → « Installer l'application ».",
        },
        {
          titre: "Sur iPhone (Safari)",
          texte: "Dans Safari, touche Partager (le carré avec une flèche) → « Sur l'écran d'accueil » → Ajouter. Sur iPhone, c'est la seule manière de recevoir les notifications.",
        },
        {
          titre: "Sur ordinateur (Chrome, Edge)",
          texte: "L'icône d'installation au bout de la barre d'adresse, ou la carte « Installer » dans l'application.",
        },
        {
          titre: "Active les notifications",
          texte: "Paramètres → Sur cet appareil → Oui, puis autorise quand le navigateur le demande.",
          lien: { href: "/parametres", label: "Ouvrir les paramètres" },
        },
      ],
      en: [
        {
          titre: "On Android (Chrome)",
          texte: "Tap the “Install KoppaFoot” card when it shows, or Chrome's ⋮ menu → “Install app”.",
        },
        {
          titre: "On iPhone (Safari)",
          texte: "In Safari, tap Share (the square with an arrow) → “Add to Home Screen” → Add. On iPhone, it's the only way to get notifications.",
        },
        {
          titre: "On a computer (Chrome, Edge)",
          texte: "The install icon at the end of the address bar, or the “Install” card in the app.",
        },
        {
          titre: "Turn on notifications",
          texte: "Settings → On this device → Yes, then allow when the browser asks.",
          lien: { href: "/parametres", label: "Open settings" },
        },
      ],
    },
  },
  {
    slug: "joueur",
    pdf: "/tutoriels/joueur.pdf",
    titre: { fr: "Joueur, joueuse", en: "Player" },
    pourQui: {
      fr: "Tu joues dans une équipe, ou tu veux en rejoindre une.",
      en: "You play for a team, or want to join one.",
    },
    etapes: {
      fr: [
        {
          titre: "Choisis le rôle de joueur",
          texte: "Poste, pied fort, ville : ton espace s'ouvre, et le menu « MySpace » (l'onglet Espace sur téléphone) mène à tes équipes, ton calendrier et tes statistiques.",
          lien: { href: "/roles#choisir", label: "Choisir mon rôle" },
        },
        {
          titre: "Complète ton profil",
          texte: "Photo, poste, niveau, quelques mots : c'est ta fiche publique, celle que les managers regardent avant de t'inviter.",
          lien: { href: "/profile", label: "Mon profil" },
        },
        {
          titre: "Rejoins une équipe",
          texte: "Au mercato, filtre les équipes par ville, niveau et catégorie, et envoie ta candidature. Une invitation reçue s'accepte au même endroit.",
          lien: { href: "/mercato", label: "Ouvrir le mercato" },
        },
        {
          titre: "Réponds à tes convocations",
          texte: "Ton manager te convoque pour chaque match : présent ou absent, d'un geste. Ton calendrier réunit matchs et entraînements.",
          lien: { href: "/participations", label: "Mes convocations" },
        },
        {
          titre: "Rattache-toi en compétition",
          texte: "Sur la page de ton équipe dans une compétition, touche « C'est moi » sur ta ligne : une fois validé, tes buts et tes notes remplissent tes statistiques.",
          lien: { href: "/competitions", label: "Trouver mon équipe" },
        },
        {
          titre: "Suis tes statistiques",
          texte: "Matchs, buts, passes, notes et état de forme, amicaux et compétitions réunis.",
          lien: { href: "/stats", label: "Mes statistiques" },
        },
      ],
    },
  },
  {
    slug: "manager",
    pdf: "/tutoriels/manager.pdf",
    titre: { fr: "Manager", en: "Manager" },
    pourQui: {
      fr: "Tu diriges une équipe et son effectif.",
      en: "You run a team and its squad.",
    },
    etapes: {
      fr: [
        {
          titre: "Crée ton équipe",
          texte: "Nom, ville, niveau, couleurs et catégorie (masculine, féminine, mixte). Écusson et bannière se changent ensuite depuis la fiche.",
          lien: { href: "/teams", label: "Mes équipes" },
        },
        {
          titre: "Recrute",
          texte: "Au mercato, filtre par ville, par niveau, joueurs ou joueuses, garde-les dans ta sélection, puis invite-les. Les candidatures arrivent au même endroit.",
          lien: { href: "/mercato", label: "Ouvrir le mercato" },
        },
        {
          titre: "Gère ton effectif",
          texte: "Dossards, joueurs sans compte (ceux sans smartphone), staff, composition type, créneaux d'entraînement : tout est sur la fiche de l'équipe.",
        },
        {
          titre: "Organise un amical",
          texte: "Défie une équipe de KoppaFoot, ou une équipe hors plateforme. Tes joueurs sont convoqués, tu remplis la feuille de match avant le coup d'envoi.",
          lien: { href: "/matches", label: "Matchs amicaux" },
        },
        {
          titre: "Après le match",
          texte: "Valide le résultat (l'autre manager aussi) : buts, passes et notes remplissent les fiches de tes joueurs.",
        },
        {
          titre: "Inscris-toi en compétition",
          texte: "Sur la page d'une compétition aux inscriptions ouvertes, « Inscrire mon équipe ». L'organisateur valide.",
          lien: { href: "/competitions", label: "Voir les compétitions" },
        },
      ],
    },
  },
  {
    slug: "arbitre",
    pdf: "/tutoriels/arbitre.pdf",
    titre: { fr: "Arbitre", en: "Referee" },
    pourQui: {
      fr: "Tu tiens le sifflet, seul ou avec ton équipe arbitrale.",
      en: "You referee, alone or with your officiating team.",
    },
    etapes: {
      fr: [
        {
          titre: "Choisis le rôle d'arbitre",
          texte: "Niveau et numéro de licence : c'est ce que les managers voient avant de te confier un match.",
          lien: { href: "/roles#choisir", label: "Choisir mon rôle" },
        },
        {
          titre: "Forme ton corps arbitral",
          texte: "Invite tes assistants et un scoreur. Pendant que tu diriges, c'est le scoreur qui tient la console du direct.",
          lien: { href: "/corps-arbitral", label: "Mon corps arbitral" },
        },
        {
          titre: "Trouve des matchs",
          texte: "Mes désignations réunit les invitations des managers et les matchs de ta ville qui cherchent encore un arbitre : porte-toi candidat.",
          lien: { href: "/designations", label: "Mes désignations" },
        },
        {
          titre: "Le jour du match",
          texte: "Les feuilles de match des deux équipes sont sur la fiche du match. La console reste à ta portée si ton scoreur fait défaut.",
        },
        {
          titre: "Après le match",
          texte: "Les managers te notent ; tes matchs et tes notes s'ajoutent à ta fiche publique.",
        },
      ],
    },
  },
  {
    slug: "organisateur",
    pdf: "/tutoriels/organisateur.pdf",
    titre: { fr: "Organisateur, organisatrice", en: "Organiser" },
    pourQui: {
      fr: "Tu organises un tournoi, une coupe ou un championnat.",
      en: "You run a tournament, a cup or a league.",
    },
    etapes: {
      fr: [
        {
          titre: "Dépose ta candidature",
          texte: "L'espace organisateur s'ouvre sur candidature : quelques lignes sur ta structure, l'équipe KoppaFoot répond vite.",
          lien: { href: "/organisateurs/candidature", label: "Candidater" },
        },
        {
          titre: "Crée la compétition",
          texte: "Nom, format (poules puis phase finale, coupe, championnat), dates, ville et catégorie.",
          lien: { href: "/organizer/competitions/new", label: "Nouvelle compétition" },
        },
        {
          titre: "Ajoute les équipes",
          texte: "À la main, par import depuis un tableur, ou laisse les managers s'inscrire une fois les inscriptions ouvertes.",
        },
        {
          titre: "Poules et calendrier",
          texte: "Compose les poules, génère le calendrier ou importe le tien, puis fixe dates et terrains.",
        },
        {
          titre: "Entoure-toi",
          texte: "Des modérateurs et des codes d'accès pour que d'autres tiennent la console le jour J.",
        },
        {
          titre: "Publie, et fais vivre le direct",
          texte: "Change le statut pour apparaître au Direct. Le jour du match, la console envoie buts et cartons aux abonnés en temps réel.",
          lien: { href: "/live-ops", label: "La console live" },
        },
      ],
    },
  },
  {
    slug: "terrain",
    pdf: "/tutoriels/terrain.pdf",
    titre: { fr: "Propriétaire de terrain", en: "Pitch owner" },
    pourQui: {
      fr: "Tu loues un terrain et veux recevoir les demandes des équipes.",
      en: "You rent out a pitch and want teams' booking requests.",
    },
    etapes: {
      fr: [
        {
          titre: "Référence ton terrain",
          texte: "Depuis la vitrine MyFields : nom, adresse, format, surface. KoppaFoot l'examine puis le publie dans l'annuaire.",
          lien: { href: "/terrains/candidature", label: "Référencer un terrain" },
        },
        {
          titre: "Complète la fiche",
          texte: "Photos, tarif, équipements, horaires d'ouverture et contact montré aux équipes.",
          lien: { href: "/mes-terrains", label: "Mes terrains" },
        },
        {
          titre: "Réponds aux demandes",
          texte: "Confirme, refuse en proposant un autre créneau, ou annule. Tant que tu n'as pas répondu, le créneau reste libre pour les autres.",
          lien: { href: "/mes-terrains/reservations", label: "Demandes reçues" },
        },
        {
          titre: "Bloque tes créneaux",
          texte: "Tes habitués chaque semaine, une fermeture pour travaux : les équipes ne voient que les créneaux libres.",
        },
      ],
    },
  },
  {
    slug: "scoreur",
    pdf: null,
    titre: { fr: "Scoreur, scoreuse", en: "Scorer" },
    pourQui: {
      fr: "Tu tiens la console d'un match pour ceux qui ne sont pas au bord du terrain.",
      en: "You run a match's live console for those not at the ground.",
    },
    etapes: {
      fr: [
        {
          titre: "Dépose ta candidature",
          texte: "La casquette de scoreur permet de couvrir les amicaux qui n'ont personne. Sur tes propres matchs, tu n'as besoin de rien.",
          lien: { href: "/scoreurs/candidature", label: "Candidater" },
        },
        {
          titre: "Entraîne-toi",
          texte: "La console a un bac à sable : un faux match pour prendre la main sans rien publier.",
          lien: { href: "/live-ops", label: "La console live" },
        },
        {
          titre: "Rejoins un corps arbitral",
          texte: "Un arbitre t'emmène sur ses matchs : tu tiens la console pendant qu'il dirige.",
          lien: { href: "/corps-arbitral", label: "Corps arbitral" },
        },
        {
          titre: "Le jour du match",
          texte: "Coup d'envoi, buts, cartons, remplacements : chaque geste part aux abonnés. Hors ligne, la console garde tout et l'envoie au retour du réseau.",
        },
      ],
    },
  },
];

export function tutoriel(slug: string): Tutoriel | null {
  return TUTORIELS.find((t) => t.slug === slug) ?? null;
}
