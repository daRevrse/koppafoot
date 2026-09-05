"use client";

// ============================================
// Alléger une image AVANT de l'envoyer.
//
// CE QUE ÇA CORRIGE, MESURÉ EN PRODUCTION. Un écusson de 2000×2000 pour 157 Ko
// affiché à 32 pixels. Un logo de compétition de 1254×1254 pour 494 Ko affiché
// à 349. Cinq médias en base pesaient 1,1 Mo, presque entièrement en pixels
// que personne ne voit — sur un public qui paie sa data au mégaoctet.
//
// Le redimensionnement se fait ICI, dans le navigateur, et pas seulement à
// l'affichage. Les deux sont utiles et ne règlent pas le même problème :
// `next/image` évite de TRANSMETTRE des pixels inutiles, ce module évite de
// les STOCKER. Sans lui, le jour où quelqu'un lit le fichier autrement — un
// partage, une affiche générée, un export — il retrouve les 2000×2000.
//
// CE QU'ON NE TOUCHE PAS : les SVG (le canvas les rastériserait, c'est-à-dire
// détruirait exactement ce qui en fait l'intérêt) et les GIF (le canvas ne
// garde que la première image d'une animation). Ils repartent tels quels.
// ============================================

export interface ReglageImage {
  /** Côté le plus long, en pixels, après redimensionnement. */
  cotéMax: number;
  /** Qualité de compression, 0 à 1. */
  qualite: number;
}

/**
 * Les deux usages du produit.
 *
 * Un logo tolère mal la compression — un aplat de couleur montre les artefacts
 * bien plus qu'une pelouse — d'où une qualité plus haute sur une image plus
 * petite. Une photo, c'est l'inverse : grande, et généreuse en compression.
 */
export const REGLAGES = {
  /** Photo de terrain, bannière, couverture. */
  photo: { cotéMax: 1600, qualite: 0.82 },
  /** Logo de compétition, écusson d'équipe, avatar. */
  logo: { cotéMax: 512, qualite: 0.92 },
} as const satisfies Record<string, ReglageImage>;

const INTOUCHABLES = ["image/svg+xml", "image/gif"];

/** Le nom du fichier, avec sa nouvelle extension. */
function renomme(nom: string, extension: string): string {
  const base = nom.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${extension}`;
}

/**
 * Réduit une image et la réencode en WebP.
 *
 * Rend le fichier D'ORIGINE, sans erreur, dans tous les cas où l'opération
 * n'a pas de sens ou échoue : format intouchable, navigateur sans WebP,
 * décodage impossible, ou résultat plus lourd que la source. Un envoi qui
 * marche avec une image trop grande vaut mieux qu'un envoi qui échoue.
 */
export async function alleger(
  fichier: File,
  reglage: ReglageImage = REGLAGES.photo,
): Promise<File> {
  if (INTOUCHABLES.includes(fichier.type)) return fichier;
  if (typeof createImageBitmap !== "function") return fichier;

  let bitmap: ImageBitmap;
  try {
    // `from-image` applique l'orientation EXIF : sans elle, une photo prise en
    // portrait sur un téléphone repart couchée, le canvas ignorant la balise.
    bitmap = await createImageBitmap(fichier, { imageOrientation: "from-image" });
  } catch {
    return fichier;
  }

  const { width, height } = bitmap;
  const facteur = Math.min(1, reglage.cotéMax / Math.max(width, height));
  const l = Math.max(1, Math.round(width * facteur));
  const h = Math.max(1, Math.round(height * facteur));

  const canvas = document.createElement("canvas");
  canvas.width = l;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return fichier;
  }
  ctx.drawImage(bitmap, 0, 0, l, h);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", reglage.qualite),
  );

  // `toBlob` rend null quand le format n'est pas géré. On ne se rabat PAS sur
  // le JPEG : il perd la transparence, et un écusson détouré reviendrait avec
  // un carré blanc autour. Mieux vaut l'original intact.
  if (!blob || blob.type !== "image/webp") return fichier;

  // Réencoder peut alourdir : un PNG déjà optimisé, une image minuscule. Dans
  // ce cas on garde la source — sauf si on a vraiment réduit les dimensions,
  // auquel cas le gain de pixels compte plus que le poids du fichier.
  if (blob.size >= fichier.size && facteur === 1) return fichier;

  return new File([blob], renomme(fichier.name, "webp"), {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

/** « 494 Ko », « 1,2 Mo ». Pour dire à l'utilisateur ce qu'on a gagné. */
export function poidsLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
