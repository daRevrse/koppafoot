import { ImageResponse } from "next/og";
import sharp from "sharp";
import { chasseAnton } from "@/lib/anton";
import { Camp, chargerRessources, EMERAUDE, FondEclats, TitreFendu, quand } from "@/lib/og-da";
import type { FlyerMatch } from "@/lib/og-flyer";
import type { CalqueVideo } from "@/lib/og-joueur-semaine";
import { CLES_ANNONCE } from "@/lib/video-annonce";

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
  logo: 190,
  surtitre: 372,
  titre: 450,
  camps: 740,
  infos: 1130,
  pied: 1404,
};
const CAMP = { largeur: 400, ecusson: 230 };
const VERSUS = 120;
/** Les camps et le V, centrés : 400 + 120 + 400. */
const X0 = (W - (2 * CAMP.largeur + VERSUS)) / 2;

function raccourcir(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

const absolu = (top: number, left = 0, width = W) =>
  ({ position: "absolute", top, left, width, display: "flex", justifyContent: "center" }) as const;

function Annonce({ m, logoKf, couche }: { m: FlyerMatch; logoKf: string; couche?: string }) {
  const voir = (cle: string) => !couche || couche === cle;
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
      {voir("logo") && (
        <div style={absolu(Y.logo)}>
          {m.logoCompetition ? (
            // Dans une boîte : un écusson haut côtoie un bandeau large.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.logoCompetition} alt="" width={320} height={150} style={{ objectFit: "contain" }} />
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
 * Les calques de la vidéo : chaque élément rendu seul, recadré sur ce qu'il
 * occupe (sharp `trim`), avec sa place. Le fond reste entier. Un calque vide
 * (pas de surtitre, pas d'heure) n'est pas rendu : il n'a rien à montrer.
 */
export async function calquesAnnonce(m: FlyerMatch): Promise<CalqueVideo[]> {
  const { fonts, logo } = await chargerRessources();
  const calques: CalqueVideo[] = [];
  for (const cle of CLES_ANNONCE) {
    const r = new ImageResponse(<Annonce m={m} logoKf={logo} couche={cle} />, { width: W, height: H, fonts });
    const png = Buffer.from(await r.arrayBuffer());
    if (cle === "fond") {
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
