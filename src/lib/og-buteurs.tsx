import { ImageResponse } from "next/og";
import { chargerRessources, EMERAUDE, Ecusson, GRIS } from "@/lib/og-da";
import { Cadre, LARGEUR_UTILE, Surtitre, TAILLE_FLYER, Titre } from "@/lib/og-flyer";
import { PiedAvecPartenaires } from "@/lib/og-programme";

// ============================================
// L'affiche des meilleurs buteurs d'une compétition, après une journée ou à
// ce jour (lib/buteurs-affiche). Voir
// docs/superpowers/specs/2026-11-01-affiche-des-buteurs-design.md.
//
// DANS LA DIRECTION DES AUTRES AFFICHES (lib/og-programme, lib/og-flyer) :
// cadre d'éclats, carte nuit, titre fendu en Anton, partenaires et adresse en
// pied. Portrait 1080 × 1350, le format d'un statut WhatsApp.
//
// UNE LIGNE PAR BUTEUR, dix au plus : le rang, l'écusson de son équipe, son
// nom et celui de l'équipe, ses buts. Le premier en vert. Peu de buteurs, et
// les lignes grandissent, comme les duels de l'affiche du programme.
//
// SATORI, PAS UN NAVIGATEUR : flexbox seulement, `display: "flex"` sur tout
// élément à plusieurs enfants, et il ne mesure pas le texte : les noms sont
// raccourcis ici, d'après la place de leur colonne.
// ============================================

export interface LigneDeLAffiche {
  rang: number;
  nom: string;
  equipe: string;
  /** Data URI de l'écusson, ou null : l'initiale le remplace. */
  ecusson: string | null;
  buts: number;
}

export interface DonneesButeurs {
  /** « APRÈS LA JOURNÉE 2 », précédé du nom de la compétition quand le logo ne le dit pas. */
  surtitre: string;
  /** Data URI, ou null : le logo de Koppafoot le remplace. */
  logoCompetition: string | null;
  lignes: LigneDeLAffiche[];
  /** Leurs logos en data URI ; vide : le pied ne montre que l'adresse. */
  partenaires: { annonceur: string; logo: string }[];
}

/** Une minute de cache, comme l'affiche du programme : un but peut tomber. */
const EN_TETES = { "Cache-Control": "public, max-age=60, s-maxage=60" };

/** La hauteur utile de la carte : 1350 − deux cadres de 60 − les marges de 48 et 40. */
const HAUTEUR_CARTE = TAILLE_FLYER.height - 120 - 88;
const SOUS_LE_TITRE = 40;
const COL_RANG = 84;
const COL_BUTS = 130;
/** Une capitale d'Outfit Black, en fraction de sa taille (mesurée pour lib/og-programme). */
const CHASSE_OUTFIT = 0.62;

function raccourcir(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** La place des lignes : la carte, moins le logo, le surtitre, le titre et le pied. */
function placeDesLignes(d: DonneesButeurs): number {
  const logo = d.logoCompetition ? 150 : 118;
  const pied = d.partenaires.length ? 24 + 62 : 34 + 26;
  return HAUTEUR_CARTE - logo - (34 + 38) - (10 + 150) - SOUS_LE_TITRE - pied;
}

function Ligne({ l, h }: { l: LigneDeLAffiche; h: number }) {
  const ec = Math.round(Math.min(72, h * 0.62));
  const tailleNom = Math.round(Math.max(20, Math.min(34, h * 0.33)));
  const tailleEquipe = Math.round(Math.max(13, Math.min(18, h * 0.19)));
  const largeurNom = LARGEUR_UTILE - COL_RANG - ec - 20 - COL_BUTS;
  const premier = l.rang === 1;
  return (
    <div style={{ display: "flex", alignItems: "center", height: h, width: LARGEUR_UTILE, borderTop: "2px solid #1c2622" }}>
      <div style={{
        display: "flex", width: COL_RANG, fontFamily: "Anton", fontSize: Math.round(Math.min(56, h * 0.52)), lineHeight: 1,
        color: premier ? EMERAUDE : "#ffffff",
      }}>
        {String(l.rang)}
      </div>
      <Ecusson nom={l.equipe} logo={l.ecusson} taille={ec} />
      <div style={{ display: "flex", flexDirection: "column", width: largeurNom, marginLeft: 20 }}>
        <div style={{ display: "flex", whiteSpace: "nowrap", fontFamily: "Outfit", fontWeight: 900, fontSize: tailleNom, lineHeight: 1.1, color: premier ? EMERAUDE : "#ffffff" }}>
          {raccourcir(l.nom.toUpperCase(), Math.floor(largeurNom / (tailleNom * CHASSE_OUTFIT)))}
        </div>
        <div style={{ display: "flex", whiteSpace: "nowrap", marginTop: 4, fontFamily: "Outfit", fontWeight: 700, fontSize: tailleEquipe, letterSpacing: 2, color: GRIS }}>
          {raccourcir(l.equipe.toUpperCase(), Math.floor(largeurNom / (tailleEquipe * 0.72)))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: COL_BUTS }}>
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: Math.round(Math.min(64, h * 0.58)), lineHeight: 1, color: "#ffffff" }}>
          {String(l.buts)}
        </div>
        <div style={{ display: "flex", marginTop: 2, fontFamily: "Outfit", fontWeight: 700, fontSize: 13, letterSpacing: 3, color: GRIS }}>
          {l.buts > 1 ? "BUTS" : "BUT"}
        </div>
      </div>
    </div>
  );
}

function Affiche({ d, logo }: { d: DonneesButeurs; logo: string }) {
  const h = Math.min(112, Math.floor(placeDesLignes(d) / Math.max(1, d.lignes.length)));
  return (
    <Cadre
      logo={logo}
      logoCompetition={d.logoCompetition}
      pied={d.partenaires.length ? <PiedAvecPartenaires partenaires={d.partenaires} /> : undefined}
    >
      <Surtitre texte={d.surtitre} />
      <Titre texte="MEILLEURS BUTEURS" max={150} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", marginTop: SOUS_LE_TITRE }}>
        {d.lignes.map((l, i) => <Ligne key={i} l={l} h={h} />)}
      </div>
    </Cadre>
  );
}

/** L'affiche des meilleurs buteurs, prête à servir. */
export async function afficheDesButeurs(d: DonneesButeurs): Promise<ImageResponse> {
  const { fonts, logo } = await chargerRessources();
  return new ImageResponse(<Affiche d={d} logo={logo} />, { ...TAILLE_FLYER, fonts, headers: EN_TETES });
}
