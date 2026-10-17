import { ImageResponse } from "next/og";
import { chargerRessources, EMERAUDE, Ecusson, GRIS, quand } from "@/lib/og-da";
import { Cadre, LARGEUR_UTILE, Surtitre, TAILLE_FLYER, Titre } from "@/lib/og-flyer";
import type { PhaseFinalePublique } from "@/lib/phase-finale-publique";
import type { CampDuTableau, MatchDuTableau, TourDuTableau } from "@/lib/phase-finale";

// ============================================
// Les affiches de la phase finale : le TABLEAU, qui se remplit tour après
// tour, et le CHAMPION, au coup de sifflet de la finale. La finale elle-même
// a son affiche de match, titrée « LA FINALE » (lib/og-flyer).
//
// La même allure que les affiches de match — cadre d'éclats, titre fendu en
// Anton, écussons, adresse en pied — et le même format portrait 1080×1350,
// celui d'un statut WhatsApp ou d'une publication Instagram.
//
// SATORI, PAS UN NAVIGATEUR : flexbox seulement, tout élément à plusieurs
// enfants déclare `display: flex`, et un texte trop long ne s'ellipse pas
// tout seul — on le raccourcit avant (voir `raccourcir`).
// ============================================

/**
 * Des images qui changent avec les résultats : une minute de cache, pas un
 * an. L'image d'un tableau partagée après les quarts ne doit pas être celle
 * d'avant.
 */
const EN_TETES = { "Cache-Control": "public, max-age=60, s-maxage=60" };

/** Un nom raccourci d'une ellipse pour tenir en `max` caractères. */
function raccourcir(nom: string, max: number): string {
  return nom.length <= max ? nom : `${nom.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

// ─── Le tableau ─────────────────────────────────────────────

const ECART_COLONNES = 12;

/**
 * La taille des cases. Huit huitièmes empilés ne tiennent qu'en serrant : la
 * colonne débordait sur le pied, la ligne du champion par-dessus le dernier
 * match.
 */
interface Gabarit { ligne: number; ecusson: number; police: number; score: number; padding: string }
const NORMAL: Gabarit = { ligne: 30, ecusson: 26, police: 17, score: 22, padding: "8px 10px" };
const SERRE: Gabarit = { ligne: 23, ecusson: 20, police: 14, score: 18, padding: "5px 8px" };

function LigneDuCamp({ camp, score, tirs, gagne, perd, largeurNom, g }: {
  camp: CampDuTableau;
  score: number | null;
  tirs: number | null;
  gagne: boolean;
  perd: boolean;
  largeurNom: number;
  g: Gabarit;
}) {
  // ~0,68 em par caractère en capitales d'Outfit grasses : mesuré sur
  // l'affiche, 0,56 laissait « RESTE D'AF… » passer sur deux lignes.
  const max = Math.max(5, Math.floor(largeurNom / (g.police * 0.68)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, height: g.ligne }}>
      {camp.aDeterminer ? (
        <div style={{ display: "flex", width: g.ecusson, height: g.ecusson, borderRadius: g.ecusson / 2, border: `2px solid ${GRIS}` }} />
      ) : (
        <Ecusson nom={camp.nom} logo={camp.logo} taille={g.ecusson} />
      )}
      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          whiteSpace: "nowrap",
          fontFamily: "Outfit",
          fontWeight: camp.aDeterminer ? 500 : gagne ? 900 : 700,
          fontSize: g.police,
          color: camp.aDeterminer || perd ? GRIS : "#ffffff",
          textTransform: camp.aDeterminer ? "none" : "uppercase",
        }}
      >
        {raccourcir(camp.nom, max)}
      </div>
      {score != null && (
        <div
          style={{
            display: "flex",
            fontFamily: "Anton",
            fontSize: g.score,
            color: gagne ? EMERAUDE : perd ? GRIS : "#ffffff",
          }}
        >
          {tirs != null ? `${score} (${tirs})` : String(score)}
        </div>
      )}
    </div>
  );
}

function CaseDuMatch({ m, largeur, g }: { m: MatchDuTableau; largeur: number; g: Gabarit }) {
  const joue = m.scoreHome != null && m.scoreAway != null && (m.termine || m.scoreHome + m.scoreAway > 0);
  const tirs = m.tirsAuButHome != null;
  // Marges, écusson, écart, score : ce qui reste est au nom.
  const largeurNom = largeur - 22 - g.ecusson - 7 - (joue ? (tirs ? 54 : 22) : 0);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        width: largeur,
        padding: g.padding,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderLeft: `4px solid ${m.termine ? EMERAUDE : "rgba(255,255,255,0.18)"}`,
      }}
    >
      <LigneDuCamp
        camp={m.home}
        score={joue ? m.scoreHome : null}
        tirs={m.tirsAuButHome}
        gagne={m.vainqueur === "home"}
        perd={m.vainqueur === "away"}
        largeurNom={largeurNom}
        g={g}
      />
      <LigneDuCamp
        camp={m.away}
        score={joue ? m.scoreAway : null}
        tirs={m.tirsAuButAway}
        gagne={m.vainqueur === "away"}
        perd={m.vainqueur === "home"}
        largeurNom={largeurNom}
        g={g}
      />
    </div>
  );
}

function Colonne({ tour, largeur, g }: { tour: TourDuTableau; largeur: number; g: Gabarit }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: largeur, height: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 10,
          fontFamily: "Outfit",
          fontWeight: 900,
          fontSize: 20,
          letterSpacing: 3,
          color: EMERAUDE,
          textTransform: "uppercase",
        }}
      >
        {tour.libelle}
      </div>
      {/* Réparties sur toute la hauteur : la finale tombe au milieu de ses
          demies, chaque demie au milieu de ses quarts, comme un vrai tableau. */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", flex: 1 }}>
        {tour.matchs.map((m) => <CaseDuMatch key={m.id} m={m} largeur={largeur} g={g} />)}
      </div>
    </div>
  );
}

function Tableau({ pf, logo }: { pf: PhaseFinalePublique; logo: string }) {
  const n = pf.tours.length;
  const largeur = Math.floor((LARGEUR_UTILE - (n - 1) * ECART_COLONNES) / n);
  const g = Math.max(...pf.tours.map((t) => t.matchs.length)) > 4 ? SERRE : NORMAL;
  return (
    <Cadre logo={logo} logoCompetition={pf.logo}>
      <Surtitre texte={pf.nom} />
      {/* Plus petit que sur une affiche de match : ici, c'est le tableau qui
          doit avoir la place. */}
      <Titre texte="PHASE FINALE" max={120} />
      <div style={{ display: "flex", flex: 1, width: LARGEUR_UTILE, gap: ECART_COLONNES, marginTop: 14, overflow: "hidden" }}>
        {pf.tours.map((t) => <Colonne key={t.tour} tour={t} largeur={largeur} g={g} />)}
      </div>
      {pf.champion && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 14,
            fontFamily: "Outfit",
            fontWeight: 900,
            fontSize: 26,
            color: "#ffffff",
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex", color: EMERAUDE }}>{pf.feminine ? "Championne" : "Champion"}</div>
          <div style={{ display: "flex" }}>{pf.champion.nom}</div>
        </div>
      )}
    </Cadre>
  );
}

/** Le tableau de la phase finale, des premiers tours à la finale. */
export async function afficheDuTableau(pf: PhaseFinalePublique): Promise<ImageResponse> {
  const { fonts, logo } = await chargerRessources();
  return new ImageResponse(<Tableau pf={pf} logo={logo} />, { ...TAILLE_FLYER, fonts, headers: EN_TETES });
}

// ─── Le champion ────────────────────────────────────────────

function Distinction({ titre, nom, detail }: { titre: string; nom: string; detail: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 900, fontSize: 22, letterSpacing: 3, color: EMERAUDE }}>
        {titre}
      </div>
      <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 900, fontSize: 32, color: "#ffffff", textTransform: "uppercase" }}>
        {raccourcir(nom, 28)}
      </div>
      {detail && (
        <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 500, fontSize: 24, color: GRIS }}>
          {raccourcir(detail, 40)}
        </div>
      )}
    </div>
  );
}

function Champion({ pf, logo }: { pf: PhaseFinalePublique; logo: string }) {
  const champion = pf.champion!;
  const f = pf.finale!;
  const tirs = f.tirsAuButHome != null && f.tirsAuButAway != null ? ` · T.A.B. ${f.tirsAuButHome}-${f.tirsAuButAway}` : "";
  const finale = `${f.home.nom} ${f.scoreHome ?? 0} – ${f.scoreAway ?? 0} ${f.away.nom}`;
  const { jour } = quand(f.date, "");
  return (
    <Cadre logo={logo} logoCompetition={pf.logo}>
      <Surtitre texte={pf.nom} />
      <Titre texte={pf.feminine ? "CHAMPIONNE" : "CHAMPION"} />

      <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
        <Ecusson nom={champion.nom} logo={champion.logo} taille={280} />
        <div
          style={{
            display: "flex",
            maxWidth: LARGEUR_UTILE,
            textAlign: "center",
            fontFamily: "Outfit",
            fontWeight: 900,
            fontSize: champion.nom.length > 20 ? 46 : 58,
            lineHeight: 1.1,
            color: "#ffffff",
            textTransform: "uppercase",
          }}
        >
          {champion.nom}
        </div>
        <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 700, fontSize: 26, color: GRIS, textTransform: "uppercase" }}>
          {raccourcir(`Finale · ${finale}${tirs}`, 60)}
        </div>
      </div>

      {(pf.meilleurJoueur || pf.meilleurButeur) && (
        <div style={{ display: "flex", justifyContent: "center", gap: 56, marginBottom: 6 }}>
          {pf.meilleurJoueur && (
            <Distinction
              titre={pf.feminine ? "MEILLEURE JOUEUSE" : "MEILLEUR JOUEUR"}
              nom={pf.meilleurJoueur.nom}
              detail={pf.meilleurJoueur.equipe}
            />
          )}
          {pf.meilleurButeur && (
            <Distinction
              titre={pf.feminine ? "MEILLEURE BUTEUSE" : "MEILLEUR BUTEUR"}
              nom={pf.meilleurButeur.nom}
              detail={`${pf.meilleurButeur.equipe} · ${pf.meilleurButeur.buts} but${pf.meilleurButeur.buts > 1 ? "s" : ""}`}
            />
          )}
        </div>
      )}
      {jour && (
        <div style={{ display: "flex", marginTop: 18, fontFamily: "Outfit", fontWeight: 900, fontSize: 24, color: GRIS, textTransform: "uppercase" }}>
          {jour}
        </div>
      )}
    </Cadre>
  );
}

/** Le champion, au coup de sifflet de la finale. Appelée seulement s'il y en a un. */
export async function afficheDuChampion(pf: PhaseFinalePublique): Promise<ImageResponse> {
  const { fonts, logo } = await chargerRessources();
  return new ImageResponse(<Champion pf={pf} logo={logo} />, { ...TAILLE_FLYER, fonts, headers: EN_TETES });
}
