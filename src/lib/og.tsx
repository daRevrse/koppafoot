// ============================================
// Les briques communes aux images d'aperçu.
//
// Chaque route d'aperçu dessine sa propre affiche, mais toutes retombent sur
// la même quand leur sujet est introuvable : une compétition supprimée, un
// match dont l'adresse traîne dans une vieille conversation. Sans repli
// commun, chacune improvisait — l'affiche du match rendait « KoppaFoot »
// contre un adversaire vide, ce qui a l'air d'un bug plutôt que d'un lien
// périmé.
//
// SATORI, PAS UN NAVIGATEUR : flexbox seulement, et tout élément à plusieurs
// enfants doit déclarer `display: flex`.
// ============================================

export const TAILLE_OG = { width: 1200, height: 630 };

export const VERT_KOPPA = "#34d399";
export const FOND_KOPPA = "#080d0b";

/**
 * L'affiche d'une rencontre : deux noms, un score ou un « VS », un lieu.
 *
 * Partagée entre l'amical (matches/[id]) et le match de compétition
 * (c/[slug]/matches/[mid]) : ce sont deux collections différentes, mais une
 * seule affiche, et deux dessins qui divergeraient au premier retouche.
 *
 * `surtitre` est ce qu'on lit avant les noms — l'état du match pour un
 * amical, le nom de la compétition suivi de l'état quand il y en a une.
 */
export function AfficheDeMatch({
  surtitre, couleurSurtitre, home, away, score, lieu,
}: {
  surtitre: string;
  couleurSurtitre: string;
  home: string;
  away: string;
  /** Le score s'il y a lieu, sinon « VS » : un match à venir n'a pas de 0-0. */
  score: string | null;
  lieu: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: FOND_KOPPA,
        backgroundImage: "radial-gradient(circle at 50% 0%, #065f46 0%, transparent 60%)",
        padding: "56px 72px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 40, height: 6, backgroundColor: couleurSurtitre }} />
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 6,
            color: couleurSurtitre,
          }}
        >
          {surtitre}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            fontSize: 62,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.1,
          }}
        >
          {home}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 240,
            fontSize: score ? 108 : 52,
            fontWeight: 800,
            color: score ? "#ffffff" : "#4d5854",
          }}
        >
          {score ?? "VS"}
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            justifyContent: "flex-end",
            textAlign: "right",
            fontSize: 62,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.1,
          }}
        >
          {away}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "2px solid #26322e",
          paddingTop: 26,
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#b7c1bc" }}>
          {lieu || "Football local"}
        </div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: VERT_KOPPA }}>
          koppafoot.com
        </div>
      </div>
    </div>
  );
}

/**
 * Le bandeau du haut : ce qu'il faut savoir avant même de lire les noms.
 *
 * Les deux collections n'emploient pas les mêmes mots pour dire la même
 * chose — `upcoming` d'un côté, `scheduled` de l'autre — d'où le repli
 * commun sur la date.
 */
export function etatDuMatch(status: string, date: string, time: string) {
  if (status === "live") return { texte: "EN DIRECT", couleur: "#f87171" };
  if (status === "completed") return { texte: "TERMINÉ", couleur: "#9ba6a1" };
  if (status === "cancelled") return { texte: "ANNULÉ", couleur: "#9ba6a1" };
  return {
    texte: [date, time].filter(Boolean).join(" · ") || "À VENIR",
    couleur: VERT_KOPPA,
  };
}

/**
 * L'affiche d'une compétition : son nom en grand, son état, ses chiffres.
 *
 * Partagée entre la page publique (/c/[slug]) et la page d'inscription
 * (/c/[slug]/rejoindre). Cette dernière a besoin de son PROPRE fichier
 * d'aperçu : déclarer un objet `openGraph` dans son `generateMetadata`
 * remplace celui du parent en entier, images comprises, et elle repartait
 * donc sans vignette.
 */
export function AfficheDeCompetition({
  nom, etat, chiffres,
}: {
  nom: string;
  etat: string;
  /** Équipes, matchs, ville : ce qui prouve que l'événement existe. */
  chiffres: string[];
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: FOND_KOPPA,
        backgroundImage: "radial-gradient(circle at 82% 12%, #065f46 0%, transparent 58%)",
        padding: "64px 72px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 40, height: 6, backgroundColor: VERT_KOPPA }} />
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 6,
            color: VERT_KOPPA,
          }}
        >
          {etat}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: nom.length > 28 ? 78 : 104,
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: -3,
          lineHeight: 1.05,
        }}
      >
        {nom}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "2px solid #26322e",
          paddingTop: 28,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#b7c1bc" }}>
          {chiffres.join("  ·  ") || "Football local, en direct"}
        </div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: VERT_KOPPA }}>
          koppafoot.com
        </div>
      </div>
    </div>
  );
}

/** Les états d'une compétition, dits pour quelqu'un qui ne connaît pas l'appli. */
export const ETATS_COMPETITION: Record<string, string> = {
  registration: "INSCRIPTIONS OUVERTES",
  group_stage: "PHASE DE GROUPES",
  knockout: "PHASE FINALE",
  completed: "TERMINÉE",
};

/** L'affiche de marque : ce que voit quelqu'un à qui on envoie l'appli. */
export function AfficheDeMarque() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 88px",
        // Le vert nuit du produit, celui des héros et de la barre du bas.
        backgroundColor: FOND_KOPPA,
        backgroundImage:
          "radial-gradient(circle at 78% 18%, #065f46 0%, transparent 55%)," +
          "radial-gradient(circle at 12% 92%, #064e3b 0%, transparent 50%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          color: VERT_KOPPA,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: 8,
        }}
      >
        <div style={{ width: 46, height: 6, backgroundColor: VERT_KOPPA }} />
        LE FOOTBALL LOCAL, EN DIRECT
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 26,
          fontSize: 132,
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: -4,
        }}
      >
        KoppaFoot
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 22,
          fontSize: 38,
          color: "#b7c1bc",
          maxWidth: 880,
          lineHeight: 1.3,
        }}
      >
        Compétitions, scores en direct, équipes et joueurs. La plateforme qui
        connecte les passionnés de football.
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 48,
          fontSize: 30,
          fontWeight: 700,
          color: VERT_KOPPA,
        }}
      >
        koppafoot.com
      </div>
    </div>
  );
}
