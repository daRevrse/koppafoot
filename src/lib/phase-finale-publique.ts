import { adminDb } from "@/lib/firebase-admin";
import { imageDistante } from "@/lib/og-da";
import {
  championDe, meilleurButeur, ordonnerTableau, placeAttendue,
  type CampDuTableau, type MatchAuxButs, type MatchDuTableau, type TourDuTableau,
} from "@/lib/phase-finale";
import type { CompMatchRound } from "@/types";

// ============================================
// La phase finale d'une compétition, lue par le serveur pour ses affiches
// (lib/og-phase-finale) : le tableau, la finale, le champion.
//
// PUBLIQUE comme la page de la compétition : une compétition en brouillon n'a
// pas d'affiche, la même règle que celle d'un match (lib/match-public).
//
// LES ÉCUSSONS SONT TÉLÉCHARGÉS ICI (lib/og-da, `imageDistante`), filtrés et
// convertis : Satori ne lit pas le WebP, le format de tout logo récent.
// ============================================

export interface PhaseFinalePublique {
  nom: string;
  slug: string;
  logo: string | null;
  /** Une compétition féminine : « championne », « meilleure buteuse ». */
  feminine: boolean;
  tours: TourDuTableau[];
  finale: MatchDuTableau | null;
  champion: CampDuTableau | null;
  /** Le meilleur joueur désigné par l'organisateur, s'il l'a fait. */
  meilleurJoueur: { nom: string; equipe: string | null } | null;
  meilleurButeur: { nom: string; equipe: string; buts: number } | null;
}

const TOURS_CONNUS = new Set<CompMatchRound>(["round_of_16", "quarter", "semi", "final", "third_place"]);

export async function phaseFinalePublique(slug: string): Promise<PhaseFinalePublique | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const comps = await adminDb.collection("competitions").where("slug", "==", slug).limit(1).get();
  const compDoc = comps.docs[0];
  if (!compDoc) return null;
  const c = compDoc.data() as {
    name?: string; logo_url?: string | null; status?: string; category?: string | null;
    mvp_player_name?: string | null; mvp_team_id?: string | null;
  };
  if (c.status === "draft") return null;

  const snap = await compDoc.ref.collection("comp_matches").get();
  const tous: (Record<string, unknown> & { id: string })[] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  const knockout = tous.filter((d) => d.stage === "knockout" && TOURS_CONNUS.has(d.round as CompMatchRound));
  if (knockout.length === 0) return null;

  // Un écusson par équipe, téléchargé une fois même s'il apparaît à chaque tour.
  const adresses = new Set<string>();
  for (const d of knockout) {
    if (typeof d.home_team_logo === "string") adresses.add(d.home_team_logo);
    if (typeof d.away_team_logo === "string") adresses.add(d.away_team_logo);
  }
  const [logoCompetition, ...logos] = await Promise.all([
    imageDistante(c.logo_url, 640),
    ...[...adresses].map((a) => imageDistante(a, 256)),
  ]);
  const parAdresse = new Map([...adresses].map((a, i) => [a, logos[i]]));

  const campDe = (d: Record<string, unknown>, cote: "home" | "away"): CampDuTableau => {
    const id = d[`${cote}_team_id`];
    if (typeof id !== "string" || !id) {
      return { nom: placeAttendue(d[`${cote}_source`]) ?? "À déterminer", logo: null, aDeterminer: true };
    }
    const logo = d[`${cote}_team_logo`];
    return {
      nom: (d[`${cote}_team_name`] as string) || "À déterminer",
      logo: typeof logo === "string" ? parAdresse.get(logo) ?? null : null,
      aDeterminer: false,
    };
  };

  const matchs: MatchDuTableau[] = knockout.map((d) => {
    const termine = d.status === "completed";
    const gagnant = d.winner_team_id;
    return {
      id: d.id,
      tour: d.round as CompMatchRound,
      position: typeof d.bracket_slot === "number" ? d.bracket_slot : 0,
      home: campDe(d, "home"),
      away: campDe(d, "away"),
      scoreHome: typeof d.score_home === "number" ? d.score_home : null,
      scoreAway: typeof d.score_away === "number" ? d.score_away : null,
      tirsAuButHome: typeof d.penalty_home === "number" ? d.penalty_home : null,
      tirsAuButAway: typeof d.penalty_away === "number" ? d.penalty_away : null,
      termine,
      vainqueur: termine && gagnant
        ? gagnant === d.home_team_id ? "home" : gagnant === d.away_team_id ? "away" : null
        : null,
      date: typeof d.date === "string" ? d.date : "",
    };
  });

  const finale = matchs.find((m) => m.tour === "final") ?? null;
  const equipeDuMvp = c.mvp_team_id
    ? (tous.find((d) => d.home_team_id === c.mvp_team_id)?.home_team_name as string | undefined)
      ?? (tous.find((d) => d.away_team_id === c.mvp_team_id)?.away_team_name as string | undefined)
      ?? null
    : null;

  return {
    nom: c.name ?? "",
    slug,
    logo: logoCompetition,
    feminine: c.category === "women",
    tours: ordonnerTableau(matchs),
    finale,
    champion: championDe(matchs),
    meilleurJoueur: c.mvp_player_name ? { nom: c.mvp_player_name, equipe: equipeDuMvp } : null,
    meilleurButeur: meilleurButeur(tous as MatchAuxButs[]),
  };
}
