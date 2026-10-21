import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { rgb, type PDFDocument, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// ============================================
// Ce que les PDF de KoppaFoot ont en commun : la page A4, les teintes, les
// polices Outfit d'assets/fonts, le logo de la compétition et la marque, le
// texte raccourci ou coupé pour tenir, l'en-tête.
//
// Sorti de lib/rapport-audience quand le calendrier (lib/pdf-calendrier) a
// voulu le même habit. Serveur seulement : les polices se lisent sur disque.
// ============================================

export const LARGEUR = 595.28;
export const HAUTEUR = 841.89;
export const MARGE = 44;

export const hex = (h: string): RGB => rgb(
  parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255,
);
export const ENCRE = hex("#111827");
export const GRIS = hex("#6b7280");
export const GRIS_CLAIR = hex("#9ca3af");
export const TRAIT = hex("#e5e7eb");
export const FOND = hex("#f9fafb");
/** Le vert de KoppaFoot. */
export const VERT = hex("#059669");

export interface Polices { noire: PDFFont; grasse: PDFFont; moyenne: PDFFont }

export async function lirePolices(doc: PDFDocument): Promise<Polices> {
  doc.registerFontkit(fontkit);
  const [noire, grasse, moyenne] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Outfit-Black.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Outfit-Bold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Outfit-Medium.ttf")),
  ]);
  return {
    noire: await doc.embedFont(noire, { subset: true }),
    grasse: await doc.embedFont(grasse, { subset: true }),
    moyenne: await doc.embedFont(moyenne, { subset: true }),
  };
}

/** Une image en ligne (le logo de la compétition), ou `null` si elle ne se lit pas. */
export async function imageDistante(doc: PDFDocument, url: string | null): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const octets = new Uint8Array(await res.arrayBuffer());
    // PNG : 89 50 4E 47 ; JPEG : FF D8. Le reste (WebP…) ne s'embarque pas.
    if (octets[0] === 0x89 && octets[1] === 0x50) return await doc.embedPng(octets);
    if (octets[0] === 0xff && octets[1] === 0xd8) return await doc.embedJpg(octets);
    return null;
  } catch {
    return null;
  }
}

/** Le logo KoppaFoot en toutes lettres, pour le coin de l'en-tête. */
export function marqueKoppaFoot(doc: PDFDocument): Promise<PDFImage | null> {
  return readFile(join(process.cwd(), "public/branding/logo_full_name.png")).then((o) => doc.embedPng(o)).catch(() => null);
}

/** Le texte raccourci d'une ellipse pour tenir dans `largeur`. */
export function tenir(texte: string, police: PDFFont, taille: number, largeur: number): string {
  if (police.widthOfTextAtSize(texte, taille) <= largeur) return texte;
  let t = texte;
  while (t.length > 1 && police.widthOfTextAtSize(`${t}…`, taille) > largeur) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Des lignes coupées aux mots pour tenir dans `largeur`. */
export function couper(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
  const lignes: string[] = [];
  let ligne = "";
  for (const mot of texte.split(" ")) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (police.widthOfTextAtSize(essai, taille) > largeur && ligne) {
      lignes.push(ligne);
      ligne = mot;
    } else {
      ligne = essai;
    }
  }
  if (ligne) lignes.push(ligne);
  return lignes;
}

/** L'en-tête d'une page : le logo, le surtitre, le nom, une ligne de contexte, la marque. */
export function enTete(
  page: PDFPage, p: Polices,
  { surtitre, nom, sousTitre, logo, marque }: {
    surtitre: string; nom: string; sousTitre: string; logo: PDFImage | null; marque: PDFImage | null;
  },
) {
  const y = HAUTEUR - MARGE;
  let xTitre = MARGE;
  if (logo) {
    const t = logo.scaleToFit(46, 46);
    page.drawImage(logo, { x: MARGE, y: y - 46, width: t.width, height: t.height });
    xTitre = MARGE + 58;
  }
  if (marque) {
    const t = marque.scaleToFit(96, 22);
    page.drawImage(marque, { x: LARGEUR - MARGE - t.width, y: y - t.height, width: t.width, height: t.height });
  }
  page.drawText(surtitre, { x: xTitre, y: y - 9, size: 8, font: p.noire, color: VERT });
  page.drawText(tenir(nom, p.noire, 20, LARGEUR - MARGE - xTitre - 110), { x: xTitre, y: y - 30, size: 20, font: p.noire, color: ENCRE });
  page.drawText(tenir(sousTitre, p.moyenne, 9.5, LARGEUR - MARGE - xTitre), { x: xTitre, y: y - 45, size: 9.5, font: p.moyenne, color: GRIS });
}
