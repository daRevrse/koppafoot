// Les personnes, les clubs et les dates du film : tous inventés.
// Les mêmes personnes que les guides et les autres vidéos du dossier docs/.

/** Le manager de l'Avenir d'Adakpamé, fil rouge du film. */
export const EDEM = { prenom: "Edem", nom: "Amouzou", email: "edem.amouzou@example.com", mdp: "Equipe2026!", equipe: "Avenir d'Adakpamé" };
/** Le manager de l'adversaire du samedi. */
export const KOKOU = { prenom: "Kokou", nom: "Tepe", email: "kokou.tepe@example.com", mdp: "Equipe2026!", equipe: "Olympique de Tokoin" };

/** Joueurs inscrits sur KoppaFoot (mot de passe commun : Joueur2026!). */
export const JOUEURS = [
  { first: "Kafui", last: "Mensah", email: "kafui.mensah@example.com", position: "forward", skill: "intermediate", bio: "Attaquant, 24 ans. Le dimanche, c'est foot." },
  { first: "Selom", last: "Adjo", email: "selom.adjo@example.com", position: "midfielder", skill: "amateur", bio: "Milieu de terrain, bon passeur." },
  { first: "Enyonam", last: "Kpodar", email: "enyonam.kpodar@example.com", position: "defender", skill: "amateur", bio: "Défenseur central, disponible le week-end." },
  { first: "Etse", last: "Gbeassor", email: "etse.gbeassor@example.com", position: "midfielder", skill: "advanced", bio: "Ancien joueur de D2, milieu relayeur." },
  { first: "Mawuli", last: "Ayivi", email: "mawuli.ayivi@example.com", position: "forward", skill: "beginner", bio: "Je débute, motivé !" },
  { first: "Fafa", last: "Kodjo", email: "fafa.kodjo@example.com", position: "defender", skill: "intermediate", bio: "Latéral gauche, rapide." },
];
/** Ceux qu'Edem invite au mercato. */
export const RECRUES = ["Kafui Mensah", "Selom Adjo", "Enyonam Kpodar", "Etse Gbeassor"];
/** Le gardien qui demande à rejoindre l'équipe, depuis l'annonce de la Tribune. */
export const GARDIEN = { first: "Dodzi", last: "Ahadji", email: "dodzi.ahadji@example.com", position: "goalkeeper", skill: "intermediate", bio: "Gardien, 8 ans de football de quartier." };

/** Joueurs sans compte de l'Avenir d'Adakpamé : [prénom, nom, poste, dossard]. */
export const SANS_COMPTE = [
  ["Yao", "Lawson", "defender", 2], ["Koffi", "Dossou", "defender", 3], ["Messan", "Klutse", "defender", 4],
  ["Atsu", "Sodji", "midfielder", 6], ["Kodjo", "Amégan", "midfielder", 8], ["Fiifi", "Attiogbé", "midfielder", 10],
  ["Ekoué", "Bawa", "forward", 11], ["Folly", "Akue", "forward", 12], ["Mawuena", "Doe", "goalkeeper", 16],
];
/** Le blessé de la semaine : la composition le montre sur le banc. */
export const BLESSE = "Ekoué Bawa";

/** Les onze de départ de l'Avenir d'Adakpamé. */
export const TITULAIRES = ["Dodzi Ahadji", "Enyonam Kpodar", "Yao Lawson", "Messan Klutse", "Koffi Dossou",
  "Selom Adjo", "Etse Gbeassor", "Atsu Sodji", "Kodjo Amégan", "Kafui Mensah", "Fiifi Attiogbé"];

/** L'effectif de l'Olympique de Tokoin (tous sans compte). */
export const TOKOIN = [
  ["Kwami", "Agbeko", "goalkeeper", 1], ["Sena", "Ahiabor", "defender", 2], ["Elom", "Dogbe", "defender", 3],
  ["Kossivi", "Amegah", "defender", 4], ["Yawo", "Tsogbe", "defender", 5], ["Afi", "Kouma", "midfielder", 6],
  ["Edoh", "Kpeglo", "midfielder", 7], ["Kodjovi", "Agbo", "midfielder", 8], ["Tchao", "Assiongbon", "forward", 9],
  ["Mensah", "Lawani", "midfielder", 10], ["Ayité", "Gamli", "forward", 11], ["Dela", "Fiagan", "forward", 14],
];

/** L'arbitre, son corps arbitral, et la scoreuse qui tient la console. */
export const ARBITRE = { prenom: "Komi", nom: "Adjovi", email: "komi.adjovi@example.com", mdp: "Arbitre2026!" };
export const CORPS = "Les Sifflets du Golfe";
export const SCOREUSE = { prenom: "Afi", nom: "Lawson", email: "afi.lawson@example.com", mdp: "Scoreur2026!" };

/** Le supporter qui suit le match sans être au stade. */
export const SUPPORTER = { prenom: "Elikem", nom: "Agbodjan", email: "elikem.agbodjan@example.com", mdp: "Supporter2026!" };

/** Le gérant du terrain du samedi. */
export const GERANT = { prenom: "Yawo", nom: "Agbeko", email: "yawo.agbeko@example.com", mdp: "Terrain2026!" };
export const TERRAIN = { nom: "Complexe sportif de Bè", ville: "Lomé", adresse: "Rue du Lac, Bè Kpota", telephone: "90 12 34 56" };

/** L'organisateur de la Coupe des Quartiers. */
export const ORGANISATEUR = { prenom: "Kossi", nom: "Mensah", email: "kossi.mensah@example.com", mdp: "Coupe2026!" };

/** Le match du samedi. */
export const MATCH = { date: "2026-10-17", time: "16:00" };

/** Le championnat qui se joue déjà : il remplit le Direct du vendredi soir. */
export const LIGUE = {
  nom: "Championnat de Lomé-Est 2026", slug: "championnat-lome-est-2026",
  equipes: [
    ["Étoile de Bè", "ETB", "#dc2626"], ["Racing Hédzranawoé", "RHE", "#0891b2"],
    ["Union de Nyékonakpoè", "UNY", "#7c3aed"], ["Jeunesse de Kégué", "JKE", "#16a34a"],
    ["Espoir d'Agoè", "EAG", "#f59e0b"], ["Lions de Baguida", "LBA", "#ea580c"],
  ],
};

/** La Coupe des Quartiers : sept clubs déjà engagés, l'Avenir s'y inscrit à l'écran. */
export const COUPE = {
  nom: "Coupe des Quartiers 2026", slug: "coupe-des-quartiers-2026",
  equipes: [
    ["AS Bè", "ASB", "#dc2626"], ["FC Tokoin", "FCT", "#2563eb"], ["Étoile d'Adidogomé", "EDA", "#f59e0b"],
    ["Racing Agoè", "RAG", "#16a34a"], ["Espoir Nyékonakpoè", "ENY", "#7c3aed"],
    ["Jeunesse Hédzranawoé", "JHE", "#0891b2"], ["Union Kodjoviakopé", "UKO", "#111827"],
  ],
};

const PRENOMS = ["Kossi", "Komlan", "Yao", "Koffi", "Ayité", "Délali", "Sena", "Elom", "Kodjo", "Akakpo", "Folly", "Ekoué", "Kwami", "Mawuli", "Selom", "Messan", "Enyonam", "Yawo", "Atsu", "Mawuena", "Dela", "Etse", "Fiifi", "Nutifafa"];
const NOMS = ["Adjévi", "Kao", "Amégan", "Adoboli", "Gansou", "Johnson", "Akpaki", "Kpodzro", "Attiogbé", "Doe", "Hounkpati", "Agbodjan", "Kponton", "Sodji", "Klutse", "Akue", "Tsogbe", "Dzidzonu", "Fiagbe", "Nyaku"];
const POSTES = ["goalkeeper", "defender", "defender", "defender", "defender", "midfielder", "midfielder", "midfielder", "midfielder", "forward", "forward", "forward"];
/** Un effectif fictif et déterministe pour un club de compétition. */
export function effectif(i, n = 12) {
  return Array.from({ length: n }, (_, k) => ({
    id: `j${i}-${k + 1}`,
    name: `${PRENOMS[(i * 7 + k * 3) % PRENOMS.length]} ${NOMS[(i * 5 + k * 11) % NOMS.length]}`,
    number: String(k + 1),
    position: POSTES[k],
  }));
}

/** « Étoile de Bè » → « etoile-de-be » : noms de fichiers et identifiants. */
export const slug = (nom) => nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
