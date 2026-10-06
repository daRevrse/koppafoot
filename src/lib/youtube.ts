// ============================================
// Un lien YouTube, tel qu'on le copie, réduit à l'identifiant de la vidéo.
//
// Ajouter une vidéo à un tutoriel doit rester un copier-coller : le bouton
// « Partager » de YouTube donne youtu.be/…, la barre d'adresse watch?v=…, le
// téléphone parfois shorts/… ou un lien m.youtube.com. Tous mènent ici, et
// l'identifiant seul est accepté aussi.
//
// Un lien qu'on ne sait pas lire rend null : le lecteur ne s'affiche pas,
// plutôt qu'un cadre noir qui ne lit rien.
// ============================================

const ID = /^[A-Za-z0-9_-]{11}$/;

const HOTES = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export function idYoutube(lien: string): string | null {
  const brut = lien.trim();
  if (ID.test(brut)) return brut;

  let url: URL;
  try {
    url = new URL(brut.includes("://") ? brut : `https://${brut}`);
  } catch {
    return null;
  }

  const hote = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  let candidat: string | null | undefined;

  if (hote === "youtu.be") {
    candidat = segments[0];
  } else if (HOTES.has(hote)) {
    if (segments[0] === "watch") candidat = url.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(segments[0])) candidat = segments[1];
  }

  return candidat && ID.test(candidat) ? candidat : null;
}

/** La miniature, dans la meilleure taille puis dans celle qui existe toujours. */
export function miniatureYoutube(id: string, taille: "maxres" | "hq"): string {
  return `https://i.ytimg.com/vi/${id}/${taille}default.jpg`;
}
