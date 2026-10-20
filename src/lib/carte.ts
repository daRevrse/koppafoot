// ============================================
// L'emplacement d'un terrain, et les liens vers la carte.
//
// « Rue, quartier » ne mène personne au terrain : à Lomé, l'adresse d'un
// terrain s'écrit « derrière la station, Agoè » et l'équipe qui vient pour
// la première fois tourne dans le quartier en appelant le gardien. Le
// propriétaire, lui, sait exactement où il est. On lui demande donc un point,
// une fois, et on le donne ensuite à chaque équipe sous la forme qu'elle sait
// suivre : Google Maps.
//
// LE POINT ARRIVE DE DEUX FAÇONS. Le lien « Partager » de Google Maps, que
// tout le monde sait copier, ou la position du téléphone, quand le
// propriétaire est sur place. On ne garde que la latitude et la longitude :
// un lien Maps change de forme tous les deux ans, un couple de nombres non.
//
// AUCUNE CLÉ D'API. La carte de la fiche est l'intégration sans clé de
// Google Maps (`output=embed`), et l'itinéraire un lien universel
// (`/maps/dir/?api=1`) qui ouvre l'application Maps sur un téléphone.
//
// Ce module est partagé : le navigateur y lit ce qu'on colle, le serveur
// (/api/venues/position) y lit les adresses par où passe un lien court.
// ============================================

export interface Position {
  lat: number;
  lng: number;
}

/** Six décimales : une dizaine de centimètres. Au-delà, c'est du bruit de GPS. */
const arrondi = (x: number) => Math.round(x * 1e6) / 1e6;

/**
 * Un point plausible, arrondi ; `null` sinon.
 *
 * (0, 0) est refusé : c'est la valeur d'un champ vide qu'on a converti en
 * nombre, pas un terrain — il tombe dans le golfe de Guinée.
 */
export function positionValide(lat: unknown, lng: unknown): Position | null {
  const a = typeof lat === "string" ? Number(lat) : lat;
  const o = typeof lng === "string" ? Number(lng) : lng;
  if (typeof a !== "number" || typeof o !== "number") return null;
  if (!Number.isFinite(a) || !Number.isFinite(o)) return null;
  if (a < -90 || a > 90 || o < -180 || o > 180) return null;
  if (a === 0 && o === 0) return null;
  return { lat: arrondi(a), lng: arrondi(o) };
}

/** La position d'un document Firestore, telle qu'elle a été écrite ou absente. */
export function positionLue(x: unknown): Position | null {
  if (!x || typeof x !== "object") return null;
  const p = x as { lat?: unknown; lng?: unknown };
  return positionValide(p.lat, p.lng);
}

const NOMBRE = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

/** « 6.1319, 1.2253 », ou séparés d'un espace : ce que Maps copie d'un appui long. */
const COUPLE = new RegExp(String.raw`^\s*${NOMBRE}\s*[,;\s]\s*${NOMBRE}\s*$`);

/** Un degré-minute-seconde : 6°07'54.8"N. */
const DMS = /(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:[.,]\d+)?)["″]?\s*([NSEWO])/gi;

function depuisDms(texte: string): Position | null {
  const valeurs: { v: number; axe: "lat" | "lng" }[] = [];
  for (const m of texte.matchAll(DMS)) {
    const v = Number(m[1]) + Number(m[2]) / 60 + Number(m[3].replace(",", ".")) / 3600;
    const h = m[4].toUpperCase();
    valeurs.push({ v: h === "S" || h === "W" || h === "O" ? -v : v, axe: h === "N" || h === "S" ? "lat" : "lng" });
  }
  const lat = valeurs.find((x) => x.axe === "lat");
  const lng = valeurs.find((x) => x.axe === "lng");
  return lat && lng ? positionValide(lat.v, lng.v) : null;
}

/** Les paramètres d'adresse où Maps range un point : `?q=6.13,1.22`, etc. */
const PARAMETRES = ["q", "query", "ll", "sll", "destination", "daddr", "center"];

/**
 * Le point que désigne un texte collé, ou `null`.
 *
 * Dans l'ordre : des coordonnées écrites telles quelles, en décimal ou en
 * degrés ; le repère du lieu dans un lien `/maps/place/` (`!3d…!4d…`), qui est
 * l'épingle elle-même ; un paramètre `q=`, `ll=`… ; et en dernier le `@lat,lng`
 * du chemin, qui n'est que le CENTRE de l'écran quand le lien a été copié —
 * juste si l'on a zoomé sur le terrain, à côté sinon.
 *
 * Un lien court (maps.app.goo.gl) ne porte rien de tout ça : voir
 * `estLienCourt`, il faut le suivre côté serveur.
 *
 * Un lien vers une RECHERCHE (`?q=Stade de Kégué`) ne donne rien non plus, et
 * c'est voulu : la page qu'il ouvre annonce le centre par défaut de Maps
 * (le milieu des États-Unis), pas le lieu. Mieux vaut redemander que placer
 * le terrain au Kansas.
 */
export function lirePosition(texte: string): Position | null {
  const t = texte.trim();
  if (!t) return null;

  const couple = t.match(COUPLE);
  if (couple) return positionValide(couple[1], couple[2]);

  let decode = t;
  try {
    decode = decodeURIComponent(t);
  } catch {
    // Un « % » isolé : on lit le texte tel quel.
  }

  // Décodé d'abord : une épingle lâchée donne `/maps/place/6%C2%B007'54.8%22N+…`.
  const dms = depuisDms(decode);
  if (dms) return dms;

  const geo = decode.match(new RegExp(String.raw`^geo:${NOMBRE},${NOMBRE}`));
  if (geo) return positionValide(geo[1], geo[2]);

  // Le dernier repère : dans un lien d'itinéraire, le premier est le départ.
  const reperes = [...decode.matchAll(new RegExp(String.raw`!3d${NOMBRE}!4d${NOMBRE}`, "g"))];
  if (reperes.length) {
    const r = reperes[reperes.length - 1];
    const p = positionValide(r[1], r[2]);
    if (p) return p;
  }

  let url: URL | null = null;
  try {
    url = new URL(t);
  } catch {
    url = null;
  }
  if (url) {
    for (const cle of PARAMETRES) {
      const v = url.searchParams.get(cle);
      const m = v?.match(COUPLE);
      if (m) {
        const p = positionValide(m[1], m[2]);
        if (p) return p;
      }
    }
    // Une épingle lâchée à la main : `/maps/search/6.13,+1.22` ou `/maps/place/6.13,1.22`.
    const chemin = url.pathname.match(/\/maps\/(?:search|place)\/([^/]+)/);
    if (chemin) {
      let segment = chemin[1].replace(/\+/g, " ");
      try {
        segment = decodeURIComponent(segment);
      } catch {
        // Tel quel.
      }
      const m = segment.match(COUPLE);
      const p = m ? positionValide(m[1], m[2]) : null;
      if (p) return p;
    }
  }

  const centre = decode.match(new RegExp(String.raw`@${NOMBRE},${NOMBRE}`));
  if (centre) return positionValide(centre[1], centre[2]);

  return null;
}

/** Un hôte de Google, ou l'un de ses raccourcisseurs : les seuls qu'on accepte de suivre. */
export function hoteGoogle(hote: string): boolean {
  const h = hote.toLowerCase();
  return h === "goo.gl" || h === "maps.app.goo.gl" || /^([a-z0-9-]+\.)*google\.(com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(h);
}

/** Un lien Google qu'il faut suivre pour y trouver le point : le lien court du bouton « Partager ». */
export function estLienCourt(texte: string): boolean {
  try {
    const u = new URL(texte.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    return h === "maps.app.goo.gl" || (h === "goo.gl" && u.pathname.startsWith("/maps"));
  } catch {
    return false;
  }
}

const coord = (p: Position) => `${p.lat},${p.lng}`;

/** La carte de la fiche : l'intégration sans clé, centrée sur l'épingle. */
export const lienCarteIntegree = (p: Position) =>
  `https://maps.google.com/maps?q=${coord(p)}&z=16&output=embed`;

/**
 * L'itinéraire : vers le point s'il est connu, vers l'adresse écrite sinon.
 * Sur un téléphone, ce lien ouvre l'application Maps, guidage prêt.
 */
export function lienItineraire(cible: Position | string): string {
  const destination = typeof cible === "string" ? cible : coord(cible);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Le terrain ouvert dans Maps, pour le voir ou le partager. */
export const lienCarte = (p: Position) =>
  `https://www.google.com/maps/search/?api=1&query=${coord(p)}`;
