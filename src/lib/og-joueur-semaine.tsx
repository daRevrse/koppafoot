import { ImageResponse } from "next/og";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chargerRessources } from "@/lib/og-da";

// ============================================
// L'affiche « Joueur de la semaine » : en publication (1080×1350), en vertical
// (1080×1920), et en calques pour la vidéo (le vertical, élément par élément).
//
// LA DIRECTION « COLLAGE », VALIDÉE LE 2026-10-19 : blanc, noir et vert
// KoppaFoot, jamais les couleurs du club, pas de grain. Le titre honore le
// joueur ; sa performance n'est qu'un détail en bout de ligne. Voir
// docs/superpowers/specs/2026-10-19-joueur-de-la-semaine-design.md.
//
// SATORI, PAS UN NAVIGATEUR : flexbox seulement, `display: flex` sur tout
// élément à plusieurs enfants, pas de dégradé radial (il a noirci toute la
// photo d'une maquette), pas de WebP. Satori ne mesure pas le texte : les
// longueurs se bornent ici, en caractères.
//
// UNE AFFICHE, DES CALQUES. La vidéo est l'affiche qui se monte : chaque
// élément se rend seul, à sa place, sur fond transparent, et le navigateur de
// l'administration les anime (voir lib/video-joueur-semaine). L'ordre des
// éléments ci-dessous est l'ordre d'empilement.
// ============================================

export type FormatAffiche = "publication" | "vertical";

export interface DonneesAffiche {
  /** Le nom tel que l'administration l'a validé ; mis en capitales au rendu. */
  nom: string;
  numeroSemaine: number;
  /** Une data URI JPEG ou PNG, déjà préparée (`preparerPhoto`), et AUTORISÉE ; null : l'avatar. */
  photo: string | null;
  /** Ses matchs, du plus ancien au plus récent. */
  lignes: { jour: string; competition: string; equipe: string; ecusson: string | null; affiche: string; detail: string }[];
  /** Ses équipes de la semaine, la plus récente d'abord. */
  ecussons: { equipe: string; logo: string | null }[];
  /** Deux au plus, en data URI. */
  partenaires: { annonceur: string; image: string | null }[];
}

/** Un calque de la vidéo : un élément seul, recadré sur ce qu'il occupe, et sa place. */
export interface CalqueVideo {
  cle: string;
  /** PNG en data URI. */
  png: string;
  left: number;
  top: number;
  w: number;
  h: number;
}

const W = 1080;
const BLANC = "#ffffff";
const NOIR = "#0b0b0b";
const VERT = "#10b981";
const VERT_TEXTE = "#047857";
const PHOTO_FOND = "#2b2b2b";
const TACHES_VERTES = ["#0ea371", "#1fc58f", "#0b9a69", "#14b884"];
const TACHES_NOIRES = ["#1f1f1f", "#0c0c0c", "#262626", "#2e2e2e"];

const MAX_ECUSSONS = 4;
const MAX_LIGNES = 4;
const MAX_PARTENAIRES = 2;
/** La hauteur de l'étiquette du nom. */
const ETIQUETTE = 88;
/** La hauteur de l'intitulé « MATCHS DE LA SEMAINE ». */
const INTITULE = 34;

// ─── Outils ──────────────────────────────────────────────────

const svg = (w: number, h: number, corps: string) =>
  `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${corps}</svg>`).toString("base64")}`;

function hasard(graine: number) {
  let g = graine;
  return () => (g = (g * 16807) % 2147483647) / 2147483647;
}

/** Un camouflage de taches serrées d'une même couleur. Graine fixe : deux affiches portent le même. */
function camo(w: number, h: number, fond: string, taches: string[], graine: number) {
  const r = hasard(graine);
  let s = `<rect width="${w}" height="${h}" fill="${fond}"/>`;
  for (let i = 0; i < (w * h) / 900; i++) {
    const cx = (r() * w).toFixed(0);
    const cy = (r() * h).toFixed(0);
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${(8 + r() * 34).toFixed(0)}" ry="${(5 + r() * 14).toFixed(0)}" transform="rotate(${(r() * 180).toFixed(0)} ${cx} ${cy})" fill="${taches[Math.floor(r() * taches.length)]}"/>`;
  }
  return svg(w, h, s);
}

/** Raccourci d'une ellipse pour tenir en `max` caractères. */
function raccourcir(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/**
 * Combien de caractères tiennent dans une ligne de match, à côté du détail.
 * Mesuré sur les rendus : ~16,5 px par capitale d'Outfit Black à 26 px,
 * ~12,5 px pour l'intitulé de compétition (15 px, espacé), ~13,2 px pour le
 * détail (18 px, espacé). Le détail « 1 BUT · 2 PASSES » prend la place de
 * sept capitales de plus que « 2 BUTS » : une limite fixe chevauchait.
 */
function placeDansLaLigne(largeurLignes: number, detail: string): { affiche: number; competition: number } {
  const jourEtEcusson = 150 + 44 + 16;
  const largeurDetail = detail ? detail.length * 13.2 + 16 : 0;
  const reste = largeurLignes - jourEtEcusson - largeurDetail;
  return { affiche: Math.floor(reste / 16.5), competition: Math.floor(reste / 12.5) };
}

/**
 * La taille des écussons de la colonne : ils tiennent au-dessus du bloc noir
 * de droite, qui monte de 120 px dans la photo. Quatre écussons sur une
 * semaine chargée, où la photo rapetisse, débordaient dessus.
 */
function tailleEcusson(n: number, hauteurPhoto: number, vertical: boolean): number {
  const place = hauteurPhoto - 120 - 10;
  return Math.min(vertical ? 92 : 88, Math.floor((place - 22 * (n - 1)) / Math.max(1, n)));
}

let avatar: Promise<string> | null = null;

/**
 * L'AVATAR, À LA PLACE D'UNE PHOTO QUI N'EST PAS AUTORISÉE : une silhouette
 * de footballeur au maillot vert, sans visage ni carnation, la même pour tous
 * (voir lib/consentement-image). Jamais des initiales : le propriétaire veut
 * un vrai avatar. Lu une fois par instance, et passé en PNG, que Satori lit
 * sans surprise.
 */
function chargerAvatar(): Promise<string> {
  // LE CHEMIN ÉCRIT EN ENTIER, comme dans lib/og-da : un chemin calculé ferait
  // embarquer tout le projet dans la fonction serveur.
  avatar ??= readFile(join(process.cwd(), "assets/joueur-semaine/avatar.svg"))
    .then((svg) => sharp(svg).png().toBuffer())
    .then((png) => `data:image/png;base64,${png.toString("base64")}`);
  return avatar;
}

/**
 * La taille du nom, de 44 à 32 px, puis l'ellipse. ~0,66 em par capitale
 * d'Outfit Black, plus l'espacement : mesuré sur les maquettes.
 */
function tailleDuNom(nom: string, largeur: number): { taille: number; texte: string } {
  for (let taille = 44; taille >= 32; taille -= 2) {
    if (nom.length * (taille * 0.66 + 3) <= largeur) return { taille, texte: nom };
  }
  return { taille: 32, texte: raccourcir(nom, Math.floor(largeur / (32 * 0.66 + 3))) };
}

const Img = ({ src, ...style }: { src: string } & React.CSSProperties) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt="" style={{ position: "absolute", ...style }} />
);

function Ecusson({ src, nom, taille }: { src: string | null; nom: string; taille: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={taille} height={taille} style={{ objectFit: "contain" }} />;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: taille, height: taille, borderRadius: taille / 2, border: `3px solid ${VERT}`, fontFamily: "Anton", fontSize: taille * 0.5, color: NOIR }}>
      {(nom.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}

// ─── La mise en page ─────────────────────────────────────────

interface Gabarit {
  H: number;
  photo: { x: number; y: number; w: number; h: number };
  bandeau: { y: number; h: number; taille: number };
  lignes: number;
  ligne: number;
  largeurLignes: number;
  pied: number;
}

/**
 * Tout se cale sur la photo, qui grandit quand la semaine a peu de matchs :
 * une semaine d'un seul match ne laisse pas de trou au-dessus du pied.
 *
 * Le vertical garde tout ce qui compte entre y = 150 et y = 1480 : au-dessus,
 * la barre de TikTok ; en dessous, la légende et les boutons.
 */
function gabarit(format: FormatAffiche, n: number): Gabarit {
  if (format === "publication") {
    const photo = { x: 188, y: 50, w: 640, h: 600 + (3 - n) * 45 };
    const bandeau = { y: photo.y + photo.h, h: 230, taille: 104 };
    const lignes = bandeau.y + bandeau.h + ETIQUETTE + 26;
    const pied = 1245;
    // Quatre lignes ne tiennent qu'en serrant.
    const ligne = Math.min(66, Math.floor((pied - 12 - lignes - INTITULE) / n));
    return { H: 1350, photo, bandeau, lignes, ligne, largeurLignes: 800, pied };
  }
  const photo = { x: 160, y: 190, w: 700, h: 580 + (3 - n) * 60 };
  const bandeau = { y: photo.y + photo.h, h: 230, taille: 108 };
  const lignes = bandeau.y + bandeau.h + ETIQUETTE + 26;
  const ligne = 70;
  return { H: 1920, photo, bandeau, lignes, ligne, largeurLignes: 780, pied: lignes + INTITULE + n * ligne + 22 };
}

/**
 * Les lignes affichées : toutes jusqu'à quatre ; au-delà, les trois plus
 * récentes et « + N AUTRES MATCHS ».
 */
function lignesAffichees(lignes: DonneesAffiche["lignes"]): (DonneesAffiche["lignes"][number] | { autres: number })[] {
  if (lignes.length <= MAX_LIGNES) return lignes;
  return [...lignes.slice(-(MAX_LIGNES - 1)), { autres: lignes.length - (MAX_LIGNES - 1) }];
}

function Affiche({ d, format, logoKf, avatarPng, couche }: {
  d: DonneesAffiche; format: FormatAffiche; logoKf: string; avatarPng: string;
  /** Un seul élément, pour la vidéo. Absent : l'affiche entière. */
  couche?: string;
}) {
  const lignes = lignesAffichees(d.lignes);
  const g = gabarit(format, lignes.length);
  const { photo: p, bandeau: b } = g;
  const vertical = format === "vertical";
  const voir = (cle: string) => !couche || couche === cle;
  const voirGroupe = (prefixe: string) => !couche || couche.startsWith(prefixe);
  const blocNoir = camo(280, 600, "#141414", TACHES_NOIRES, 37);
  const nom = tailleDuNom(d.nom.toUpperCase(), 700);
  const partenaires = d.partenaires.slice(0, MAX_PARTENAIRES);
  const zonePartenaire = { width: vertical ? 260 : 240, height: 76 };

  return (
    <div style={{ position: "relative", display: "flex", width: W, height: g.H, backgroundColor: voir("fond") ? BLANC : "transparent" }}>
      {/* La bande verte et le bloc noir du haut. */}
      {voir("bande") && <Img src={camo(70, p.y + 420, VERT, TACHES_VERTES.slice(0, 3), 41)} top={0} left={p.x - 70} width={70} height={p.y + 420} />}
      {voir("blocHaut") && <Img src={blocNoir} top={0} left={p.x - 128} width={200} height={vertical ? 120 : 60} />}
      {voir("semaine") && (
        <div style={{ position: "absolute", top: p.y + 200, left: p.x - 300, width: 380, display: "flex", justifyContent: "center", transform: "rotate(-90deg)", fontFamily: "Outfit", fontWeight: 700, fontSize: 20, letterSpacing: 8, color: VERT_TEXTE, whiteSpace: "nowrap" }}>
          {`/// SEMAINE ${d.numeroSemaine}`}
        </div>
      )}
      {/* Les écussons de ses équipes, en colonne en haut à droite. */}
      {voirGroupe("ecusson") && (
        <div style={{ position: "absolute", top: p.y + 10, left: p.x + p.w, width: W - p.x - p.w, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {d.ecussons.slice(0, MAX_ECUSSONS).map((e, i, liste) => (
            <div key={i} style={{ display: "flex", marginBottom: 22, opacity: voir(`ecusson-${i}`) ? 1 : 0 }}>
              <Ecusson src={e.logo} nom={e.equipe} taille={tailleEcusson(liste.length, p.h, vertical)} />
            </div>
          ))}
        </div>
      )}
      {/* Le bloc noir de droite, derrière le bandeau : il s'arrête avec le nom. */}
      {voir("blocDroite") && <Img src={blocNoir} top={p.y + p.h - 120} left={p.x + p.w - 188} width={280} height={120 + b.h + ETIQUETTE} />}
      {/* La photo autorisée sur son rectangle sombre, ou l'avatar. */}
      {voir("photo") && (
        <div style={{ position: "absolute", top: p.y, left: p.x, width: p.w, height: p.h, display: "flex", overflow: "hidden", backgroundColor: PHOTO_FOND }}>
          {d.photo ? (
            <Img src={d.photo} top={0} left={0} width={p.w} height={p.h} objectFit="cover" objectPosition="center top" />
          ) : (
            <Img src={avatarPng} top={0} left={0} width={p.w} height={p.h} objectFit="cover" objectPosition="center 30%" />
          )}
          <div style={{ position: "absolute", bottom: 0, left: 0, width: p.w, height: 150, backgroundImage: `linear-gradient(180deg, rgba(43,43,43,0), ${PHOTO_FOND})` }} />
        </div>
      )}
      {/* Le bandeau : l'honneur, pas l'exploit. */}
      {voir("bandeau") && (
        <div style={{ position: "absolute", top: b.y, left: p.x - 88, width: 800, height: b.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <Img src={camo(800, b.h, VERT, TACHES_VERTES, 31)} top={0} left={0} width={800} height={b.h} />
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: b.taille, lineHeight: 1, color: NOIR }}>JOUEUR DE</div>
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: b.taille, lineHeight: 1, color: NOIR }}>LA SEMAINE</div>
        </div>
      )}
      {/* L'étiquette du nom. */}
      {voir("nom") && (
        <div style={{ position: "absolute", top: b.y + b.h, left: p.x, height: ETIQUETTE, display: "flex", alignItems: "center", backgroundColor: NOIR, padding: "0 28px", fontFamily: "Outfit", fontWeight: 900, fontSize: nom.taille, letterSpacing: 3, color: "#ffffff", whiteSpace: "nowrap" }}>
          {nom.texte}
        </div>
      )}
      {/* Les matchs de la semaine, un par ligne ; la performance en bout de ligne. */}
      {(voirGroupe("label") || voirGroupe("ligne")) && (
        <div style={{ position: "absolute", top: g.lignes, left: p.x - 88, width: g.largeurLignes, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", height: INTITULE, fontFamily: "Outfit", fontWeight: 700, fontSize: 17, letterSpacing: 6, color: "#8a8a8a", opacity: voir("label") ? 1 : 0 }}>
            MATCHS DE LA SEMAINE
          </div>
          {lignes.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", height: g.ligne, borderTop: "2px solid #dedede", opacity: voir(`ligne-${i}`) ? 1 : 0 }}>
              {"autres" in l ? (
                <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 700, fontSize: 18, letterSpacing: 3, color: "#666666" }}>
                  {`+ ${l.autres} AUTRES MATCHS`}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                  <div style={{ display: "flex", width: 150, fontFamily: "Outfit", fontWeight: 700, fontSize: 18, letterSpacing: 1, color: "#666666", whiteSpace: "nowrap" }}>{l.jour}</div>
                  <Ecusson src={l.ecusson} nom={l.equipe} taille={44} />
                  <div style={{ display: "flex", flexDirection: "column", marginLeft: 16, flex: 1 }}>
                    <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 700, fontSize: 15, letterSpacing: 3, color: "#8a8a8a", whiteSpace: "nowrap" }}>
                      {raccourcir(l.competition.toUpperCase(), placeDansLaLigne(g.largeurLignes, l.detail).competition)}
                    </div>
                    <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 900, fontSize: 26, color: "#1b1b1b", whiteSpace: "nowrap" }}>
                      {raccourcir(l.affiche.toUpperCase(), placeDansLaLigne(g.largeurLignes, l.detail).affiche)}
                    </div>
                  </div>
                  {l.detail ? (
                    <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 700, fontSize: 18, letterSpacing: 2, color: VERT_TEXTE, whiteSpace: "nowrap" }}>{l.detail}</div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Le pied : la marque, et les partenaires s'il y en a. Jamais de cadre vide. */}
      {voir("pied") && (
        <div style={{ position: "absolute", top: g.pied, left: 60, width: vertical ? 840 : W - 120, height: vertical ? 76 : 90, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoKf} alt="" width={vertical ? 150 : 170} height={vertical ? 75 : 85} />
          <div style={{ display: "flex", gap: 40 }}>
            {partenaires.map((pa, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center", ...zonePartenaire }}>
                {pa.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pa.image} alt="" width={zonePartenaire.width} height={zonePartenaire.height} style={{ objectFit: "contain" }} />
                ) : (
                  <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 900, fontSize: 24, color: "#1b1b1b", whiteSpace: "nowrap" }}>
                    {raccourcir(pa.annonceur.toUpperCase(), 16)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Les rendus ──────────────────────────────────────────────

/** L'affiche entière, en PNG. */
export async function afficheJoueurSemaine(d: DonneesAffiche, format: FormatAffiche): Promise<Buffer> {
  const { fonts, logo } = await chargerRessources();
  const H = format === "vertical" ? 1920 : 1350;
  const r = new ImageResponse(<Affiche d={d} format={format} logoKf={logo} avatarPng={await chargerAvatar()} />, { width: W, height: H, fonts });
  return Buffer.from(await r.arrayBuffer());
}

/** Les clés des calques de la vidéo, dans l'ordre d'empilement. */
export function clesDesCalques(d: DonneesAffiche): string[] {
  return [
    "fond", "bande", "blocHaut", "semaine",
    ...d.ecussons.slice(0, MAX_ECUSSONS).map((_, i) => `ecusson-${i}`),
    "blocDroite", "photo", "bandeau", "nom", "label",
    ...lignesAffichees(d.lignes).map((_, i) => `ligne-${i}`),
    "pied",
  ];
}

/**
 * Le vertical, élément par élément, chacun recadré sur ce qu'il occupe. Le
 * fond reste entier : c'est la toile.
 */
export async function calquesJoueurSemaine(d: DonneesAffiche): Promise<CalqueVideo[]> {
  const { fonts, logo } = await chargerRessources();
  const avatarPng = await chargerAvatar();
  const calques: CalqueVideo[] = [];
  for (const cle of clesDesCalques(d)) {
    const r = new ImageResponse(<Affiche d={d} format="vertical" logoKf={logo} avatarPng={avatarPng} couche={cle} />, { width: W, height: 1920, fonts });
    const png = Buffer.from(await r.arrayBuffer());
    if (cle === "fond") {
      calques.push({ cle, png: `data:image/png;base64,${png.toString("base64")}`, left: 0, top: 0, w: W, h: 1920 });
      continue;
    }
    try {
      const { data, info } = await sharp(png).trim().png().toBuffer({ resolveWithObject: true });
      calques.push({
        cle,
        png: `data:image/png;base64,${data.toString("base64")}`,
        left: -(info.trimOffsetLeft ?? 0),
        top: -(info.trimOffsetTop ?? 0),
        w: info.width,
        h: info.height,
      });
    } catch {
      // Un calque entièrement vide ne se recadre pas : il n'a rien à montrer.
    }
  }
  return calques;
}

/**
 * La photo, prête pour l'affiche : les photos d'effectif sont des photos de
 * téléphone d'environ 383×512, agrandies ici à 1000 px de large, un peu plus
 * contrastées et plus nettes. Satori ne sait rien faire de tout ça.
 */
export async function preparerPhoto(contenu: Buffer): Promise<string> {
  const jpeg = await sharp(contenu)
    .rotate()
    .resize({ width: 1000, kernel: "lanczos3" })
    .modulate({ saturation: 1.08 })
    .linear(1.12, -12)
    .sharpen({ sigma: 1.2 })
    .jpeg({ quality: 92 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
