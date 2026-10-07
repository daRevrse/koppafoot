import { ImageResponse } from "next/og";
import { chasseAnton, titreAnton } from "@/lib/anton";
import type { CompMatchPublic, MatchPublic } from "@/lib/match-public";
import {
  Camp, chargerRessources, EMERAUDE, Espace, FondEclats, GRIS, imageDistante, NUIT, Pied, quand,
  ROUGE_DIRECT, TitreFendu,
} from "@/lib/og-da";

// ============================================
// Les images d'aperçu : ce que WhatsApp déplie sous un lien.
//
// DANS LA DA DES FLYERS (lib/og-da). Le premier dessin — police par défaut
// de Satori en un seul poids, halo vert en dégradé, « KoppaFoot » en
// minuscules fines — ne ressemblait ni au produit ni aux flyers qu'on poste à
// côté. Même cadre d'éclats, même carte nuit, même logo, même Anton fendue,
// mêmes capitales Outfit : en paysage, parce qu'un aperçu de lien est
// recadré en 1,91:1.
//
// LU EN PETIT. Dans une conversation, l'image fait le tiers de sa taille :
// peu de choses, écrites gros. Le titre et la phrase du lien s'affichent en
// dessous, en texte ; l'image n'a pas à les répéter.
//
// Chaque route d'aperçu retombe sur l'affiche de marque quand son sujet est
// introuvable — une compétition supprimée, un match dont l'adresse traîne
// dans une vieille conversation : une rencontre à un seul camp aurait l'air
// d'un défaut plutôt que d'un lien périmé.
//
// SATORI, PAS UN NAVIGATEUR : flexbox seulement, et tout élément à plusieurs
// enfants doit déclarer `display: flex`.
// ============================================

export const TAILLE_OG = { width: 1200, height: 630 };

/** Le cadre d'éclats, plus fin que sur un flyer : la hauteur est comptée. */
const CADRE_OG = 40;

/** L'accroche du produit (config/auth-contextes), coupée en titre et sous-titre. */
const ACCROCHE = "LE FOOTBALL D'ICI";

async function rendre(affiche: React.ReactElement): Promise<ImageResponse> {
  const { fonts } = await chargerRessources();
  return new ImageResponse(affiche, { ...TAILLE_OG, fonts });
}

function Fond({ padding, children }: { padding: string; children: React.ReactNode }) {
  return (
    <FondEclats largeur={TAILLE_OG.width} hauteur={TAILLE_OG.height} cadre={CADRE_OG} padding={padding}>
      {children}
    </FondEclats>
  );
}

/** Le logo de Koppafoot, ou celui de la compétition quand il y en a un. */
function Logo({ logo, logoCompetition }: { logo: string; logoCompetition?: string | null }) {
  return logoCompetition ? (
    // Dans une boîte : un écusson haut côtoie un bandeau large.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoCompetition} alt="" width={190} height={84} style={{ objectFit: "contain", objectPosition: "left" }} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="Koppafoot" width={160} height={80} />
  );
}

/** En haut à droite : le contexte en petit, l'état en grand. */
function Etat({ contexte, texte, couleur }: { contexte: string; texte: string; couleur: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", maxWidth: 720 }}>
      {contexte && (
        <div
          style={{
            display: "flex",
            fontFamily: "Outfit",
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: 4,
            color: GRIS,
            textTransform: "uppercase",
            textAlign: "right",
          }}
        >
          {contexte}
        </div>
      )}
      <div
        style={{
          display: "flex",
          marginTop: contexte ? 6 : 0,
          fontFamily: "Outfit",
          fontWeight: 900,
          fontSize: 28,
          letterSpacing: 3,
          color: couleur,
          textTransform: "uppercase",
          textAlign: "right",
        }}
      >
        {texte}
      </div>
    </div>
  );
}

// ─── La marque ──────────────────────────────────────────────

/** L'affiche de marque : ce que voit quelqu'un à qui on envoie l'appli. */
function AfficheDeMarque({ logo }: { logo: string }) {
  const largeurUtile = TAILLE_OG.width - 2 * CADRE_OG - 2 * 64;
  const chasse = chasseAnton(ACCROCHE);
  const taille = Math.min(140, Math.floor((largeurUtile - 24) / chasse));
  return (
    <Fond padding="40px 64px 34px">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt="Koppafoot" width={210} height={105} />
      <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <TitreFendu texte={ACCROCHE} chasse={chasse} taille={taille} marge={0} />
        <Espace texte="En direct" taille={34} espacement={18} couleur={EMERAUDE} marge={24} />
      </div>
      <Pied marge={0} />
    </Fond>
  );
}

export async function imageDeMarque(): Promise<ImageResponse> {
  const { logo } = await chargerRessources();
  return rendre(<AfficheDeMarque logo={logo} />);
}

// ─── Un match ───────────────────────────────────────────────

/**
 * L'état d'un match, dit en haut de l'affiche. Les deux collections
 * n'emploient pas les mêmes mots — `upcoming` d'un côté, `scheduled` de
 * l'autre —, d'où le repli commun sur la date.
 */
function etatDuMatch(status: string, date: string, time: string): { texte: string; couleur: string } {
  if (status === "live") return { texte: "En direct", couleur: ROUGE_DIRECT };
  if (status === "completed") return { texte: "Score final", couleur: EMERAUDE };
  if (status === "cancelled") return { texte: "Annulé", couleur: GRIS };
  const { jour, heure } = quand(date, time);
  return { texte: [jour, heure].filter(Boolean).join(" · ") || "À venir", couleur: EMERAUDE };
}

interface AfficheMatch {
  logoCompetition: string | null;
  contexte: string;
  etat: { texte: string; couleur: string };
  home: { nom: string; logo: string | null };
  away: { nom: string; logo: string | null };
  /** Le score s'il y a lieu ; un match à venir n'a pas de 0-0, il a un « V ». */
  score: { home: number; away: number; tirsAuBut: string | null } | null;
  lieu: string;
}

const ECUSSON_OG = 132;

function AfficheDeMatch({ m, logo }: { m: AfficheMatch; logo: string }) {
  return (
    <Fond padding="28px 48px 26px">
      <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between" }}>
        <Logo logo={logo} logoCompetition={m.logoCompetition} />
        <Etat contexte={m.contexte} {...m.etat} />
      </div>

      <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 12 }}>
          <Camp {...m.home} taille={ECUSSON_OG} largeur={340} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 220 }}>
            {m.score ? (
              <div
                style={{
                  display: "flex",
                  height: ECUSSON_OG,
                  alignItems: "center",
                  gap: 16,
                  fontFamily: "Anton",
                  fontSize: 124,
                  lineHeight: 1,
                  color: "#ffffff",
                }}
              >
                <div style={{ display: "flex" }}>{m.score.home}</div>
                <div style={{ display: "flex", width: 30, height: 9, backgroundColor: EMERAUDE }} />
                <div style={{ display: "flex" }}>{m.score.away}</div>
              </div>
            ) : (
              <div style={{ display: "flex", height: ECUSSON_OG, alignItems: "center", fontFamily: "Anton", fontSize: 88, color: EMERAUDE }}>
                V
              </div>
            )}
            {m.score?.tirsAuBut && (
              <div style={{ display: "flex", marginTop: 10, fontFamily: "Outfit", fontWeight: 700, fontSize: 22, letterSpacing: 2, color: EMERAUDE }}>
                {m.score.tirsAuBut}
              </div>
            )}
          </div>
          <Camp {...m.away} taille={ECUSSON_OG} largeur={340} />
        </div>
      </div>

      <div style={{ display: "flex", width: "100%", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
        <div
          style={{
            display: "flex",
            maxWidth: 640,
            fontFamily: "Outfit",
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: 1,
            color: "#ffffff",
            textTransform: "uppercase",
          }}
        >
          {m.lieu}
        </div>
        <Pied marge={0} />
      </div>
    </Fond>
  );
}

/**
 * LA BANNIÈRE DU MATCH, QUAND IL Y EN A UNE.
 *
 * Elle passe devant l'affiche dessinée, et c'est le bon ordre : un
 * organisateur qui prend la peine d'en poser une a choisi ce qu'il veut
 * montrer de sa rencontre.
 *
 * RECADRÉE, PAS DÉFORMÉE. `size` d'une image d'aperçu est déclaré en dur
 * dans les balises `og:image:width/height` : servir l'original tel quel
 * ferait mentir ces balises à chaque bannière d'un autre format. On la pose
 * donc en `cover` dans le cadre annoncé — c'est exactement ce que WhatsApp
 * et Facebook feraient eux-mêmes, mais fait ici, où l'on sait ce qui compte
 * dans l'image.
 *
 * Le fond sombre derrière n'est pas décoratif : une bannière transparente ou
 * qui échoue à se charger laisserait sinon un rectangle blanc, qui se lit
 * comme un lien cassé.
 */
function AfficheBanniere({ url }: { url: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: NUIT }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" width="100%" height="100%" style={{ objectFit: "cover" }} />
    </div>
  );
}

/**
 * L'aperçu d'un match, amical ou de compétition : sa bannière s'il en a une,
 * l'affiche dessinée sinon, l'affiche de marque s'il est introuvable.
 *
 * Une seule fonction pour les deux collections : ce sont deux routes, mais
 * une seule affiche, et deux dessins qui divergeraient à la première retouche.
 */
export async function imageDuMatch(match: MatchPublic | CompMatchPublic | null): Promise<ImageResponse> {
  if (!match) return imageDeMarque();
  if (match.bannerUrl) return new ImageResponse(<AfficheBanniere url={match.bannerUrl} />, TAILLE_OG);

  const officiel = "competition" in match;
  const [{ logo }, logoCompetition, logoHome, logoAway] = await Promise.all([
    chargerRessources(),
    officiel ? imageDistante(match.competitionLogo) : null,
    imageDistante(match.homeTeamLogo),
    imageDistante(match.awayTeamLogo),
  ]);
  const joue = match.status === "live" || match.status === "completed";

  // Le nom de la compétition quand son logo ne le dit pas déjà (même règle
  // que le flyer), puis l'étape ; « Match amical » pour un amical.
  const contexte = officiel
    ? [logoCompetition ? "" : match.competition, match.etape].filter(Boolean).join(" · ")
    : "Match amical";

  return rendre(
    <AfficheDeMatch
      logo={logo}
      m={{
        logoCompetition,
        contexte,
        etat: etatDuMatch(match.status, match.date, match.time),
        home: { nom: match.homeTeamName || "À déterminer", logo: logoHome },
        away: { nom: match.awayTeamName || "À déterminer", logo: logoAway },
        score: joue
          ? {
              home: match.scoreHome ?? 0,
              away: match.scoreAway ?? 0,
              // Sans eux, une finale à 1-1 n'a pas de vainqueur sur l'image.
              tirsAuBut: match.penaltyHome != null && match.penaltyAway != null
                ? `T.A.B. ${match.penaltyHome} - ${match.penaltyAway}`
                : null,
            }
          : null,
        lieu: [match.venueName, match.venueCity].filter(Boolean).join(", "),
      }}
    />,
  );
}

// ─── Une compétition ────────────────────────────────────────

/** Les états d'une compétition, dits pour quelqu'un qui ne connaît pas l'appli. */
export const ETATS_COMPETITION: Record<string, string> = {
  registration: "Inscriptions ouvertes",
  registration_closed: "Bientôt le coup d'envoi",
  group_stage: "Phase de groupes",
  knockout: "Phase finale",
  completed: "Terminée",
};

/**
 * L'affiche d'une compétition : son nom en grand, son état, ses chiffres.
 *
 * Partagée entre la page publique (/c/[slug]) et la page d'inscription
 * (/c/[slug]/rejoindre), voir lib/og-competition.
 */
export async function imageDeCompetitionTrouvee({ nom, etat, chiffres, logoUrl }: {
  nom: string;
  etat: string;
  /** Équipes, matchs, ville : ce qui prouve que l'événement existe. */
  chiffres: string[];
  logoUrl: string | null;
}): Promise<ImageResponse> {
  const [{ logo }, logoCompetition] = await Promise.all([chargerRessources(), imageDistante(logoUrl)]);
  // Aussi gros que possible, sur deux lignes au plus (lib/anton). Moins haut
  // quand le logo de la compétition prend sa place au-dessus du nom.
  const { lignes, taille } = titreAnton(nom, {
    largeur: 1000,
    max: logoCompetition ? 88 : 124,
    min: 56,
    seuil: logoCompetition ? 72 : 90,
  });
  return rendre(
    <Fond padding="28px 56px 26px">
      <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between" }}>
        <Logo logo={logo} />
        <Etat contexte="Compétition" texte={etat} couleur={EMERAUDE} />
      </div>

      <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {logoCompetition && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoCompetition} alt="" width={180} height={96} style={{ objectFit: "contain", marginBottom: 14 }} />
        )}
        {/* Une ligne par ligne : laissé à lui-même, Satori coupe où il peut
            et laisse un mot seul dessous. Interligne large : l'accent d'une
            capitale (LOMÉ) ne doit pas toucher la ligne du dessus. */}
        {lignes.map((ligne) => (
          <div
            key={ligne}
            style={{
              display: "flex",
              justifyContent: "center",
              maxWidth: 1000,
              fontFamily: "Anton",
              fontSize: taille,
              lineHeight: 1.14,
              color: "#ffffff",
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            {ligne}
          </div>
        ))}
        {chiffres.length > 0 && (
          <Espace texte={chiffres.join("  ·  ")} taille={24} espacement={5} marge={20} />
        )}
      </div>

      <Pied marge={0} />
    </Fond>,
  );
}
