import { ImageResponse } from "next/og";
import { chasseAnton } from "@/lib/anton";
import type { ButeursDuMatch, Buteur } from "@/lib/buteurs";
import type { CompMatchPublic, MatchPublic } from "@/lib/match-public";
import {
  Camp, chargerRessources, EMERAUDE, Espace, FondEclats, GRIS, NUIT, Pied, quand, TitreFendu,
} from "@/lib/og-da";

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
// RIEN PENDANT LE DIRECT, ni pour un match annulé : l'annonce est passée,
// le résultat n'existe pas encore — ou n'existera pas. La route répond 404
// et le bouton Partager envoie le lien seul, qui porte, lui, le score du
// moment.
//
// L'ALLURE — cadre, polices, titre fendu, écussons — vit dans lib/og-da, que
// les aperçus de lien (lib/og) partagent : un flyer et le lien qui l'annonce
// doivent se reconnaître au premier coup d'œil.
//
// SATORI, PAS UN NAVIGATEUR : flexbox seulement, et tout élément à plusieurs
// enfants doit déclarer `display: flex`.
// ============================================

export const TAILLE_FLYER = { width: 1080, height: 1350 };

/** L'épaisseur du cadre d'éclats autour de la carte. */
const CADRE = 60;

// ─── Le cadre ───────────────────────────────────────────────

/**
 * Le cadre d'éclats (lib/og-da), et en tête de carte le logo : celui de la
 * compétition quand elle en a un, sinon celui de Koppafoot.
 */
function Cadre({ logo, logoCompetition, children }: {
  logo: string;
  logoCompetition: string | null;
  children: React.ReactNode;
}) {
  return (
    <FondEclats largeur={TAILLE_FLYER.width} hauteur={TAILLE_FLYER.height} cadre={CADRE} padding="48px 56px 40px">
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
    </FondEclats>
  );
}

// ─── Les briques ────────────────────────────────────────────

/** La largeur utile de la carte, cadre et marges déduits. */
const LARGEUR_UTILE = TAILLE_FLYER.width - 2 * CADRE - 2 * 56;

/**
 * Le titre, fendu en diagonale comme sur la référence, à la plus grande taille
 * qui tient : mesuré sur la police (lib/anton), parce qu'un titre trop large
 * passe à la ligne — « SCORE » d'un côté, « FINAL » de l'autre — au lieu de
 * rétrécir.
 */
function Titre({ texte }: { texte: "MATCHDAY" | "SCORE FINAL" }) {
  const chasse = chasseAnton(texte);
  // 24 px de marge : le second morceau est decale et ne doit pas toucher le bord.
  const taille = Math.min(204, Math.floor((LARGEUR_UTILE - 24) / chasse));
  return <TitreFendu texte={texte} chasse={chasse} taille={taille} />;
}

/** Le petit surtitre au-dessus du titre, en vert : la journée, le tour. */
function Surtitre({ texte }: { texte: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        maxWidth: LARGEUR_UTILE,
        textAlign: "center",
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

/**
 * Le flyer d'un match, selon son état : MATCHDAY avant, SCORE FINAL après,
 * rien pendant le direct ni pour un match annulé.
 *
 * Un match de compétition se reconnaît à sa compétition : il porte son logo
 * en tête, et pas « MATCH AMICAL ». SANS LOGO, c'est celui de Koppafoot qui
 * s'affiche, et le NOM de la compétition passe au surtitre, devant l'étape :
 * sinon rien sur l'image ne dirait de quelle compétition il s'agit.
 */
export async function flyerDuMatch(match: MatchPublic | CompMatchPublic): Promise<Response> {
  if (match.status === "live" || match.status === "cancelled") {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const officiel = "competition" in match;
  const m: FlyerMatch = {
    surtitre: !officiel
      ? ""
      : match.competitionLogo
        ? match.etape
        : [match.competition, match.etape].filter(Boolean).join(" · "),
    amical: !officiel,
    logoCompetition: officiel ? match.competitionLogo : null,
    home: { nom: match.homeTeamName || "À déterminer", logo: match.homeTeamLogo },
    away: { nom: match.awayTeamName || "À déterminer", logo: match.awayTeamLogo },
    date: match.date,
    time: match.time,
    lieu: [match.venueName, match.venueCity].filter(Boolean).join(", "),
  };

  if (match.status !== "completed") return flyerMatchDay(m);

  return flyerScoreFinal({
    ...m,
    scoreHome: match.scoreHome ?? 0,
    scoreAway: match.scoreAway ?? 0,
    tirsAuBut:
      match.penaltyHome != null && match.penaltyAway != null
        ? { home: match.penaltyHome, away: match.penaltyAway }
        : null,
    buteurs: match.buteurs,
  });
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
      <Titre texte="MATCHDAY" />
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
  /** Une phase finale qui s'est jouée aux tirs au but ; `null` sinon. */
  tirsAuBut: { home: number; away: number } | null;
  buteurs: ButeursDuMatch;
}

function ScoreFinal({ m, logo }: { m: FlyerResultat; logo: string }) {
  const { jour } = quand(m.date, m.time);
  return (
    <Cadre logo={logo} logoCompetition={m.logoCompetition}>
      {m.surtitre ? <Surtitre texte={m.surtitre} /> : <div style={{ display: "flex", height: 30 }} />}
      <Titre texte="SCORE FINAL" />
      {m.amical && <Espace texte="Match amical" />}

      <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 6 }}>
        <Camp {...m.home} taille={176}>
          <ListeButeurs buteurs={m.buteurs.home} />
        </Camp>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
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
          {/* Sans eux, une finale à 1-1 n'a pas de vainqueur sur l'image. */}
          {m.tirsAuBut && (
            <div
              style={{
                display: "flex",
                marginTop: 14,
                fontFamily: "Outfit",
                fontWeight: 700,
                fontSize: 24,
                letterSpacing: 2,
                color: EMERAUDE,
              }}
            >
              {`T.A.B. ${m.tirsAuBut.home} - ${m.tirsAuBut.away}`}
            </div>
          )}
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
