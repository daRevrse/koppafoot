import { PDFDocument, type PDFPage } from "pdf-lib";
import type { CalendrierDeCompetition, CampDuCalendrier, LigneDuCalendrier } from "@/lib/calendrier-competition";
import {
  ENCRE, GRIS, GRIS_CLAIR, HAUTEUR, LARGEUR, MARGE, TRAIT, VERT,
  couper, enTete, hex, imageDistante, lirePolices, marqueKoppaFoot, tenir, type Polices,
} from "@/lib/pdf-commun";

// ============================================
// Le calendrier d'une compétition, en PDF : ce que l'organisateur partage ou
// glisse dans ses rapports. Les matchs dans l'ordre du calendrier, jour par
// jour ; un match joué avec son score et ses buteurs, un match à venir avec
// son heure et son terrain. Voir lib/calendrier-competition pour l'ordre et
// les règles.
//
// AUTANT DE PAGES QU'IL FAUT : un tournoi de quarante matchs n'entre pas sur
// une. La première porte l'en-tête complet, les suivantes un rappel du nom ;
// toutes, le pied de page et leur numéro.
//
// L'ÉTOILE AU SCORE renvoie à la mention du bas, qui ne paraît que si un match
// est concerné : des buteurs saisis sans feuille de match.
// ============================================

export interface CompetitionDuCalendrier {
  nom: string;
  slug: string;
  logo: string | null;
  /** « 2026-10-15 ». */
  debut: string | null;
  fin: string | null;
  ville: string | null;
  organisateur: string | null;
}

const LARGEUR_UTILE = LARGEUR - 2 * MARGE;
/** La colonne de l'heure et de la phase : « QUART DE FINALE » y tient. */
const L_HEURE = 70;
const L_SCORE = 54;
const ECART = 8;
/** Le centre du score, au milieu de ce qui reste après la colonne de l'heure. */
const X_SCORE = MARGE + L_HEURE + (LARGEUR_UTILE - L_HEURE) / 2;
const L_CAMP = X_SCORE - L_SCORE / 2 - ECART - (MARGE + L_HEURE);
/** Sous cette hauteur, la page est pleine : le pied de page est en dessous. */
const BAS = MARGE + 26;

const BOITE_SCORE = hex("#f3f4f6");
const AMBRE = hex("#b45309");
const FOND_MENTION = hex("#fffbeb");
const BORD_MENTION = hex("#f59e0b");
const TEXTE_MENTION = hex("#92400e");

const T_NOM = 9.5;
const T_BUTEURS = 8;
const INTERLIGNE_BUTEURS = 10;

const MENTION_TITRE = "* Matchs saisis sans feuille de match.";
const MENTION = "Les buteurs de ces matchs ont été saisis sans feuille de match : ils peuvent être incomplets ou erronés.";

/** « 15 – 18 octobre 2026 », « 28 septembre – 4 octobre 2026 », ou une seule date. */
export function periodeLisible(debut: string | null, fin: string | null): string | null {
  const lire = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const a = debut ? lire(debut) : null;
  const b = fin ? lire(fin) : null;
  const long = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  if (!a || !b) return a ? long(a) : b ? long(b) : null;
  if (debut === fin) return long(a);
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${long(a)} – ${long(b)}`;
  if (a.getUTCMonth() !== b.getUTCMonth()) {
    return `${a.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })} – ${long(b)}`;
  }
  return `${a.getUTCDate()} – ${long(b)}`;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Sous le nom d'un camp : ses buteurs, coupés pour tenir dans sa colonne. Le
 * camp qui a déclaré forfait le dit à cet endroit, sous son nom.
 */
function lignesDuCamp(l: LigneDuCalendrier, cote: "domicile" | "exterieur", p: Polices): string[] {
  if (l.forfait === cote) return ["Forfait"];
  // La ligne se coupe ENTRE deux buteurs : « Yao Tchalla » d'un côté et sa
  // minute à la ligne suivante se lisaient comme deux buts. Seul un buteur
  // trop long pour la colonne se coupe à ses mots.
  const lignes: string[] = [];
  let ligne = "";
  for (const buteur of l[cote].buteurs) {
    const essai = ligne ? `${ligne} · ${buteur}` : buteur;
    if (p.moyenne.widthOfTextAtSize(essai, T_BUTEURS) <= L_CAMP) {
      ligne = essai;
      continue;
    }
    if (ligne) lignes.push(ligne);
    const morceaux = couper(buteur, p.moyenne, T_BUTEURS, L_CAMP);
    ligne = morceaux.pop() ?? "";
    lignes.push(...morceaux);
  }
  if (ligne) lignes.push(ligne);
  return lignes;
}

/** Ce qu'on écrit sous la boîte du score : tirs au but, « en cours », ou le terrain d'un match à venir. */
function sousLeScore(l: LigneDuCalendrier): string | null {
  if (l.tab) return `t.a.b. ${l.tab[0]} – ${l.tab[1]}`;
  if (l.etat === "en_cours") return "en cours";
  if (l.etat === "a_venir" && l.lieu) return l.lieu;
  return null;
}

function hauteurDeLaLigne(l: LigneDuCalendrier, p: Polices): number {
  const buteurs = Math.max(lignesDuCamp(l, "domicile", p).length, lignesDuCamp(l, "exterieur", p).length);
  // Une ligne au moins sous les noms : la phase est écrite sous l'heure, et
  // touchait le trait d'un match sans buteurs.
  return 8 + 12 + Math.max(buteurs, 1) * INTERLIGNE_BUTEURS + 6;
}

function dessinerLigne(page: PDFPage, p: Polices, l: LigneDuCalendrier, haut: number) {
  const base = haut - 8 - 9;

  // L'heure, puis la phase dessous. La journée en abrégé, « POULE B · J2 » :
  // en toutes lettres, elle ne tenait pas dans la colonne et finissait coupée.
  page.drawText(l.heure ?? "—", { x: MARGE, y: base, size: 9, font: p.grasse, color: ENCRE });
  const phase = l.phase.replace(" · Journée ", " · J").toLocaleUpperCase("fr-FR");
  page.drawText(tenir(phase, p.moyenne, 6.5, L_HEURE - 4), {
    x: MARGE, y: base - 9, size: 6.5, font: p.moyenne, color: GRIS_CLAIR,
  });

  // Les deux camps, de part et d'autre du score.
  const xDomicileFin = X_SCORE - L_SCORE / 2 - ECART;
  const xExterieur = X_SCORE + L_SCORE / 2 + ECART;
  const nomDe = (camp: CampDuCalendrier) => ({
    texte: tenir(camp.nom, camp.enAttente ? p.moyenne : p.grasse, T_NOM, L_CAMP),
    police: camp.enAttente ? p.moyenne : p.grasse,
    couleur: camp.enAttente ? GRIS_CLAIR : ENCRE,
  });
  const dom = nomDe(l.domicile);
  page.drawText(dom.texte, {
    x: xDomicileFin - dom.police.widthOfTextAtSize(dom.texte, T_NOM), y: base, size: T_NOM, font: dom.police, color: dom.couleur,
  });
  const ext = nomDe(l.exterieur);
  page.drawText(ext.texte, { x: xExterieur, y: base, size: T_NOM, font: ext.police, color: ext.couleur });

  // Le score dans sa boîte, ou « à venir ».
  const xBoite = X_SCORE - L_SCORE / 2;
  if (l.score) {
    page.drawRectangle({ x: xBoite, y: base - 4.5, width: L_SCORE, height: 17, color: BOITE_SCORE });
    const score = `${l.score[0]} – ${l.score[1]}`;
    page.drawText(score, { x: X_SCORE - p.noire.widthOfTextAtSize(score, 11) / 2, y: base - 0.5, size: 11, font: p.noire, color: ENCRE });
    if (l.sansFeuille) page.drawText("*", { x: xBoite + L_SCORE - 7, y: base + 4, size: 10, font: p.noire, color: AMBRE });
  } else {
    const texte = "à venir";
    page.drawText(texte, { x: X_SCORE - p.moyenne.widthOfTextAtSize(texte, 8) / 2, y: base + 0.5, size: 8, font: p.moyenne, color: GRIS });
  }

  // Les buteurs, sous chaque camp.
  let y = base - 4.5 - INTERLIGNE_BUTEURS + 1;
  for (const ligne of lignesDuCamp(l, "domicile", p)) {
    page.drawText(ligne, { x: xDomicileFin - p.moyenne.widthOfTextAtSize(ligne, T_BUTEURS), y, size: T_BUTEURS, font: p.moyenne, color: GRIS });
    y -= INTERLIGNE_BUTEURS;
  }
  y = base - 4.5 - INTERLIGNE_BUTEURS + 1;
  for (const ligne of lignesDuCamp(l, "exterieur", p)) {
    page.drawText(ligne, { x: xExterieur, y, size: T_BUTEURS, font: p.moyenne, color: GRIS });
    y -= INTERLIGNE_BUTEURS;
  }

  // Sous la boîte : tirs au but, « en cours », ou le terrain d'un match à
  // venir. Un match joué a ses buteurs de part et d'autre : le texte tient
  // entre eux ; un match à venir n'en a pas, le terrain prend la largeur.
  const dessous = sousLeScore(l);
  if (dessous) {
    const largeur = l.etat === "a_venir" ? 2 * L_CAMP : L_SCORE + 2 * ECART - 4;
    const texte = tenir(dessous, p.moyenne, 7, largeur);
    page.drawText(texte, {
      x: X_SCORE - p.moyenne.widthOfTextAtSize(texte, 7) / 2, y: base - 4.5 - INTERLIGNE_BUTEURS + 1.5, size: 7, font: p.moyenne, color: GRIS_CLAIR,
    });
  }
}

export async function pdfCalendrier(
  c: CompetitionDuCalendrier,
  cal: CalendrierDeCompetition,
  /** « mercredi 21 octobre 2026 ». */
  edite: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Calendrier et résultats · ${c.nom}`);
  doc.setAuthor("KoppaFoot");
  doc.setCreator("KoppaFoot");
  const p = await lirePolices(doc);
  const [logo, marque] = await Promise.all([imageDistante(doc, c.logo), marqueKoppaFoot(doc)]);

  // ---- La première page : l'en-tête complet, puis les comptes.
  let page = doc.addPage([LARGEUR, HAUTEUR]);
  const sousTitre = [periodeLisible(c.debut, c.fin), c.ville, c.organisateur ? `Organisé par ${c.organisateur}` : null]
    .filter(Boolean).join(" · ");
  enTete(page, p, { surtitre: "CALENDRIER ET RÉSULTATS", nom: c.nom, sousTitre, logo, marque });
  let y = HAUTEUR - MARGE - 66;
  const comptes = `${pluriel(cal.joues, "match")} ${cal.joues > 1 ? "joués" : "joué"} · ${cal.aVenir} à venir`;
  page.drawText(comptes, { x: MARGE, y, size: 9, font: p.grasse, color: ENCRE });
  y -= 8;
  page.drawLine({ start: { x: MARGE, y }, end: { x: LARGEUR - MARGE, y }, thickness: 1.2, color: ENCRE });

  // Les pages suivantes : un rappel du nom.
  const nouvellePage = () => {
    page = doc.addPage([LARGEUR, HAUTEUR]);
    const haut = HAUTEUR - MARGE;
    page.drawText(tenir(c.nom, p.noire, 10, LARGEUR_UTILE - 150), { x: MARGE, y: haut - 10, size: 10, font: p.noire, color: ENCRE });
    const rappel = "Calendrier et résultats (suite)";
    page.drawText(rappel, { x: LARGEUR - MARGE - p.moyenne.widthOfTextAtSize(rappel, 8), y: haut - 10, size: 8, font: p.moyenne, color: GRIS });
    page.drawLine({ start: { x: MARGE, y: haut - 18 }, end: { x: LARGEUR - MARGE, y: haut - 18 }, thickness: 1.2, color: ENCRE });
    y = haut - 18;
  };

  const titreDuJour = (titre: string) => {
    y -= 22;
    page.drawText(titre.toLocaleUpperCase("fr-FR"), { x: MARGE, y, size: 8.5, font: p.noire, color: VERT });
    y -= 3;
  };

  // LA MENTION, EN NOTE AU BAS DE CHAQUE PAGE QUI PORTE UNE ÉTOILE : à la fin
  // du document, elle partait seule sur une page quand la dernière était
  // pleine, et loin des étoiles qu'elle explique. Sa place est gardée sur
  // toutes les pages dès qu'un match est concerné.
  const lignesMention = couper(MENTION, p.moyenne, 8, LARGEUR_UTILE - 24);
  const hMention = 12 + 10 + lignesMention.length * 10 + 2;
  const basMention = MARGE + 14;
  const bas = cal.sansFeuille > 0 ? basMention + hMention + 10 : BAS;
  const pagesEtoilees = new Set<PDFPage>();

  if (cal.jours.length === 0) {
    page.drawText("Aucun match au calendrier.", { x: MARGE, y: y - 30, size: 10, font: p.moyenne, color: GRIS });
  }

  for (const jour of cal.jours) {
    // Un titre de jour ne reste pas seul en bas de page : il part avec son premier match.
    if (y - 25 - hauteurDeLaLigne(jour.lignes[0], p) < bas) nouvellePage();
    titreDuJour(jour.titre);
    for (const l of jour.lignes) {
      const h = hauteurDeLaLigne(l, p);
      if (y - h < bas) {
        nouvellePage();
        titreDuJour(`${jour.titre} (suite)`);
      }
      dessinerLigne(page, p, l, y);
      if (l.sansFeuille) pagesEtoilees.add(page);
      y -= h;
      page.drawLine({ start: { x: MARGE, y }, end: { x: LARGEUR - MARGE, y }, thickness: 0.5, color: TRAIT });
    }
  }

  for (const pg of pagesEtoilees) {
    pg.drawRectangle({ x: MARGE, y: basMention, width: LARGEUR_UTILE, height: hMention, color: FOND_MENTION });
    pg.drawRectangle({ x: MARGE, y: basMention, width: 2.5, height: hMention, color: BORD_MENTION });
    let yt = basMention + hMention - 12;
    pg.drawText(MENTION_TITRE, { x: MARGE + 12, y: yt, size: 8, font: p.grasse, color: TEXTE_MENTION });
    for (const ligne of lignesMention) {
      yt -= 10;
      pg.drawText(ligne, { x: MARGE + 12, y: yt, size: 8, font: p.moyenne, color: TEXTE_MENTION });
    }
  }

  // ---- Le pied de chaque page, une fois leur nombre connu.
  const pages = doc.getPages();
  const pied = `Édité le ${edite} · koppafoot.com/c/${c.slug}`;
  pages.forEach((pg, i) => {
    pg.drawLine({ start: { x: MARGE, y: MARGE + 4 }, end: { x: LARGEUR - MARGE, y: MARGE + 4 }, thickness: 0.5, color: TRAIT });
    pg.drawText(tenir(pied, p.grasse, 7, LARGEUR_UTILE - 60), { x: MARGE, y: MARGE - 8, size: 7, font: p.grasse, color: GRIS });
    const numero = `Page ${i + 1} / ${pages.length}`;
    pg.drawText(numero, { x: LARGEUR - MARGE - p.moyenne.widthOfTextAtSize(numero, 7), y: MARGE - 8, size: 7, font: p.moyenne, color: GRIS_CLAIR });
  });

  return doc.save();
}
