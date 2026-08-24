// ============================================
// Le français, qui sert aussi de référence.
//
// Ce fichier n'est pas « la traduction française » : c'est la liste des
// phrases traduisibles du produit, écrites dans la langue d'origine. Les
// autres langues en sont des sous-ensembles, et toute clé qu'elles ne
// couvrent pas retombe ici.
//
// Pourquoi un repli plutôt qu'une obligation de tout traduire : exiger
// l'anglais complet avant de pouvoir livrer quoi que ce soit revient à ne
// jamais livrer. Une phrase manquante s'affiche en français, ce qui est
// lisible, tandis qu'une clé brute affichée à l'écran ne l'est pas.
//
// Les clés se lisent comme un chemin, `nav.direct`, `compte.deconnexion`.
// Regrouper par endroit plutôt que par thème permet de traduire un écran
// entier sans chercher ses phrases dans tout le fichier.
// ============================================

export const fr = {
  // ---- Barre de navigation ----
  "nav.direct": "Direct",
  "nav.actus": "Actus",
  "nav.competitions": "Compétitions",
  "nav.tribune": "La Tribune",
  "nav.koppaLinks": "Koppa Links",
  "nav.myspace": "MySpace",
  "nav.recherche": "Compétition, équipe, joueur…",
  "nav.espace": "Espace",
  "nav.moi": "Moi",
  "nav.compte": "Compte",

  // ---- Espaces et casquettes ----
  "espace.mercato": "Mercato",
  "espace.mesReservations": "Mes réservations",
  "espace.competitionsOrganisees": "Compétitions organisées",
  "espace.consoleLive": "Console live",
  "espace.mesTerrains": "Mes terrains",
  "espace.reservationsRecues": "Réservations reçues",
  "espace.administration": "Administration",

  // ---- Menu du compte ----
  "compte.monCompte": "Mon compte",
  "compte.compteEtReglages": "Compte et réglages",
  "compte.voirMonProfil": "Voir mon profil",
  "compte.monProfil": "Mon profil",
  "compte.seConnecter": "Se connecter",
  "compte.seDeconnecter": "Se déconnecter",
  "compte.deconnexion": "Déconnexion",
  "compte.visiteur": "Visiteur",
  "compte.aucunCompte": "Aucun compte sur cet appareil",
  "compte.faitesPlus": "Faites en plus avec KoppaFoot.",

  // ---- Invitation ----
  "invite.titre": "Invite tes amis",
  "invite.texte":
    "Le foot se suit à plusieurs. Partage KoppaFoot à ceux qui jouent avec toi.",
  "invite.partager": "Partager le lien",
  "invite.copie": "Lien copié",
  "invite.message":
    "{prenom} t'invite à suivre les compétitions de football en direct sur Koppafoot ⚽",
  "invite.messageAnonyme":
    "Suis les compétitions de football en direct sur Koppafoot ⚽",

  // ---- Support et préférences ----
  "support.titre": "Support",
  "support.faq": "Questions fréquentes",
  "support.retour": "Nous faire un retour",
  "prefs.titre": "Préférences",
  "prefs.theme": "Thème",
  "prefs.clair": "Clair",
  "prefs.sombre": "Sombre",
  "prefs.langue": "Langue",

  // ---- Notifications push ----
  "notifs.titre": "Notifications",
  "notifs.appareil": "Sur cet appareil",
  "notifs.oui": "Oui",
  "notifs.non": "Non",
  "notifs.nonSupporte": "Ce navigateur ne gère pas les notifications.",
  "notifs.ios":
    "Ajoutez KoppaFoot à votre écran d'accueil (Partager, puis « Sur l'écran d'accueil ») pour recevoir les notifications.",
  "notifs.refuse":
    "Bloquées dans les réglages du navigateur. Autorisez les notifications pour ce site, puis revenez ici.",
  "notifs.compte": "Ces choix valent pour tous vos appareils.",
  "notifs.cat.perso": "Ce qui m'est adressé",
  "notifs.cat.equipe": "Ma ou mes équipes",
  "notifs.cat.suivis": "Ce que je suis",
  "notifs.cat.competitions": "Direct des compétitions",
  "notifs.cat.annonces": "Annonces KoppaFoot",

  // ---- Page d'aide ----
  "aide.fil": "Aide",
  "aide.surtitre": "Support",
  "aide.titre": "Aide",
  "aide.chapeau":
    "Les questions qui reviennent le plus souvent. Si la vôtre n'y est pas, dites-la nous en bas de page.",
  "aide.faqTitre": "Questions fréquentes",
  "aide.retourTitre": "Nous faire un retour",
  "aide.retourTexte":
    "Un bug, un score faux, une idée : écrivez-le ici. Ce sont les retours du terrain qui décident de ce qu'on construit ensuite.",
  "aide.retourPlaceholder": "Ce que vous avez vu, et ce que vous attendiez…",
  "aide.envoyer": "Envoyer",
  "aide.envoiTropCourt": "Dites-nous un peu plus",
  "aide.envoiEchoue": "L'envoi a échoué",
  "aide.merciTitre": "C'est parti",
  "aide.merciTexte":
    "Votre message est arrivé. On ne répond pas toujours, mais on lit tout, et ce sont ces retours qui décident de la suite.",
  "aide.autreRetour": "Écrire un autre retour",

  "aide.q1": "Qu'est-ce qu'un rôle, et qu'est-ce qu'une casquette ?",
  "aide.r1":
    "Le rôle dit ce que vous êtes sur le terrain : joueur, manager ou arbitre. Vous n'en avez qu'un, il se choisit dans Évolution. Les casquettes, organisateur de compétition et propriétaire de terrain, sont des fonctions qui s'ajoutent par-dessus : le même compte peut jouer, organiser un tournoi et louer son terrain.",
  "aide.q2": "Comment rejoindre une compétition ?",
  "aide.r2":
    "Une compétition se rejoint par équipe, pas individuellement. Le manager de votre équipe inscrit celle-ci depuis la page de la compétition, l'organisateur valide ensuite l'inscription. Si vous jouez sans équipe, passez par le Mercato pour en trouver une.",
  "aide.q3": "Mes statistiques ne sont pas à jour, pourquoi ?",
  "aide.r3":
    "Les buts et passes viennent des feuilles de match saisies en direct par les scoreurs de la compétition. Elles apparaissent dès que le match est marqué terminé. Si un match est fini depuis longtemps et que rien ne bouge, la feuille n'a probablement pas été clôturée : signalez-le à l'organisateur.",
  "aide.q4": "Comment référencer mon terrain ?",
  "aide.r4":
    "Depuis la page MyFields, en déposant une candidature. Vous gardez votre rôle de joueur ou de manager : référencer un terrain ajoute une casquette, cela ne remplace rien. Une fois validé, les demandes de créneau arrivent dans « Réservations reçues ».",
  "aide.q5": "Pourquoi les compétitions internationales n'affichent-elles rien ?",
  "aide.r5":
    "Elles proviennent d'un service extérieur, football-data.org, interrogé toutes les quelques minutes. Une fenêtre vide veut dire qu'aucun match n'est programmé dans les jours affichés, ou que le service ne répond pas. Les compétitions locales, elles, ne dépendent de personne.",
  "aide.q6": "Puis-je supprimer mon compte ?",
  "aide.r6":
    "Oui, depuis votre profil, tout en bas de la page. La suppression retire votre fiche, vos publications et vos demandes de réservation. Les feuilles de match déjà jouées gardent la trace des buts : ils appartiennent à l'histoire de la compétition, pas seulement à vous. Si vous gérez une équipe, organisez une compétition ou possédez un terrain, il faut d'abord passer la main : partir laisserait une équipe sans manager ou un terrain sans personne pour répondre.",

  // ---- Suppression de compte ----
  "suppr.zone": "Zone sensible",
  "suppr.titre": "Supprimer mon compte",
  "suppr.texte":
    "Votre fiche, vos photos, vos publications et vos demandes de réservation disparaissent. Les buts et passes déjà inscrits sur des feuilles de match restent : ils appartiennent à l'histoire des compétitions où vous avez joué, pas seulement à vous. Cette action est définitive.",
  "suppr.tapez": "Tapez {mot} pour confirmer",
  "suppr.definitivement": "Supprimer définitivement",
  "suppr.annuler": "Annuler",
  "suppr.aFaire": "À faire avant de partir",
  "suppr.reconnexion":
    "Par sécurité, une connexion récente est demandée pour supprimer un compte. Déconnectez-vous, reconnectez-vous, puis revenez ici.",
  "suppr.faite": "Votre compte a été supprimé",
  "suppr.echouee": "La suppression a échoué",
} as const;

export type CleTraduction = keyof typeof fr;
