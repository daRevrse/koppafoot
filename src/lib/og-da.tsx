import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { imageSure } from "@/lib/image-sure";

// ============================================
// La direction artistique des images qu'on partage.
//
// DEUX FAMILLES, UNE SEULE ALLURE. Les flyers d'un match (lib/og-flyer), en
// portrait, qu'on poste en statut ; les aperçus de lien (lib/og), en paysage,
// que WhatsApp déplie sous une adresse. Les seconds avaient gardé un premier
// dessin — police par défaut, halo en dégradé, « KoppaFoot » en minuscules
// fines — qui ne ressemblait ni aux flyers ni au produit. Tout ce qui fait
// l'allure vit donc ici, et les deux familles le tirent du même endroit.
//
// L'ALLURE : un cadre d'éclats en trois verts autour d'une carte nuit, le logo
// vert, les titres en ANTON (une capitale très condensée, fendue en
// diagonale), le reste en OUTFIT, la police d'affichage du produit, en
// capitales. A PLAT, SANS DÉGRADÉ : une image partagée passe par trois
// compressions avant d'arriver sur un téléphone, et un dégradé en ressort en
// marches d'escalier.
//
// SATORI, PAS UN NAVIGATEUR : flexbox seulement, et tout élément à plusieurs
// enfants doit déclarer `display: flex`.
// ============================================

export const NUIT = "#080d0b";
export const EMERAUDE = "#34d399";
export const GRIS = "#9ba6a1";
export const ROUGE_DIRECT = "#f87171";
/** Le vert du cadre, derrière les éclats. */
const FORET = "#064e3b";

// ─── Ressources ─────────────────────────────────────────────

export interface Fonte {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 700 | 900;
  style: "normal";
}

let ressources: Promise<{ fonts: Fonte[]; logo: string }> | null = null;

/**
 * Les polices et le logo, lus une fois par instance.
 *
 * ANTON pour les titres : c'est elle qui fait l'affiche. OUTFIT pour le reste,
 * pour que l'image parle comme l'appli. Sans elles, Satori retombe sur sa
 * seule police embarquée, en un seul poids : c'est ce qui rendait le nom du
 * produit si maigre sur l'ancien aperçu.
 */
export function chargerRessources() {
  ressources ??= (async () => {
    // CHAQUE CHEMIN ÉCRIT EN ENTIER. Un `join(process.cwd(), variable)` fait
    // tracer tout le projet dans la fonction serveur : Turbopack ne peut pas
    // savoir quel fichier la variable désignera, il les embarque tous.
    const [anton, medium, bold, black, logo] = await Promise.all([
      readFile(join(process.cwd(), "assets/fonts/Anton-Regular.ttf")),
      readFile(join(process.cwd(), "assets/fonts/Outfit-Medium.ttf")),
      readFile(join(process.cwd(), "assets/fonts/Outfit-Bold.ttf")),
      readFile(join(process.cwd(), "assets/fonts/Outfit-Black.ttf")),
      readFile(join(process.cwd(), "public/branding/logo_full_name.png")),
    ]);
    return {
      fonts: [
        { name: "Anton", data: anton, weight: 400, style: "normal" },
        { name: "Outfit", data: medium, weight: 500, style: "normal" },
        { name: "Outfit", data: bold, weight: 700, style: "normal" },
        { name: "Outfit", data: black, weight: 900, style: "normal" },
      ] satisfies Fonte[],
      logo: `data:image/png;base64,${logo.toString("base64")}`,
    };
  })();
  return ressources;
}

/** Ce qu'on accepte de poser dans une image : des images, et rien d'autre. */
const TYPES_IMAGE = /^image\/(png|jpeg|webp|gif)$/;

/**
 * Un logo distant (écusson, logo de compétition), téléchargé ICI plutôt que
 * laissé à Satori.
 *
 * Satori télécharge lui-même un `<img src>` distant, et une adresse qui ne
 * répond pas fait alors échouer l'image entière : le lien repartirait sans
 * vignette pour un écusson manquant. Téléchargé d'abord, un logo absent
 * retombe sur l'initiale du club, et l'aperçu part quand même.
 *
 * Seuls les hôtes du Storage du projet sont acceptés (voir `imageSure`) :
 * le champ vient d'un document, et une adresse arbitraire ferait émettre au
 * serveur une requête vers où l'on veut.
 */
export async function imageDistante(url: string | null | undefined): Promise<string | null> {
  const sure = imageSure(url);
  if (!sure) return null;
  try {
    const r = await fetch(sure, { signal: AbortSignal.timeout(4000) });
    const type = r.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!r.ok || !TYPES_IMAGE.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

// ─── Le cadre ───────────────────────────────────────────────

const motifs = new Map<string, string>();

/**
 * Des éclats en trois verts, tirés d'une graine fixe : deux images du même
 * produit portent le même cadre, comme deux affiches d'une même saison.
 * Seule la bande du cadre en reçoit, la carte couvre le reste.
 */
export function motifEclats(w: number, h: number, cadre: number): string {
  const cle = `${w}x${h}:${cadre}`;
  const connu = motifs.get(cle);
  if (connu) return connu;

  let graine = 11;
  const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
  const couleurs = ["#10b981", "#10b981", "#34d399", "#047857", "#022c22"];
  const angles = [-60, -30, 30, 60, 120, 150];
  const formes: string[] = [];

  for (let y = -60; y < h + 60; y += 58) {
    for (let x = -60; x < w + 60; x += 58) {
      const dansLaBande = x < cadre + 40 || x > w - cadre - 40 || y < cadre + 40 || y > h - cadre - 40;
      if (!dansLaBande || hasard() < 0.25) continue;
      const long = 110 + hasard() * 120;
      const large = 34 + hasard() * 34;
      const angle = angles[Math.floor(hasard() * angles.length)];
      const couleur = couleurs[Math.floor(hasard() * couleurs.length)];
      // Une pointe de flèche : large à l'arrière, effilée devant, encochée.
      const p = `0,0 ${long},${large / 2} 0,${large} ${long * 0.28},${large / 2}`;
      formes.push(
        `<polygon points="${p}" fill="${couleur}" transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${angle})"/>`,
      );
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${FORET}"/>${formes.join("")}</svg>`;
  const motif = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  motifs.set(cle, motif);
  return motif;
}

/** Le cadre d'éclats et la carte nuit posée dessus. Les enfants vont dans la carte, en colonne. */
export function FondEclats({ largeur, hauteur, cadre, padding, children }: {
  largeur: number;
  hauteur: number;
  cadre: number;
  padding: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", backgroundColor: FORET }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={motifEclats(largeur, hauteur, cadre)} alt="" width={largeur} height={hauteur} style={{ position: "absolute", top: 0, left: 0 }} />
      <div
        style={{
          position: "absolute",
          top: cadre,
          left: cadre,
          right: cadre,
          bottom: cadre,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: NUIT,
          padding,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Les briques ────────────────────────────────────────────

/**
 * Un titre en Anton, fendu en diagonale.
 *
 * Deux fois le même mot, chacun rogné d'un côté de la coupe, le second
 * légèrement décalé : c'est le décalage qui fait lire une entaille, pas un
 * trait posé dessus.
 *
 * `chasse` est la largeur du texte en em, MESURÉE SUR LA POLICE : Satori ne
 * dit pas combien un texte mesure, et la coupe doit traverser le mot d'un
 * bord à l'autre. Elle est EN PIXELS : Satori rapporte les pourcentages
 * horizontaux d'un `clipPath` à la HAUTEUR de la boîte.
 */
export function TitreFendu({ texte, chasse, taille, marge = 10 }: {
  texte: string;
  chasse: number;
  taille: number;
  marge?: number;
}) {
  const w = Math.ceil(chasse * taille);
  const h = taille;
  // La coupe monte de gauche à droite, et laisse un jour de 6 px.
  const [gauche, droite, jour] = [h * 0.84, h * 0.12, 3];
  const lettres = {
    position: "absolute",
    top: 0,
    left: 0,
    display: "flex",
    width: w,
    height: h,
    fontFamily: "Anton",
    fontSize: taille,
    lineHeight: 1,
    color: "#ffffff",
    whiteSpace: "nowrap",
  } as const;
  return (
    <div style={{ position: "relative", display: "flex", width: w, height: h, marginTop: marge }}>
      <div style={{ ...lettres, clipPath: `polygon(0px 0px, ${w}px 0px, ${w}px ${droite - jour}px, 0px ${gauche - jour}px)` }}>
        {texte}
      </div>
      <div
        style={{
          ...lettres,
          top: 5,
          left: 6,
          clipPath: `polygon(0px ${gauche + jour}px, ${w}px ${droite + jour}px, ${w}px ${h}px, 0px ${h}px)`,
        }}
      >
        {texte}
      </div>
    </div>
  );
}

/** « M A T C H   A M I C A L » : des capitales très espacées. */
export function Espace({ texte, taille = 28, espacement = 16, couleur = "#ffffff", marge = 18 }: {
  texte: string;
  taille?: number;
  espacement?: number;
  couleur?: string;
  marge?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        marginTop: marge,
        fontFamily: "Outfit",
        fontWeight: 700,
        fontSize: taille,
        letterSpacing: espacement,
        color: couleur,
        textTransform: "uppercase",
      }}
    >
      {texte}
    </div>
  );
}

/** L'écusson tel quel, ou l'initiale du club quand il n'en a pas. */
export function Ecusson({ nom, logo, taille }: { nom: string; logo: string | null; taille: number }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" width={taille} height={taille} style={{ objectFit: "contain" }} />;
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: taille,
        height: taille,
        borderRadius: taille / 2,
        border: `6px solid ${EMERAUDE}`,
        fontFamily: "Anton",
        fontSize: taille * 0.46,
        color: "#ffffff",
      }}
    >
      {(nom.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}

/** Un camp : son écusson, son nom en capitales dessous. */
export function Camp({ nom, logo, taille, largeur = 290, children }: {
  nom: string;
  logo: string | null;
  taille: number;
  largeur?: number;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: largeur }}>
      <Ecusson nom={nom} logo={logo} taille={taille} />
      <div
        style={{
          display: "flex",
          marginTop: 22,
          fontFamily: "Outfit",
          fontWeight: 900,
          fontSize: nom.length > 18 ? 26 : 30,
          lineHeight: 1.15,
          color: "#ffffff",
          textAlign: "center",
          textTransform: "uppercase",
        }}
      >
        {nom}
      </div>
      {children}
    </div>
  );
}

/** L'adresse, la seule signature qui reste à une image transférée trois fois. */
export function Pied({ marge = 34 }: { marge?: number }) {
  return (
    <div
      style={{
        display: "flex",
        marginTop: marge,
        fontFamily: "Outfit",
        fontWeight: 700,
        fontSize: 26,
        letterSpacing: 3,
        color: EMERAUDE,
      }}
    >
      www.koppafoot.com
    </div>
  );
}

/**
 * « dimanche 12 octobre 2026 » et « 15H00 » : sur une affiche, le jour et
 * l'heure se cherchent séparément.
 */
export function quand(date: string, time: string): { jour: string; heure: string } {
  const d = new Date(`${date}T${time || "00:00"}`);
  const heure = time ? time.replace(":", "H") : "";
  if (!date || Number.isNaN(d.getTime())) return { jour: date, heure };
  const jour = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return { jour, heure };
}
