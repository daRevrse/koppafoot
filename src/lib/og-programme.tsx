import { ImageResponse } from "next/og";
import { chargerRessources, EMERAUDE, Ecusson, GRIS } from "@/lib/og-da";
import { Cadre, LARGEUR_UTILE, Surtitre, TAILLE_FLYER, Titre } from "@/lib/og-flyer";
import type { JourDuCalendrier, LigneDuCalendrier } from "@/lib/calendrier-competition";

// ============================================
// L'affiche du programme : « JOURNÉE 2 », « MATCHS DU JOUR », « AU
// PROGRAMME ». Les rencontres choisies, jouées et à venir : un match joué
// donne son score, un match à venir son heure. Voir
// docs/superpowers/specs/2026-10-22-journees-et-affiche-du-jour-design.md,
// maquettes validées le 2026-10-22 (scripts/maquettes-journee.tsx).
//
// DANS LA DIRECTION DES FLYERS (lib/og-flyer, lib/og-da) : cadre d'éclats,
// carte nuit, titre fendu en Anton, l'adresse en pied. Portrait 1080 × 1350,
// le format d'un statut WhatsApp.
//
// TROIS MATCHS OU MOINS : chacun en face-à-face, grands écussons, comme le
// flyer MATCHDAY — une ligne seule se perdait dans le vide. AU-DELÀ, une
// ligne par match, de plus en plus serrées, douze au plus (lib/programme
// coupe en pages).
//
// LES PARTENAIRES DE LA COMPÉTITION au pied, « PRÉSENTÉ PAR », chacun sur
// une plaque blanche : un logo sombre disparaîtrait sur la carte nuit.
//
// SATORI, PAS UN NAVIGATEUR : flexbox seulement, `display: "flex"` sur tout
// élément à plusieurs enfants, et il ne mesure pas le texte : les noms sont
// raccourcis ici, d'après la place de leur colonne.
// ============================================

export interface DonneesProgramme {
  /** « JOURNÉE 2 », « MATCHS DU JOUR », « AU PROGRAMME » (lib/programme). */
  titre: string;
  surtitre: string;
  /** Data URI, ou null : le logo de Koppafoot le remplace. */
  logoCompetition: string | null;
  /** Les écussons des camps (`domicile.logo`) sont déjà des data URI, ou null. */
  jours: JourDuCalendrier[];
  /** « 1/2 » quand le programme tient sur plusieurs affiches. */
  page: { n: number; total: number } | null;
  /** Un intertitre par date, même seule sur la page (lib/programme, `intertitresVisibles`). */
  intertitres: boolean;
  /** Leurs logos en data URI ; vide : le pied ne montre que l'adresse. */
  partenaires: { annonceur: string; logo: string }[];
}

/** Une minute de cache, comme les affiches de phase finale : les scores changent. */
const EN_TETES = { "Cache-Control": "public, max-age=60, s-maxage=60" };

/** La hauteur utile de la carte : 1350 − deux cadres de 60 − les marges de 48 et 40. */
const HAUTEUR_CARTE = TAILLE_FLYER.height - 120 - 88;
const INTERTITRE = 46;
const COL_HEURE = 140;
const COL_SCORE = 150;
/** Une capitale d'Outfit Black, en fraction de sa taille : mesuré sur les rendus, « HÉDZRANAWOÉ » à 28 px fait 191 px. */
const CHASSE_OUTFIT = 0.62;
/** L'écart entre le titre et les matchs. */
const SOUS_LE_TITRE = 44;

function raccourcir(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** « POULE B · J2 » : en toutes lettres, la journée ne tenait pas sous l'heure. */
const phaseCourte = (l: LigneDuCalendrier) => raccourcir(l.phase.replace(" · Journée ", " · J").toUpperCase(), 16);

/** Ce que dit la colonne de gauche : l'heure à venir, ou l'état d'un match commencé. */
function etiquette(l: LigneDuCalendrier): { texte: string; vert: boolean } {
  if (l.etat === "en_cours") return { texte: "EN COURS", vert: false };
  if (l.etat === "joue") return { texte: l.forfait ? "FORFAIT" : "FINAL", vert: false };
  return { texte: l.heure ? l.heure.replace(":", "H") : "", vert: true };
}

function Centre({ l, taille }: { l: LigneDuCalendrier; taille: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: COL_SCORE }}>
      {l.score ? (
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: taille, lineHeight: 1, color: "#ffffff", whiteSpace: "nowrap" }}>
          {`${l.score[0]} – ${l.score[1]}`}
        </div>
      ) : (
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: Math.round(taille * 0.82), lineHeight: 1, color: EMERAUDE }}>VS</div>
      )}
      {l.tab && (
        <div style={{ display: "flex", marginTop: 2, fontFamily: "Outfit", fontWeight: 700, fontSize: 14, color: GRIS, whiteSpace: "nowrap" }}>
          {`${l.tab[0]}–${l.tab[1]} aux t.a.b.`}
        </div>
      )}
    </div>
  );
}

/** Un écusson, ou un rond pointillé pour une place pas encore attribuée. */
function Embleme({ camp, taille }: { camp: LigneDuCalendrier["domicile"]; taille: number }) {
  if (camp.enAttente) {
    return <div style={{ display: "flex", width: taille, height: taille, borderRadius: taille / 2, border: `3px dashed ${GRIS}` }} />;
  }
  return <Ecusson nom={camp.nom} logo={camp.logo} taille={taille} />;
}

/**
 * Le nom coupé en lignes ICI, mot par mot, `lignes` au plus, la dernière
 * finie d'une ellipse s'il en reste. Laissé à Satori, un nom de quarante
 * caractères passait sur trois lignes et sortait de la sienne.
 */
export function lignesDuNom(nom: string, parLigne: number, lignes: number): string[] {
  const sortie: string[] = [];
  let courante = "";
  for (const brut of nom.toUpperCase().split(/\s+/).filter(Boolean)) {
    const mot = brut.length > parLigne ? raccourcir(brut, parLigne) : brut;
    const essai = courante ? `${courante} ${mot}` : mot;
    if (essai.length <= parLigne) courante = essai;
    else { sortie.push(courante); courante = mot; }
  }
  if (courante) sortie.push(courante);
  if (sortie.length <= lignes) return sortie;
  const gardees = sortie.slice(0, lignes);
  const derniere = gardees[lignes - 1];
  gardees[lignes - 1] = `${derniere.length >= parLigne ? derniere.slice(0, parLigne - 1).trimEnd() : derniere}…`;
  return gardees;
}

function NomDuCamp({ camp, taille, largeur, lignes, align }: {
  camp: LigneDuCalendrier["domicile"]; taille: number; largeur: number; lignes: number; align: "left" | "right" | "center";
}) {
  const parLigne = Math.max(4, Math.floor(largeur / (taille * CHASSE_OUTFIT)));
  return (
    <div style={{
      display: "flex", flexDirection: "column", fontFamily: "Outfit", fontWeight: 900, fontSize: taille, lineHeight: 1.12,
      color: camp.enAttente ? GRIS : "#ffffff",
      alignItems: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
    }}>
      {lignesDuNom(camp.nom, parLigne, lignes).map((l, i) => (
        <div key={i} style={{ display: "flex", whiteSpace: "nowrap" }}>{l}</div>
      ))}
    </div>
  );
}

/** Quatre matchs et plus : une ligne par match. */
function Ligne({ l, h }: { l: LigneDuCalendrier; h: number }) {
  const ec = Math.round(h * 0.6);
  const nom = Math.max(17, Math.min(28, Math.round(h * 0.28)));
  const largeurNom = (LARGEUR_UTILE - COL_HEURE - COL_SCORE) / 2 - ec - 14;
  const lignes = h >= nom * 2.24 + 6 ? 2 : 1;
  const e = etiquette(l);
  return (
    <div style={{ display: "flex", alignItems: "center", height: h, width: LARGEUR_UTILE, borderTop: "2px solid #1c2622" }}>
      <div style={{ display: "flex", flexDirection: "column", width: COL_HEURE }}>
        <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 900, fontSize: e.vert ? nom : Math.min(nom, 20), color: e.vert ? EMERAUDE : GRIS }}>
          {e.texte}
        </div>
        {h >= 70 && (
          <div style={{ display: "flex", marginTop: 2, fontFamily: "Outfit", fontWeight: 700, fontSize: 12, letterSpacing: 1, color: GRIS }}>
            {phaseCourte(l)}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 14 }}>
        <NomDuCamp camp={l.domicile} taille={nom} largeur={largeurNom} lignes={lignes} align="right" />
        <Embleme camp={l.domicile} taille={ec} />
      </div>
      <Centre l={l} taille={Math.round(Math.min(h * 0.55, 60))} />
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 14 }}>
        <Embleme camp={l.exterieur} taille={ec} />
        <NomDuCamp camp={l.exterieur} taille={nom} largeur={largeurNom} lignes={lignes} align="left" />
      </div>
    </div>
  );
}

/** Trois matchs ou moins : chacun en face-à-face, comme le flyer MATCHDAY. */
function Duel({ l, hauteur }: { l: LigneDuCalendrier; hauteur: number }) {
  // Le cadre : 2 × 18 de marge, l'écusson, 10 d'écart, deux lignes de nom.
  const ec = Math.max(72, Math.min(130, hauteur - 36 - 10 - 70));
  const e = etiquette(l);
  const camp = (c: LigneDuCalendrier["domicile"]) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 300 }}>
      <Embleme camp={c} taille={ec} />
      <div style={{ display: "flex", marginTop: 10 }}>
        <NomDuCamp camp={c} taille={30} largeur={290} lignes={2} align="center" />
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", width: LARGEUR_UTILE, padding: "18px 0", borderTop: "2px solid #1c2622" }}>
      {camp(l.domicile)}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 236 }}>
        <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 700, fontSize: 16, letterSpacing: 3, color: GRIS }}>{phaseCourte(l)}</div>
        <div style={{ display: "flex", height: Math.min(100, ec), alignItems: "center" }}>
          <Centre l={l} taille={l.score ? Math.min(92, ec * 0.75) : Math.min(80, ec * 0.65)} />
        </div>
        {e.texte && (
          <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 900, fontSize: 28, color: e.vert ? EMERAUDE : GRIS }}>{e.texte}</div>
        )}
      </div>
      {camp(l.exterieur)}
    </div>
  );
}

function PiedAvecPartenaires({ partenaires }: { partenaires: DonneesProgramme["partenaires"] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: LARGEUR_UTILE, marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 700, fontSize: 16, letterSpacing: 4, color: GRIS }}>PRÉSENTÉ PAR</div>
        {partenaires.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 150, height: 62, padding: 8, backgroundColor: "#ffffff", borderRadius: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.logo} alt="" width={134} height={46} style={{ objectFit: "contain" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 700, fontSize: 24, letterSpacing: 3, color: EMERAUDE }}>
        www.koppafoot.com
      </div>
    </div>
  );
}

/** La place des matchs : la carte, moins le logo, le surtitre, le titre et le pied. */
function placeDesMatchs(d: DonneesProgramme): number {
  const logo = d.logoCompetition ? 150 : 118;
  const pied = d.partenaires.length ? 24 + 62 : 34 + 26;
  return HAUTEUR_CARTE - logo - (34 + 38) - (10 + 150) - SOUS_LE_TITRE - pied;
}

function Affiche({ d, logo }: { d: DonneesProgramme; logo: string }) {
  const lignes = d.jours.reduce((s, j) => s + j.lignes.length, 0);
  const avecIntertitres = d.intertitres || d.jours.length > 1;
  const intertitres = avecIntertitres ? d.jours.length * INTERTITRE : 0;
  const place = placeDesMatchs(d) - intertitres;
  const duel = lignes <= 3;
  const h = Math.min(104, Math.floor(place / Math.max(1, lignes)));
  const surtitre = d.page ? `${d.surtitre} · ${d.page.n}/${d.page.total}` : d.surtitre;
  return (
    <Cadre
      logo={logo}
      logoCompetition={d.logoCompetition}
      pied={d.partenaires.length ? <PiedAvecPartenaires partenaires={d.partenaires} /> : undefined}
    >
      <Surtitre texte={surtitre} />
      <Titre texte={d.titre} max={150} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", marginTop: SOUS_LE_TITRE }}>
        {d.jours.map((j, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column" }}>
            {avecIntertitres && (
              <div style={{ display: "flex", height: INTERTITRE, alignItems: "flex-end", paddingBottom: 8, fontFamily: "Outfit", fontWeight: 700, fontSize: 20, letterSpacing: 6, color: EMERAUDE }}>
                {j.date ? j.titre.toUpperCase() : "DATE À FIXER"}
              </div>
            )}
            {j.lignes.map((l) => (duel
              ? <Duel key={l.id} l={l} hauteur={Math.floor(place / lignes)} />
              : <Ligne key={l.id} l={l} h={h} />))}
          </div>
        ))}
      </div>
    </Cadre>
  );
}

/** L'affiche du programme, prête à servir. */
export async function afficheDuProgramme(d: DonneesProgramme): Promise<ImageResponse> {
  const { fonts, logo } = await chargerRessources();
  return new ImageResponse(<Affiche d={d} logo={logo} />, { ...TAILLE_FLYER, fonts, headers: EN_TETES });
}
