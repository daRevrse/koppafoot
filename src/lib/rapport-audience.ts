import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  heureDeMinute, jourAudience, jourLisible, nombreFr,
  type AudienceDeCompetition, type AudienceDeMatch,
} from "@/lib/audience";
import { couvertureLisible, parMatchLisible, titreDuRecord, type StatsDeJeu } from "@/lib/stats-competition";

// ============================================
// Le rapport d'audience d'une compétition, en PDF.
//
// L'organisateur l'envoie tel quel à un sponsor, sur WhatsApp : une page A4,
// lisible sans personne pour l'expliquer — et sans y voir plus qu'il ne dit,
// d'où le pied de page sur ce que les chiffres comptent.
//
// UNE SECONDE PAGE, LE JEU : les totaux des matchs et leurs records
// (lib/stats-competition), les mêmes que l'onglet « Le jeu » de l'espace
// organisateur. Un sponsor demande combien de gens ont regardé, puis ce
// qu'ils ont vu.
//
// DESSINÉ PAR pdf-lib, sans navigateur ni capture d'écran : rectangles,
// lignes et texte, à partir des mêmes séries que l'écran (lib/audience-serveur).
// Les polices Outfit d'assets/fonts, comme les images partagées (lib/og-da).
// ============================================

const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const MARGE = 44;

const hex = (h: string): RGB => rgb(
  parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255,
);
const ENCRE = hex("#111827");
const GRIS = hex("#6b7280");
const GRIS_CLAIR = hex("#9ca3af");
const TRAIT = hex("#e5e7eb");
const FOND = hex("#f9fafb");
// Les deux teintes de l'écran (components/audience/Graphiques), validées.
const PAGES = hex("#0284c7");
const MATCHS = hex("#059669");

interface Polices { noire: PDFFont; grasse: PDFFont; moyenne: PDFFont }

async function lirePolices(doc: PDFDocument): Promise<Polices> {
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
async function imageDistante(doc: PDFDocument, url: string | null): Promise<PDFImage | null> {
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

/** Le texte raccourci d'une ellipse pour tenir dans `largeur`. */
function tenir(texte: string, police: PDFFont, taille: number, largeur: number): string {
  if (police.widthOfTextAtSize(texte, taille) <= largeur) return texte;
  let t = texte;
  while (t.length > 1 && police.widthOfTextAtSize(`${t}…`, taille) > largeur) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Des lignes coupées aux mots pour tenir dans `largeur`. */
function couper(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
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

const pourcent = (x: number) => `${Math.round(x * 100)} %`;
const periodeLisible = (a: AudienceDeCompetition) =>
  a.periode === "tout"
    ? `depuis le ${jourLisible(a.depuis)}`
    : `du ${jourLisible(a.depuis)} au ${jourLisible(jourAudience())}`;

function titreDeSection(page: PDFPage, p: Polices, texte: string, y: number) {
  page.drawText(texte.toLocaleUpperCase("fr-FR"), { x: MARGE, y, size: 9, font: p.noire, color: ENCRE });
}

/** L'en-tête d'une page : le logo, le surtitre, le nom, une ligne de contexte, la marque. */
function enTete(
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
  page.drawText(surtitre, { x: xTitre, y: y - 9, size: 8, font: p.noire, color: MATCHS });
  page.drawText(tenir(nom, p.noire, 20, LARGEUR - MARGE - xTitre - 110), { x: xTitre, y: y - 30, size: 20, font: p.noire, color: ENCRE });
  page.drawText(tenir(sousTitre, p.moyenne, 9.5, LARGEUR - MARGE - xTitre), { x: xTitre, y: y - 45, size: 9.5, font: p.moyenne, color: GRIS });
}

/** Ce que les chiffres comptent, puis la date du rapport. */
function piedDePage(page: PDFPage, p: Polices, note: string) {
  let yNote = MARGE + 30;
  page.drawLine({ start: { x: MARGE, y: yNote + 12 }, end: { x: LARGEUR - MARGE, y: yNote + 12 }, thickness: 0.5, color: TRAIT });
  for (const ligne of couper(note, p.moyenne, 7, LARGEUR - 2 * MARGE)) {
    page.drawText(ligne, { x: MARGE, y: yNote, size: 7, font: p.moyenne, color: GRIS_CLAIR });
    yNote -= 9.5;
  }
  const genere = `Généré le ${jourLisible(jourAudience())} · koppafoot.com`;
  page.drawText(genere, { x: MARGE, y: MARGE - 8, size: 7, font: p.grasse, color: GRIS });
}

/**
 * LA PAGE DU JEU : les totaux en tuiles, quatre par ligne, puis le match qui
 * détient chaque record. La phrase de couverture en sous-titre, avant tout
 * chiffre — voir couvertureLisible.
 */
function pageDuJeu(
  page: PDFPage, p: Polices, a: AudienceDeCompetition, jeu: StatsDeJeu,
  logo: PDFImage | null, marque: PDFImage | null,
) {
  enTete(page, p, { surtitre: "LE JEU", nom: a.nom, sousTitre: couvertureLisible(jeu), logo, marque });
  let y = HAUTEUR - MARGE - 70;

  titreDeSection(page, p, "Les totaux", y);
  y -= 12;
  const parLigne = 4;
  const lTuile = (LARGEUR - 2 * MARGE - (parLigne - 1) * 8) / parLigne;
  const hTuile = 56;
  jeu.totaux.forEach((t, i) => {
    const x = MARGE + (i % parLigne) * (lTuile + 8);
    const yt = y - Math.floor(i / parLigne) * (hTuile + 8);
    page.drawRectangle({ x, y: yt - hTuile, width: lTuile, height: hTuile, color: FOND });
    page.drawText(nombreFr(t.total), { x: x + 10, y: yt - 26, size: 20, font: p.noire, color: ENCRE });
    page.drawText(tenir(t.label, p.moyenne, 8, lTuile - 20), { x: x + 10, y: yt - 39, size: 8, font: p.moyenne, color: GRIS });
    page.drawText(`${parMatchLisible(t.parMatch)} par match`, { x: x + 10, y: yt - 49, size: 7, font: p.moyenne, color: GRIS_CLAIR });
  });
  y -= Math.ceil(jeu.totaux.length / parLigne) * (hTuile + 8) + 26;

  if (jeu.records.length > 0) {
    titreDeSection(page, p, "Les records", y);
    y -= 16;
    const colonnes = [
      { titre: "Record", x: MARGE, l: 150 },
      { titre: "Match", x: MARGE + 160, l: 290 },
    ];
    for (const c of colonnes) page.drawText(c.titre, { x: c.x, y, size: 7.5, font: p.grasse, color: GRIS_CLAIR });
    const titreNombre = "Nombre";
    page.drawText(titreNombre, { x: LARGEUR - MARGE - p.grasse.widthOfTextAtSize(titreNombre, 7.5), y, size: 7.5, font: p.grasse, color: GRIS_CLAIR });
    y -= 6;
    for (const r of jeu.records) {
      if (y < MARGE + 70) break;
      page.drawLine({ start: { x: MARGE, y }, end: { x: LARGEUR - MARGE, y }, thickness: 0.5, color: TRAIT });
      y -= 13;
      page.drawText(tenir(titreDuRecord(r.label), p.moyenne, 8.5, colonnes[0].l), { x: colonnes[0].x, y, size: 8.5, font: p.moyenne, color: GRIS });
      page.drawText(tenir(r.affiche, p.grasse, 8.5, colonnes[1].l), { x: colonnes[1].x, y, size: 8.5, font: p.grasse, color: ENCRE });
      const n = nombreFr(r.n);
      page.drawText(n, { x: LARGEUR - MARGE - p.noire.widthOfTextAtSize(n, 9), y, size: 9, font: p.noire, color: MATCHS });
      y -= 6;
    }
  }

  piedDePage(page, p, "Les totaux additionnent les fiches des matchs, calculées comme sur KoppaFoot. Les buts comptent tous les matchs joués, au score ; le reste, les matchs suivis en direct sur la console, et les tirs les seuls matchs où des tirs ont été saisis. Les matchs d'exhibition et les forfaits ne comptent pas. Un record demande au moins deux faits.");
}

function barresParJour(page: PDFPage, p: Polices, a: AudienceDeCompetition, haut: number, hauteur: number) {
  const x0 = MARGE;
  const largeur = LARGEUR - 2 * MARGE;
  const bas = haut - hauteur;
  const jours = a.parJour;
  // La légende, puis le cadre.
  const cle = (couleur: RGB, texte: string, x: number) => {
    page.drawRectangle({ x, y: haut + 2, width: 7, height: 7, color: couleur });
    page.drawText(texte, { x: x + 11, y: haut + 2.5, size: 8, font: p.moyenne, color: GRIS });
    return x + 11 + p.moyenne.widthOfTextAtSize(texte, 8) + 16;
  };
  cle(MATCHS, "Fiches de match", cle(PAGES, "Pages de la compétition", x0));
  page.drawLine({ start: { x: x0, y: bas }, end: { x: x0 + largeur, y: bas }, thickness: 0.75, color: TRAIT });

  if (jours.length === 0) {
    page.drawText("Aucune visite sur la période.", { x: x0, y: bas + hauteur / 2, size: 9, font: p.moyenne, color: GRIS_CLAIR });
    return;
  }
  const max = Math.max(1, ...jours.map((j) => j.pages + j.matchs));
  const pas = largeur / jours.length;
  const barre = Math.min(16, pas - 2);
  jours.forEach((j, i) => {
    const x = x0 + i * pas + (pas - barre) / 2;
    const hPages = (j.pages / max) * (hauteur - 14);
    const hMatchs = (j.matchs / max) * (hauteur - 14);
    if (hPages > 0) page.drawRectangle({ x, y: bas, width: barre, height: hPages, color: PAGES });
    // L'écart de surface entre les deux segments empilés.
    if (hMatchs > 0) page.drawRectangle({ x, y: bas + hPages + (hPages > 0 ? 1.5 : 0), width: barre, height: hMatchs, color: MATCHS });
  });
  page.drawText(`max ${max} / jour`, { x: x0 + largeur - p.moyenne.widthOfTextAtSize(`max ${max} / jour`, 7.5), y: haut - 8, size: 7.5, font: p.moyenne, color: GRIS_CLAIR });
  const court = (jour: string) => jourLisible(jour).replace(/ \d{4}$/, "");
  page.drawText(court(jours[0].jour), { x: x0, y: bas - 11, size: 7.5, font: p.moyenne, color: GRIS_CLAIR });
  if (jours.length > 1) {
    const fin = court(jours[jours.length - 1].jour);
    page.drawText(fin, { x: x0 + largeur - p.moyenne.widthOfTextAtSize(fin, 7.5), y: bas - 11, size: 7.5, font: p.moyenne, color: GRIS_CLAIR });
  }
}

function courbe(page: PDFPage, p: Polices, m: AudienceDeMatch, haut: number, hauteur: number) {
  const x0 = MARGE + 22;
  const largeur = LARGEUR - MARGE - x0;
  const bas = haut - hauteur;
  const points = m.resume.courbe;
  page.drawLine({ start: { x: x0, y: bas }, end: { x: x0 + largeur, y: bas }, thickness: 0.75, color: TRAIT });
  if (points.length < 2) {
    page.drawText("Pas assez de minutes suivies pour tracer une courbe.", { x: x0, y: bas + hauteur / 2, size: 9, font: p.moyenne, color: GRIS_CLAIR });
    return;
  }
  const debut = points[0].minute;
  const fin = points[points.length - 1].minute;
  const max = Math.max(1, ...points.map((pt) => pt.spectateurs));
  const x = (min: number) => x0 + ((min - debut) / (fin - debut)) * largeur;
  const y = (n: number) => bas + (n / max) * (hauteur - 16);

  page.drawLine({ start: { x: x0, y: y(max) }, end: { x: x0 + largeur, y: y(max) }, thickness: 0.5, color: TRAIT });
  page.drawText(nombreFr(max), { x: x0 - 6 - p.moyenne.widthOfTextAtSize(nombreFr(max), 7.5), y: y(max) - 2.5, size: 7.5, font: p.moyenne, color: GRIS_CLAIR });
  page.drawText("0", { x: x0 - 10, y: bas - 2.5, size: 7.5, font: p.moyenne, color: GRIS_CLAIR });

  // Les buts : un trait discret et leur libellé, à l'heure de leur saisie.
  for (const b of m.buts) {
    if (b.minute < debut || b.minute > fin) continue;
    page.drawLine({ start: { x: x(b.minute), y: bas }, end: { x: x(b.minute), y: bas + hauteur - 6 }, thickness: 0.5, color: GRIS_CLAIR });
    page.drawText(tenir(b.libelle, p.moyenne, 6.5, 70), { x: x(b.minute) + 2, y: bas + hauteur - 6, size: 6.5, font: p.moyenne, color: GRIS });
  }

  // L'aire en lavis, puis la ligne de 2 points.
  const chemin = [`M ${x(debut)} ${-y(0)}`, ...points.map((pt) => `L ${x(pt.minute)} ${-y(pt.spectateurs)}`), `L ${x(fin)} ${-y(0)} Z`].join(" ");
  page.drawSvgPath(chemin, { x: 0, y: 0, color: MATCHS, opacity: 0.1, borderWidth: 0 });
  for (let i = 1; i < points.length; i++) {
    page.drawLine({
      start: { x: x(points[i - 1].minute), y: y(points[i - 1].spectateurs) },
      end: { x: x(points[i].minute), y: y(points[i].spectateurs) },
      thickness: 2, color: MATCHS,
    });
  }
  const pic = m.resume.pic;
  if (pic) {
    page.drawCircle({ x: x(pic.minute), y: y(pic.spectateurs), size: 4.5, color: rgb(1, 1, 1) });
    page.drawCircle({ x: x(pic.minute), y: y(pic.spectateurs), size: 3, color: MATCHS });
  }
  // Une heure tous les quarts d'heure, six au plus.
  const pas = Math.max(15, Math.ceil((fin - debut) / 6 / 15) * 15);
  for (let min = Math.ceil(debut / pas) * pas; min <= fin; min += pas) {
    const h = heureDeMinute(min);
    page.drawText(h, { x: x(min) - p.moyenne.widthOfTextAtSize(h, 7.5) / 2, y: bas - 11, size: 7.5, font: p.moyenne, color: GRIS_CLAIR });
  }
}

/**
 * Le rapport. `plusSuivi` : l'audience détaillée du match au plus haut pic,
 * pour sa courbe ; `null` quand aucun direct n'a été suivi. `jeu` : les
 * statistiques de jeu, sur une seconde page ; aucune avant le premier match
 * joué.
 */
export async function rapportAudience(
  a: AudienceDeCompetition,
  plusSuivi: AudienceDeMatch | null,
  jeu: StatsDeJeu | null = null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Statistiques · ${a.nom}`);
  doc.setAuthor("KoppaFoot");
  doc.setCreator("KoppaFoot");
  const p = await lirePolices(doc);
  const [logo, marque] = await Promise.all([
    imageDistante(doc, a.logo),
    readFile(join(process.cwd(), "public/branding/logo_full_name.png")).then((o) => doc.embedPng(o)).catch(() => null),
  ]);
  const page = doc.addPage([LARGEUR, HAUTEUR]);
  let y = HAUTEUR - MARGE;

  // ---- L'en-tête
  const sousTitre = [a.organisateur ? `Organisé par ${a.organisateur}` : null, `Audience ${periodeLisible(a)}`].filter(Boolean).join(" · ");
  enTete(page, p, { surtitre: "RAPPORT D'AUDIENCE", nom: a.nom, sousTitre, logo, marque });
  y -= 70;

  // ---- Les chiffres clés, trois par ligne
  const t = a.totaux;
  const tuiles: [string, string, string?][] = [
    [nombreFr(t.visitesPages), "visites des pages de la compétition"],
    [nombreFr(t.visitesMatchs), "visites des fiches de ses matchs"],
    [nombreFr(t.pic?.spectateurs ?? 0), "spectateurs simultanés au plus haut", t.pic ? `${t.pic.affiche}, à ${heureDeMinute(t.pic.minute)}` : "aucun direct suivi"],
    [`${nombreFr(t.tempsMoyenMin)} min`, "passées en moyenne sur un direct"],
    [pourcent(t.partAppli), "des visites venues de l'appli", `${pourcent(t.partConnectee)} avec un compte KoppaFoot`],
    [nombreFr(t.abonnes), "abonnés à la compétition"],
  ];
  const lTuile = (LARGEUR - 2 * MARGE - 2 * 8) / 3;
  const hTuile = 62;
  tuiles.forEach(([valeur, libelle, detail], i) => {
    const x = MARGE + (i % 3) * (lTuile + 8);
    const yt = y - Math.floor(i / 3) * (hTuile + 8);
    page.drawRectangle({ x, y: yt - hTuile, width: lTuile, height: hTuile, color: FOND });
    page.drawText(valeur, { x: x + 10, y: yt - 28, size: 22, font: p.noire, color: ENCRE });
    page.drawText(tenir(libelle, p.moyenne, 8, lTuile - 20), { x: x + 10, y: yt - 42, size: 8, font: p.moyenne, color: GRIS });
    if (detail) page.drawText(tenir(detail, p.moyenne, 7, lTuile - 20), { x: x + 10, y: yt - 53, size: 7, font: p.moyenne, color: GRIS_CLAIR });
  });
  y -= 2 * hTuile + 8 + 28;

  // ---- Les visites par jour
  titreDeSection(page, p, "Visites par jour", y);
  y -= 22;
  barresParJour(page, p, a, y, 92);
  y -= 92 + 34;

  // ---- La courbe du match le plus suivi
  if (plusSuivi && plusSuivi.resume.courbe.length > 0) {
    titreDeSection(page, p, `Le match le plus suivi · ${plusSuivi.affiche}`, y);
    y -= 14;
    const pic = plusSuivi.resume.pic;
    if (pic) {
      page.drawText(`Spectateurs simultanés, minute par minute. Pic : ${pic.spectateurs} à ${heureDeMinute(pic.minute)}.`, { x: MARGE, y, size: 8, font: p.moyenne, color: GRIS });
    }
    y -= 12;
    courbe(page, p, plusSuivi, y, 100);
    y -= 100 + 34;
  }

  // ---- Les matchs les plus suivis
  const matchs = a.matchs.slice(0, 5);
  if (matchs.length > 0 && y > 150) {
    titreDeSection(page, p, "Les matchs les plus suivis", y);
    y -= 16;
    const colonnes = [
      { titre: "Match", x: MARGE, l: 230 },
      { titre: "Visites", x: MARGE + 240, l: 60 },
      { titre: "Pic", x: MARGE + 310, l: 50 },
      { titre: "Heure du pic", x: MARGE + 370, l: 70 },
      { titre: "Temps moyen", x: MARGE + 445, l: 62 },
    ];
    for (const c of colonnes) page.drawText(c.titre, { x: c.x, y, size: 7.5, font: p.grasse, color: GRIS_CLAIR });
    y -= 6;
    for (const m of matchs) {
      page.drawLine({ start: { x: MARGE, y }, end: { x: LARGEUR - MARGE, y }, thickness: 0.5, color: TRAIT });
      y -= 13;
      const valeurs = [
        m.affiche,
        nombreFr(m.visites),
        nombreFr(m.pic?.spectateurs ?? 0),
        m.pic ? heureDeMinute(m.pic.minute) : "—",
        m.tempsMoyenMin > 0 ? `${nombreFr(m.tempsMoyenMin)} min` : "—",
      ];
      valeurs.forEach((v, i) => page.drawText(tenir(v, i === 0 ? p.grasse : p.moyenne, 8.5, colonnes[i].l), {
        x: colonnes[i].x, y, size: 8.5, font: i === 0 ? p.grasse : p.moyenne, color: ENCRE,
      }));
      y -= 6;
    }
  }

  // ---- Ce que les chiffres comptent
  piedDePage(page, p, `Mesuré par KoppaFoot depuis le ${jourLisible(a.depuis)}. On compte des appareils, pas des personnes : une visite est un appareil, un jour, une page. Un spectateur en direct est un appareil dont la page du match était à l'écran pendant la minute ; un écran éteint ou un onglet en arrière-plan ne compte pas. Aucune donnée personnelle n'est utilisée.`);

  if (jeu && jeu.joues > 0) pageDuJeu(doc.addPage([LARGEUR, HAUTEUR]), p, a, jeu, logo, marque);

  return doc.save();
}
