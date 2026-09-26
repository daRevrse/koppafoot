// Le décor du tutoriel : des personnes et des clubs inventés.

/** Joueurs inscrits sur KoppaFoot (mot de passe commun : Joueur2026!). */
export const JOUEURS = [
  { first: "Kafui", last: "Mensah", email: "kafui.mensah@example.com", position: "forward", skill: "intermediate", bio: "Attaquant rapide, 24 ans. Je cherche une équipe pour jouer le dimanche." },
  { first: "Selom", last: "Adjo", email: "selom.adjo@example.com", position: "midfielder", skill: "amateur", bio: "Milieu de terrain, bon passeur." },
  { first: "Dodzi", last: "Ahadji", email: "dodzi.ahadji@example.com", position: "goalkeeper", skill: "intermediate", bio: "Gardien, 8 ans de football de quartier." },
  { first: "Enyonam", last: "Kpodar", email: "enyonam.kpodar@example.com", position: "defender", skill: "amateur", bio: "Défenseur central, disponible le week-end." },
  { first: "Mawuli", last: "Ayivi", email: "mawuli.ayivi@example.com", position: "forward", skill: "beginner", bio: "Je débute, motivé !" },
  { first: "Etse", last: "Gbeassor", email: "etse.gbeassor@example.com", position: "midfielder", skill: "advanced", bio: "Ancien joueur de D2, milieu relayeur." },
];

/** Les dossards des joueurs avec compte d'Avenir d'Adakpamé. */
export const DOSSARDS = { "Dodzi Ahadji": "1", "Selom Adjo": "7", "Kafui Mensah": "9", "Enyonam Kpodar": "14" };

/** Joueurs sans compte d'Avenir d'Adakpamé (Komlan Tepe est ajouté à la main dans le tutoriel). */
export const SANS_COMPTE = [
  ["Yao", "Lawson", "defender", 2], ["Koffi", "Dossou", "defender", 3], ["Messan", "Klutse", "defender", 4],
  ["Atsu", "Sodji", "midfielder", 6], ["Kodjo", "Amégan", "midfielder", 8], ["Fiifi", "Attiogbé", "midfielder", 10],
  ["Ekoué", "Bawa", "forward", 11], ["Folly", "Akue", "forward", 12], ["Mawuena", "Doe", "goalkeeper", 16],
];

/** L'effectif de l'Olympique de Tokoin, l'adversaire (tous sans compte). */
export const TOKOIN = [
  ["Kwami", "Agbeko", "goalkeeper", 1], ["Sena", "Ahiabor", "defender", 2], ["Elom", "Dogbe", "defender", 3],
  ["Kossivi", "Amegah", "defender", 4], ["Yawo", "Tsogbe", "defender", 5], ["Afi", "Kouma", "midfielder", 6],
  ["Edoh", "Kpeglo", "midfielder", 7], ["Kodjovi", "Agbo", "midfielder", 8], ["Tchao", "Assiongbon", "forward", 9],
  ["Mensah", "Lawani", "midfielder", 10], ["Ayité", "Gamli", "forward", 11], ["Dela", "Fiagan", "forward", 14],
];
