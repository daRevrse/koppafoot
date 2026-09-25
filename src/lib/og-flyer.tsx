import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ButeursDuMatch, Buteur } from "@/lib/buteurs";

// ============================================
// Les flyers d'un match : « MATCHDAY » avant, « SCORE FINAL » après.
//
// PORTRAIT 4:5, 1080×1350. C'est le format d'une affiche qu'on poste sur
// Instagram ou en statut WhatsApp : l'image y tient en entier, là où un
// paysage se fait recadrer par le milieu et perd les deux écussons.
//
// A PLAT, SANS DÉGRADÉ. Un fond uni, un cadre d'éclats en trois verts francs,
// du blanc pour ce qui se lit. Une affiche partagée passe par trois
// compressions avant d'arriver sur un téléphone, et un dégradé en ressort en
// marches d'escalier.
//
// EN TÊTE, LE LOGO DE LA COMPÉTITION : c'est elle qu'on annonce, et son
// organisateur qui partage. Celui de Koppafoot le remplace quand il n'y en a
// pas — un amical, une compétition sans logo. L'adresse, elle, reste en pied
// dans tous les cas : un flyer circule sans son lien, et c'est la seule
// signature qui reste à quelqu'un qui le reçoit transféré trois fois.
//
// SATORI, PAS UN NAVIGATEUR : flexbox seulement, et tout élément à plusieurs
// enfants doit déclarer `display: flex`.
// ============================================

export const TAILLE_FLYER = { width: 1080, height: 1350 };

const NUIT = "#080d0b";
const EMERAUDE = "#34d399";
const GRIS = "#9ba6a1";

/** L'épaisseur du cadre d'éclats autour de la carte. */
const CADRE = 60;

// ─── Ressources ─────────────────────────────────────────────

let ressources: Promise<{ fonts: Fonte[]; logo: string }> | null = null;

interface Fonte {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 700 | 900;
  style: "normal";
}

/**
 * Les polices et le logo, lus une fois par instance.
 *
 * ANTON pour le titre : l'affiche de référence tient sur une capitale très
 * condensée, et c'est elle qui fait l'affiche. OUTFIT pour le reste, la
 * police d'affichage du produit, pour que le flyer parle comme l'appli.
 */
function chargerRessources() {
  ressources ??= (async () => {
    const lire = (f: string) => readFile(join(process.cwd(), f));
    const [anton, medium, bold, black, logo] = await Promise.all([
      lire("assets/fonts/Anton-Regular.ttf"),
      lire("assets/fonts/Outfit-Medium.ttf"),
      lire("assets/fonts/Outfit-Bold.ttf"),
      lire("assets/fonts/Outfit-Black.ttf"),
      lire("public/branding/logo_full_name.png"),
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


// ─── Le cadre ───────────────────────────────────────────────

/**
 * Des éclats en trois verts, à la place du motif rouge et bleu de la
 * référence. Tirés d'une graine fixe : deux flyers du même produit portent
 * le même cadre, comme deux affiches d'une même saison.
 */
function motifCadre(): string {
  const { width: w, height: h } = TAILLE_FLYER;
  let graine = 11;
  const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
  const couleurs = ["#10b981", "#10b981", "#34d399", "#047857", "#022c22"];
  const angles = [-60, -30, 30, 60, 120, 150];
  const formes: string[] = [];

  for (let y = -60; y < h + 60; y += 58) {
    for (let x = -60; x < w + 60; x += 58) {
      // Seule la bande du cadre se voit, la carte couvre le reste.
      const dansLaBande = x < CADRE + 40 || x > w - CADRE - 40 || y < CADRE + 40 || y > h - CADRE - 40;
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
    `<rect width="${w}" height="${h}" fill="#064e3b"/>${formes.join("")}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

let motif: string | null = null;

function Cadre({ logo, logoCompetition, children }: {
  logo: string;
  logoCompetition: string | null;
  children: React.ReactNode;
}) {
  motif ??= motifCadre();
  return (
    <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", backgroundColor: "#064e3b" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={motif} alt="" width={TAILLE_FLYER.width} height={TAILLE_FLYER.height} style={{ position: "absolute", top: 0, left: 0 }} />
      <div
        style={{
          position: "absolute",
          top: CADRE,
          left: CADRE,
          right: CADRE,
          bottom: CADRE,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: NUIT,
          padding: "48px 56px 40px",
        }}
      >
        {logoCompetition ? (
          // Posé dans une boîte, pas à sa taille : les logos de compétition
          // n'ont pas de format, un écusson haut côtoie un bandeau large.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoCompetition} alt="" width={320} height={150} style={{ objectFit: "contain" }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="KoppaFoot" width={236} height={118} />
        )}
        {children}
        <Pied />
      </div>
    </div>
  );
}

// ─── Les briques ────────────────────────────────────────────

/** La largeur utile de la carte, cadre et marges déduits. */
const LARGEUR_UTILE = TAILLE_FLYER.width - 2 * CADRE - 2 * 56;

/**
 * La chasse des deux titres en Anton, en em, mesurée sur la police : Satori
 * ne dit pas combien un texte mesure, et un titre trop large passe à la
 * ligne — « SCORE » d'un côté, « FINAL » de l'autre — au lieu de rétrécir.
 */
const CHASSE = { MATCHDAY: 4.025, "SCORE FINAL": 4.551 } as const;

/**
 * Le titre, fendu en diagonale comme sur la référence.
 *
 * Deux fois le même mot, chacun rogné d'un côté de la coupe, le second
 * légèrement décalé : c'est le décalage qui fait lire une entaille, pas un
 * trait posé dessus.
 *
 * LA COUPE EST EN PIXELS. Satori rapporte les pourcentages horizontaux d'un
 * `clipPath` à la HAUTEUR de la boîte : « 100% » s'arrêtait au premier tiers
 * du mot. La boîte a donc des dimensions explicites, et la coupe s'y écrit en
 * coordonnées.
 */
function TitreFendu({ texte }: { texte: keyof typeof CHASSE }) {
  // 24 px de marge : le second morceau est decale et ne doit pas toucher le bord.
  const taille = Math.min(204, Math.floor((LARGEUR_UTILE - 24) / CHASSE[texte]));
  const w = Math.ceil(CHASSE[texte] * taille);
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
    <div style={{ position: "relative", display: "flex", width: w, height: h, marginTop: 10 }}>
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

/** « M A T C H   A M I C A L », sous le titre. */
function Espace({ texte }: { texte: string }) {
  return (
    <div
      style={{
        display: "flex",
        marginTop: 18,
        fontFamily: "Outfit",
        fontWeight: 700,
        fontSize: 28,
        letterSpacing: 16,
        color: "#ffffff",
        textTransform: "uppercase",
      }}
    >
      {texte}
    </div>
  );
}

/** Le petit surtitre au-dessus du titre, en vert : la journée, le tour. */
function Surtitre({ texte }: { texte: string }) {
  return (
    <div
      style={{
        display: "flex",
        marginTop: 34,
        fontFamily: "Outfit",
        fontWeight: 900,
        fontSize: 30,
        letterSpacing: 4,
        color: EMERAUDE,
        textTransform: "uppercase",
      }}
    >
      {texte}
    </div>
  );
}

/** L'écusson tel quel, ou l'initiale du club quand il n'en a pas. */
function Ecusson({ nom, logo, taille }: { nom: string; logo: string | null; taille: number }) {
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

function Camp({ nom, logo, taille, children }: {
  nom: string;
  logo: string | null;
  taille: number;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 290 }}>
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

/** Le pied de carte : l'adresse, et rien d'autre. */
function Pied() {
  return (
    <div
      style={{
        display: "flex",
        marginTop: 34,
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

// ─── Les deux flyers ────────────────────────────────────────

export interface FlyerCamp {
  nom: string;
  logo: string | null;
}

export interface FlyerMatch {
  /** Au-dessus du titre : « JOURNÉE 3 », « MATCH RETOUR ». Vide, rien. */
  surtitre: string;
  /**
   * « MATCH AMICAL » sous le titre, pour un amical seulement. Un match
   * officiel n'a rien à préciser : le logo de sa compétition, en tête, le dit.
   */
  amical: boolean;
  /** En tête. Absent, c'est le logo de Koppafoot. */
  logoCompetition: string | null;
  home: FlyerCamp;
  away: FlyerCamp;
  /** AAAA-MM-JJ et HH:MM, tels que les documents les portent. */
  date: string;
  time: string;
  lieu: string;
}

/** AVANT : l'affiche qui fait venir du monde. */
export async function flyerMatchDay(m: FlyerMatch): Promise<ImageResponse> {
  const { fonts, logo } = await chargerRessources();
  return new ImageResponse(<MatchDay m={m} logo={logo} />, { ...TAILLE_FLYER, fonts });
}

/** APRÈS : le score, et ceux qui l'ont fait. */
export async function flyerScoreFinal(m: FlyerResultat): Promise<ImageResponse> {
  const { fonts, logo } = await chargerRessources();
  return new ImageResponse(<ScoreFinal m={m} logo={logo} />, { ...TAILLE_FLYER, fonts });
}

function MatchDay({ m, logo }: { m: FlyerMatch; logo: string }) {
  const { jour, heure } = quand(m.date, m.time);
  return (
    <Cadre logo={logo} logoCompetition={m.logoCompetition}>
      {m.surtitre ? <Surtitre texte={m.surtitre} /> : <div style={{ display: "flex", height: 30 }} />}
      <TitreFendu texte="MATCHDAY" />
      {m.amical && <Espace texte="Match amical" />}

      {/* Au milieu de la place qui reste, pas colles au titre : le bloc des
          camps flotte entre l'annonce et le rendez-vous, comme sur la
          reference. */}
      <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 28 }}>
        <Camp {...m.home} taille={210} />
        <div style={{ display: "flex", height: 210, alignItems: "center", fontFamily: "Anton", fontSize: 96, color: EMERAUDE }}>
          V
        </div>
        <Camp {...m.away} taille={210} />
      </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          marginTop: "auto",
          fontFamily: "Outfit",
          fontWeight: 900,
          fontSize: 36,
          color: "#ffffff",
          textTransform: "uppercase",
        }}
      >
        {m.lieu && <div style={{ display: "flex" }}>{m.lieu}</div>}
        {jour && <div style={{ display: "flex" }}>{jour}</div>}
        {heure && <div style={{ display: "flex", color: EMERAUDE }}>{heure}</div>}
      </div>

    </Cadre>
  );
}

export interface FlyerResultat extends FlyerMatch {
  scoreHome: number;
  scoreAway: number;
  buteurs: ButeursDuMatch;
}

function ScoreFinal({ m, logo }: { m: FlyerResultat; logo: string }) {
  const { jour } = quand(m.date, m.time);
  return (
    <Cadre logo={logo} logoCompetition={m.logoCompetition}>
      {m.surtitre ? <Surtitre texte={m.surtitre} /> : <div style={{ display: "flex", height: 30 }} />}
      <TitreFendu texte="SCORE FINAL" />
      {m.amical && <Espace texte="Match amical" />}

      <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 6 }}>
        <Camp {...m.home} taille={176}>
          <ListeButeurs buteurs={m.buteurs.home} />
        </Camp>
        <div
          style={{
            display: "flex",
            height: 176,
            alignItems: "center",
            gap: 16,
            fontFamily: "Anton",
            fontSize: 140,
            lineHeight: 1,
            color: "#ffffff",
          }}
        >
          <div style={{ display: "flex" }}>{m.scoreHome}</div>
          <div style={{ display: "flex", width: 34, height: 10, backgroundColor: EMERAUDE }} />
          <div style={{ display: "flex" }}>{m.scoreAway}</div>
        </div>
        <Camp {...m.away} taille={176}>
          <ListeButeurs buteurs={m.buteurs.away} />
        </Camp>
      </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          marginTop: "auto",
          fontFamily: "Outfit",
          fontWeight: 900,
          fontSize: 30,
          color: "#ffffff",
          textTransform: "uppercase",
        }}
      >
        {m.lieu && <div style={{ display: "flex" }}>{m.lieu}</div>}
        {jour && <div style={{ display: "flex", color: GRIS }}>{jour}</div>}
      </div>

    </Cadre>
  );
}

/** Au-delà, la liste déborderait sur le lieu : le reste se compte. */
const BUTEURS_MAX = 5;

/**
 * Les buteurs d'un camp, sous son écusson.
 *
 * Un camp qui n'a pas marqué ne montre RIEN, pas un « aucun buteur » : le
 * zéro est déjà au score, en grand.
 */
function ListeButeurs({ buteurs }: { buteurs: Buteur[] }) {
  const vus = buteurs.slice(0, BUTEURS_MAX);
  const reste = buteurs.length - vus.length;
  if (vus.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 18 }}>
      {vus.map((b) => (
        <div
          key={`${b.nom}-${b.csc}`}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            fontFamily: "Outfit",
            fontSize: 26,
            color: "#ffffff",
          }}
        >
          <Ballon />
          <div style={{ display: "flex", fontWeight: 700 }}>{b.nom}</div>
          <div style={{ display: "flex", fontWeight: 500, color: GRIS }}>
            {[b.minutes.length ? b.minutes.join(", ") : b.nombre > 1 ? `×${b.nombre}` : "", b.csc ? "(csc)" : ""]
              .filter(Boolean)
              .join(" ")}
          </div>
        </div>
      ))}
      {reste > 0 && (
        <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 500, fontSize: 22, color: GRIS }}>
          {`+ ${reste} autre${reste > 1 ? "s" : ""}`}
        </div>
      )}
    </div>
  );
}

/** Un ballon plat, en vert : la puce d'un but. */
function Ballon() {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
    `<circle cx="12" cy="12" r="11" fill="${EMERAUDE}"/>` +
    `<polygon points="12,7 16.3,10.1 14.6,15 9.4,15 7.7,10.1" fill="${NUIT}"/></svg>`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} alt="" width={24} height={24} />
  );
}

/**
 * « DIMANCHE 12 OCTOBRE 2026 » et « 15H00 », sur deux lignes comme sur la
 * référence : sur une affiche, le jour et l'heure se cherchent séparément.
 */
function quand(date: string, time: string): { jour: string; heure: string } {
  const d = new Date(`${date}T${time || "00:00"}`);
  const heure = time ? time.replace(":", "H") : "";
  if (!date || Number.isNaN(d.getTime())) return { jour: date, heure };
  const jour = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return { jour, heure };
}
