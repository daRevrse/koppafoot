// Le décor de la vidéo : les personnes et les clubs inventés de la vidéo manager.
// Ekoué Bawa, attaquant sans compte de l'Avenir d'Adakpamé, est le héros.

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

/** Les deux managers de la vidéo. */
export const EDEM = { prenom: "Edem", nom: "Amouzou", email: "edem.amouzou@example.com", mdp: "Equipe2026!", equipe: "Avenir d'Adakpamé" };
export const KOKOU = { prenom: "Kokou", nom: "Tepe", email: "kokou.tepe@example.com", mdp: "Equipe2026!", equipe: "Olympique de Tokoin" };

/** Le héros : sans compte au départ, il crée le sien à l'écran (mot de passe des joueurs). */
export const EKOUE = { prenom: "Ekoué", nom: "Bawa", email: "ekoue.bawa@example.com", mdp: "Joueur2026!", numero: "11" };

// LES DATES SE CALCULENT DEPUIS LE JOUR DU TOURNAGE (Lomé vit à l'heure UTC) :
// le match d'avant tombe le dimanche de la semaine passée, le match filmé en
// direct aujourd'hui. Le joueur de la semaine est celui de la semaine en
// cours, publié le jour même : sa diapositive tient jusqu'à dimanche.
const JOUR_MS = 86_400_000;
const enJour = (t) => new Date(t).toISOString().slice(0, 10);
export const AUJOURDHUI = enJour(Date.now());
const lundi = Date.parse(`${AUJOURDHUI}T12:00:00Z`) - ((new Date(`${AUJOURDHUI}T12:00:00Z`).getUTCDay() + 6) % 7) * JOUR_MS;
/** Le lundi de la semaine en cours : la semaine du joueur de la semaine. */
export const LUNDI = enJour(lundi);
/** Le dimanche qui précède : le jour du premier match, celui d'avant le compte. */
export const DIMANCHE_DERNIER = enJour(lundi - JOUR_MS);

/** Le dimanche qui vient : l'amical où Ekoué est convoqué. */
const aujourdhui = Date.parse(`${AUJOURDHUI}T12:00:00Z`);
const auDimanche = (7 - new Date(aujourdhui).getUTCDay()) % 7 || 7;
export const PROCHAIN_DIMANCHE = enJour(aujourdhui + auDimanche * JOUR_MS);
/** La veille : la séance d'entraînement (jamais avant aujourd'hui). */
export const ENTRAINEMENT = {
  titre: "Mise en place avant dimanche",
  date: enJour(Math.max(aujourdhui, aujourdhui + (auDimanche - 1) * JOUR_MS)),
  heure: "16:00",
  lieu: "Terrain d'Adakpamé",
};
/** L'amical du dimanche qui vient, contre une équipe hors plateforme. */
export const AMICAL = { adversaire: "Étoile de Hédzranawoé", date: PROCHAIN_DIMANCHE, time: "09:00", lieu: "Terrain d'Adakpamé", ville: "Lomé" };

/** Le premier match : joué en coulisses, il porte déjà les buts d'Ekoué. */
export const MATCH1 = { date: DIMANCHE_DERNIER, time: "09:00", lieu: "Terrain d'Adakpamé", ville: "Lomé" };
/** Le second, suivi en direct : il se joue le jour du tournage. */
export const MATCH2 = { date: AUJOURDHUI, time: "16:00", lieu: "Terrain d'Adakpamé", ville: "Lomé" };

/** Les onze de départ d'Avenir d'Adakpamé. */
export const TITULAIRES = ["Dodzi Ahadji", "Enyonam Kpodar", "Yao Lawson", "Messan Klutse", "Koffi Dossou",
  "Selom Adjo", "Fiifi Attiogbé", "Atsu Sodji", "Kodjo Amégan", "Kafui Mensah", "Ekoué Bawa"];
