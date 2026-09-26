// Les personnes et le terrain du tutoriel : tous inventés.

/** Le gérant suivi tout au long du guide. */
export const GERANT = {
  prenom: "Yawo", nom: "Agbeko", email: "yawo.agbeko@example.com", mdp: "Terrain2026!",
};

/** Son terrain, tel qu'il le déclare dans sa candidature. */
export const TERRAIN = {
  nom: "Complexe sportif de Bè",
  ville: "Lomé",
  adresse: "Rue du Lac, Bè Kpota",
  telephone: "90 12 34 56",
  lien: "Je suis le gérant du complexe depuis 2019 : je m'occupe des réservations et de l'entretien.",
  /** Le numéro de l'accueil, qu'il donnera ensuite à la place du sien. */
  accueil: "22 20 15 15",
};

/** Une autre candidate, pour montrer un refus et son motif. */
export const CANDIDATE = {
  prenom: "Mawuena", nom: "Amegah", email: "mawuena.amegah@example.com", mdp: "Terrain2026!",
  terrain: "Terrain d'Agoè",
};

/** Les managers qui demandent des créneaux (voir t0-decor). */
export const EDEM = { email: "edem.amouzou@example.com", mdp: "Equipe2026!", equipe: "Avenir d'Adakpamé" };
export const KOKOU = { email: "kokou.tepe@example.com", mdp: "Equipe2026!", equipe: "Olympique de Tokoin" };

/** Les dates du guide : un samedi, le dimanche suivant, les jeudis. */
export const SAMEDI = "2026-10-03";
export const DIMANCHE = "2026-10-04";
export const JEUDI = "2026-10-01";
export const JEUDI_FIN = "2026-12-17";
