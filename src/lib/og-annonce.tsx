import { ImageResponse } from "next/og";
import sharp from "sharp";
import { chasseAnton } from "@/lib/anton";
import { Camp, chargerRessources, EMERAUDE, FondEclats, TitreFendu, quand } from "@/lib/og-da";
import type { FlyerMatch } from "@/lib/og-flyer";
import type { CalqueVideo } from "@/lib/og-joueur-semaine";
import { CLES_ACCROCHE, CLES_ANNONCE } from "@/lib/video-annonce";

// ============================================
// L'annonce d'un match chaud : le flyer MATCHDAY (lib/og-flyer) en vertical,
// 1080 × 1920, pour les statuts WhatsApp, TikTok et les Shorts. Rendue
// entière, ou calque par calque pour la vidéo qui la monte sous nos yeux
// (lib/video-annonce). Voir
// docs/superpowers/specs/2026-10-22-matchs-chauds-design.md.
//
// LE MÊME FLYER, PAS UN AUTRE : cadre d'éclats, carte nuit, titre fendu en
// Anton, écussons et noms dessous. Le titre reste celui du flyer (« MATCHDAY »,
// « LA FINALE » pour une finale) : jamais « CHOC ». Pas de forme des équipes.
//
// CE QUI DIT QUE CE MATCH-LÀ EST CHAUD (révision du 2026-11-09) : un bandeau
// orange « À ne pas manquer » en tête de l'affiche, et, pour la vidéo
// seulement, L'ACCROCHE qui l'ouvre — une flamme sur sa lueur et « MATCH À NE
// PAS MANQUER » en Anton (`CLES_ACCROCHE`). L'orange est la couleur de la
// flamme sur l'accueil Direct, la seule couleur chaude de l'affiche.
//
// TIKTOK RECOUVRE LE HAUT ET LE BAS : rien d'important dans les 150 premiers
// pixels ni sous 1480 (ses boutons, sa légende). Tout tient entre les deux.
//
// UNE PLACE FIXE PAR CALQUE : chaque élément est posé en absolu, pour que,
// rendu seul sur fond transparent, il tombe exactement où l'affiche entière
// le met. L'ordre ci-dessous est l'ordre d'empilement (CLES_ANNONCE).
//
// SATORI, PAS UN NAVIGATEUR : flexbox seulement, `display: "flex"` sur tout
// élément à plusieurs enfants.
// ============================================

const W = 1080;
const H = 1920;
const CADRE = 60;
/** La largeur utile : la carte, moins ses marges. */
const UTILE = W - 2 * CADRE - 2 * 56;

const Y = {
  bandeau: 160,
  logo: 230,
  surtitre: 372,
  titre: 450,
  camps: 740,
  infos: 1130,
  pied: 1404,
};
const CAMP = { largeur: 400, ecusson: 230 };

/** L'orange de la flamme, comme sur l'accueil Direct. */
const ORANGE = "#f97316";
const AMBRE = "#fbbf24";
/** L'accroche, centrée dans ce que TikTok laisse voir. */
const ACCROCHE = { flamme: 400, hauteurFlamme: 340, ligne0: 800, ligne1: 950, centre: 800 };

/**
 * La flamme : le tracé de l'icône du produit (lucide `Flame`), pleine, du
 * rouge-orangé de sa base à l'ambre de sa pointe, un coeur clair dedans.
 */
const TRACE_FLAMME = "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";

function Flamme({ hauteur, unie }: { hauteur: number; unie?: string }) {
  return (
    <svg width={hauteur} height={hauteur} viewBox="1 1 22 22" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="feu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={AMBRE} />
          <stop offset="0.55" stopColor={ORANGE} />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      <path d={TRACE_FLAMME} fill={unie ?? "url(#feu)"} />
      {!unie && <path d={TRACE_FLAMME} fill="#fde68a" transform="translate(12 22) scale(0.46) translate(-12 -22)" />}
    </svg>
  );
}
const VERSUS = 120;
/** Les camps et le V, centrés : 400 + 120 + 400. */
const X0 = (W - (2 * CAMP.largeur + VERSUS)) / 2;

function raccourcir(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

const absolu = (top: number, left = 0, width = W) =>
  ({ position: "absolute", top, left, width, display: "flex", justifyContent: "center" }) as const;

function Annonce({ m, logoKf, couche }: { m: FlyerMatch; logoKf: string; couche?: string }) {
  // L'affiche entière ne porte pas l'accroche : elle n'existe que dans la
  // vidéo, où elle s'efface avant que l'affiche se monte.
  const voir = (cle: string) => (couche ? couche === cle : !(CLES_ACCROCHE as readonly string[]).includes(cle));
  const accroche = ["MATCH À NE PAS", "MANQUER"].map((mots, i) => {
    const c = chasseAnton(mots);
    return { mots, taille: Math.min(i === 0 ? 132 : 260, Math.floor((UTILE - 24) / c)) };
  });
  const { jour, heure } = quand(m.date, m.time);
  const chasse = chasseAnton(m.titre);
  const taille = Math.min(204, Math.floor((UTILE - 24) / chasse));
  const texte = { fontFamily: "Outfit", fontWeight: 900, textTransform: "uppercase", textAlign: "center" } as const;

  return (
    <div style={{ position: "relative", display: "flex", width: W, height: H }}>
      {voir("fond") && (
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex" }}>
          <FondEclats largeur={W} hauteur={H} cadre={CADRE} padding="0">
            <div style={{ display: "flex" }} />
          </FondEclats>
        </div>
      )}
      {voir("lueur") && (
        <div
          style={{
            position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex",
            backgroundImage: `radial-gradient(circle at ${W / 2}px ${ACCROCHE.centre}px, rgba(249,115,22,0.5) 0px, rgba(249,115,22,0.18) 380px, rgba(249,115,22,0) 760px)`,
          }}
        />
      )}
      {voir("flamme") && (
        <div style={absolu(ACCROCHE.flamme)}>
          <Flamme hauteur={ACCROCHE.hauteurFlamme} />
        </div>
      )}
      {voir("accroche-0") && (
        <div style={{ ...absolu(ACCROCHE.ligne0), fontFamily: "Anton", fontSize: accroche[0].taille, lineHeight: 1, color: "#ffffff", whiteSpace: "nowrap" }}>
          {accroche[0].mots}
        </div>
      )}
      {voir("accroche-1") && (
        <div style={{ ...absolu(ACCROCHE.ligne1), fontFamily: "Anton", fontSize: accroche[1].taille, lineHeight: 1, color: ORANGE, whiteSpace: "nowrap" }}>
          {accroche[1].mots}
        </div>
      )}
      {voir("bandeau") && (
        <div style={absolu(Y.bandeau)}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 12, height: 58, padding: "0 30px 0 24px", borderRadius: 29,
              backgroundImage: `linear-gradient(90deg, #ea580c, ${ORANGE} 55%, #f59e0b)`,
              fontFamily: "Outfit", fontWeight: 900, fontSize: 28, letterSpacing: 3, color: "#ffffff", textTransform: "uppercase",
            }}
          >
            <Flamme hauteur={32} unie="#ffffff" />
            À ne pas manquer
          </div>
        </div>
      )}
      {voir("logo") && (
        <div style={absolu(Y.logo)}>
          {m.logoCompetition ? (
            // Dans une boîte : un écusson haut côtoie un bandeau large.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.logoCompetition} alt="" width={280} height={124} style={{ objectFit: "contain" }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoKf} alt="" width={236} height={118} />
          )}
        </div>
      )}
      {voir("surtitre") && m.surtitre && (
        // Une ligne, toujours : sur deux, il touchait le titre. Long, il rapetisse, puis s'ellipse.
        <div style={{ ...absolu(Y.surtitre, (W - UTILE) / 2, UTILE), ...texte, fontSize: m.surtitre.length > 30 ? 26 : 30, letterSpacing: 4, color: EMERAUDE, whiteSpace: "nowrap" }}>
          {raccourcir(m.surtitre, 38)}
        </div>
      )}
      {voir("titre") && (
        <div style={absolu(Y.titre)}>
          <TitreFendu texte={m.titre} chasse={chasse} taille={taille} marge={0} />
        </div>
      )}
      {voir("camp-0") && (
        <div style={{ ...absolu(Y.camps, X0, CAMP.largeur) }}>
          <Camp nom={raccourcir(m.home.nom, 44)} logo={m.home.logo} taille={CAMP.ecusson} largeur={CAMP.largeur} />
        </div>
      )}
      {voir("versus") && (
        <div style={{ ...absolu(Y.camps, X0 + CAMP.largeur, VERSUS), height: CAMP.ecusson, alignItems: "center", fontFamily: "Anton", fontSize: 110, color: EMERAUDE }}>
          V
        </div>
      )}
      {voir("camp-1") && (
        <div style={{ ...absolu(Y.camps, X0 + CAMP.largeur + VERSUS, CAMP.largeur) }}>
          <Camp nom={raccourcir(m.away.nom, 44)} logo={m.away.logo} taille={CAMP.ecusson} largeur={CAMP.largeur} />
        </div>
      )}
      {voir("infos") && (
        <div style={{ ...absolu(Y.infos, (W - UTILE) / 2, UTILE), flexDirection: "column", alignItems: "center", gap: 10, ...texte, fontSize: 40, color: "#ffffff" }}>
          {m.lieu && <div style={{ display: "flex", justifyContent: "center", textAlign: "center" }}>{raccourcir(m.lieu, 60)}</div>}
          {jour && <div style={{ display: "flex" }}>{jour}</div>}
          {heure && <div style={{ display: "flex", color: EMERAUDE, fontSize: 52 }}>{heure}</div>}
        </div>
      )}
      {voir("pied") && (
        <div style={{ ...absolu(Y.pied), fontFamily: "Outfit", fontWeight: 700, fontSize: 30, letterSpacing: 3, color: EMERAUDE }}>
          www.koppafoot.com
        </div>
      )}
    </div>
  );
}

/** L'annonce entière, en PNG : pour la regarder (scripts/rendu-annonce.tsx). */
export async function afficheAnnonce(m: FlyerMatch): Promise<Buffer> {
  const { fonts, logo } = await chargerRessources();
  const r = new ImageResponse(<Annonce m={m} logoKf={logo} />, { width: W, height: H, fonts });
  return Buffer.from(await r.arrayBuffer());
}

/**
 * Les calques de la vidéo, accroche comprise : chaque élément rendu seul,
 * recadré sur ce qu'il occupe (sharp `trim`), avec sa place. Le fond et la
 * lueur restent entiers. Un calque vide
 * (pas de surtitre, pas d'heure) n'est pas rendu : il n'a rien à montrer.
 */
export async function calquesAnnonce(m: FlyerMatch): Promise<CalqueVideo[]> {
  const { fonts, logo } = await chargerRessources();
  const calques: CalqueVideo[] = [];
  for (const cle of CLES_ANNONCE) {
    const r = new ImageResponse(<Annonce m={m} logoKf={logo} couche={cle} />, { width: W, height: H, fonts });
    const png = Buffer.from(await r.arrayBuffer());
    // Le fond est la toile ; la lueur, un dégradé qui s'éteint sans bord —
    // la rogner y poserait une arête.
    if (cle === "fond" || cle === "lueur") {
      calques.push({ cle, png: `data:image/png;base64,${png.toString("base64")}`, left: 0, top: 0, w: W, h: H });
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
      // Entièrement vide : rien à animer.
    }
  }
  return calques;
}
