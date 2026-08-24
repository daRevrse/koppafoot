import type { CleTraduction } from "./fr";

// ============================================
// English.
//
// A partial dictionary on purpose: any key missing here falls back to the
// French sentence. Typed against the French keys, so a typo is a build error
// while an omission is simply an untranslated line.
//
// Amateur football vocabulary is not the same on both sides. "Manager" is
// kept as is, it is the word the product uses everywhere. "Casquette", the
// cumulative organiser / venue-owner function, becomes "hat", which is the
// same metaphor and reads naturally.
// ============================================

export const en: Partial<Record<CleTraduction, string>> = {
  // ---- Navigation ----
  "nav.direct": "Live",
  "nav.actus": "News",
  "nav.competitions": "Competitions",
  "nav.tribune": "The Stand",
  "nav.koppaLinks": "Koppa Links",
  "nav.myspace": "MySpace",
  "nav.recherche": "Competition, team, player…",
  "nav.espace": "Space",
  "nav.moi": "Me",
  "nav.compte": "Account",

  // ---- Spaces and hats ----
  "espace.mercato": "Transfers",
  "espace.mesReservations": "My bookings",
  "espace.competitionsOrganisees": "Competitions I run",
  "espace.consoleLive": "Live console",
  "espace.mesTerrains": "My pitches",
  "espace.reservationsRecues": "Booking requests",
  "espace.administration": "Administration",

  // ---- Account menu ----
  "compte.monCompte": "My account",
  "compte.compteEtReglages": "Account and settings",
  "compte.voirMonProfil": "View my profile",
  "compte.monProfil": "My profile",
  "compte.seConnecter": "Sign in",
  "compte.seDeconnecter": "Sign out",
  "compte.deconnexion": "Sign out",
  "compte.visiteur": "Visitor",
  "compte.aucunCompte": "No account on this device",
  "compte.faitesPlus": "Do more with KoppaFoot.",

  // ---- Invite ----
  "invite.titre": "Invite your friends",
  "invite.texte":
    "Football is better followed together. Share KoppaFoot with the people you play with.",
  "invite.partager": "Share the link",
  "invite.copie": "Link copied",
  "invite.message":
    "{prenom} invites you to follow live football on Koppafoot ⚽",
  "invite.messageAnonyme": "Follow live football on Koppafoot ⚽",

  // ---- Support and preferences ----
  "support.titre": "Support",
  "support.faq": "Frequently asked questions",
  "support.retour": "Send us feedback",
  "prefs.titre": "Preferences",
  "prefs.theme": "Theme",
  "prefs.clair": "Light",
  "prefs.sombre": "Dark",
  "prefs.langue": "Language",

  // ---- Push notifications ----
  "notifs.titre": "Notifications",
  "notifs.appareil": "On this device",
  "notifs.oui": "On",
  "notifs.non": "Off",
  "notifs.nonSupporte": "This browser does not support notifications.",
  "notifs.ios":
    "Add KoppaFoot to your home screen (Share, then “Add to Home Screen”) to receive notifications.",
  "notifs.refuse":
    "Blocked in your browser settings. Allow notifications for this site, then come back here.",
  "notifs.compte": "These choices apply to all your devices.",
  "notifs.cat.perso": "Addressed to me",
  "notifs.cat.equipe": "My teams",
  "notifs.cat.suivis": "What I follow",
  "notifs.cat.competitions": "Competition live",
  "notifs.cat.annonces": "KoppaFoot announcements",

  // ---- Help page ----
  "aide.fil": "Help",
  "aide.surtitre": "Support",
  "aide.titre": "Help",
  "aide.chapeau":
    "The questions that come up most often. If yours is not here, tell us at the bottom of the page.",
  "aide.faqTitre": "Frequently asked questions",
  "aide.retourTitre": "Send us feedback",
  "aide.retourTexte":
    "A bug, a wrong score, an idea: write it here. Feedback from the pitch is what decides what we build next.",
  "aide.retourPlaceholder": "What you saw, and what you expected…",
  "aide.envoyer": "Send",
  "aide.envoiTropCourt": "Tell us a little more",
  "aide.envoiEchoue": "Sending failed",
  "aide.merciTitre": "On its way",
  "aide.merciTexte":
    "Your message reached us. We do not always reply, but we read everything, and this is what decides what comes next.",
  "aide.autreRetour": "Write another message",

  "aide.q1": "What is a role, and what is a hat?",
  "aide.r1":
    "Your role says what you are on the pitch: player, manager or referee. You only have one, and you choose it in Evolution. Hats, competition organiser and pitch owner, are functions that stack on top: the same account can play, run a tournament and rent out its pitch.",
  "aide.q2": "How do I join a competition?",
  "aide.r2":
    "Competitions are joined as a team, not individually. Your team manager registers the team from the competition page, and the organiser then approves it. If you play without a team, go through Transfers to find one.",
  "aide.q3": "My statistics are out of date, why?",
  "aide.r3":
    "Goals and assists come from the match sheets filled in live by the competition scorers. They appear as soon as the match is marked finished. If a match ended long ago and nothing moves, the sheet has probably not been closed: tell the organiser.",
  "aide.q4": "How do I list my pitch?",
  "aide.r4":
    "From the MyFields page, by applying. You keep your player or manager role: listing a pitch adds a hat, it replaces nothing. Once approved, slot requests arrive under « Booking requests ».",
  "aide.q5": "Why do international competitions show nothing?",
  "aide.r5":
    "They come from an outside service, football-data.org, polled every few minutes. An empty window means no match is scheduled in the days shown, or the service is not answering. Local competitions depend on no one.",
  "aide.q6": "Can I delete my account?",
  "aide.r6":
    "Yes, from your profile, at the very bottom of the page. Deleting removes your profile, your posts and your booking requests. Match sheets already played keep the record of your goals: they belong to the history of the competition, not only to you. If you manage a team, run a competition or own a pitch, you must hand it over first: leaving would strand a team without a manager, or a pitch with nobody to answer.",

  // ---- Account deletion ----
  "suppr.zone": "Danger zone",
  "suppr.titre": "Delete my account",
  "suppr.texte":
    "Your profile, your photos, your posts and your booking requests disappear. Goals and assists already recorded on match sheets stay: they belong to the history of the competitions you played in, not only to you. This cannot be undone.",
  "suppr.tapez": "Type {mot} to confirm",
  "suppr.definitivement": "Delete permanently",
  "suppr.annuler": "Cancel",
  "suppr.aFaire": "To do before you go",
  "suppr.reconnexion":
    "For security, a recent sign-in is required to delete an account. Sign out, sign back in, then come back here.",
  "suppr.faite": "Your account has been deleted",
  "suppr.echouee": "Deletion failed",
};
