import { adminDb } from "@/lib/firebase-admin";
import { toCompMatch } from "@/lib/competition-mappers";
import { amicalVersCompMatch } from "@/lib/friendlies-shared";
import { getDirectFeed } from "@/lib/competition-admin";
import { getPublicFriendlies } from "@/lib/friendlies-admin";
import {
  cibleCompetition, cibleMatch, depuisDePeriode, jourAudience, jourMoins, lireCible, lireSession,
  minuteDe, resumer, spectateursMaintenant, VIAS,
  type AudienceDeCompetition, type AudienceDeMatch, type ButSurLaCourbe, type DirectAudience,
  type JourDeCompetition, type MatchAudience, type PanoramaAudience, type Periode, type SessionLue,
  type Via,
} from "@/lib/audience";
import type { CompMatch, FirestoreCompMatch, FirestoreCompetition } from "@/types";

// ============================================
// La mesure d'audience, côté serveur : les chiffres que montrent
// l'administration, la page Statistiques des organisateurs et le rapport PDF,
// calculés ici une fois, à partir des sessions (voir lib/audience).
//
// TOUT SE CALCULE À LA LECTURE, à l'échelle d'aujourd'hui. Le résumé
// quotidien (lot 4) prendra le relais pour le passé.
// ============================================

const sessions = (cible: string) => adminDb.collection("audience").doc(cible).collection("sessions");

/** Les sessions d'une cible depuis un jour. */
export async function sessionsDe(cible: string, depuis: string): Promise<SessionLue[]> {
  const snap = await sessions(cible).where("jour", ">=", depuis).get();
  return snap.docs.map((d) => lireSession(d.data())).filter((s): s is SessionLue => s != null);
}

const affiche = (m: Pick<CompMatch, "homeTeamName" | "awayTeamName">) =>
  `${m.homeTeamName || "?"} – ${m.awayTeamName || "?"}`;

/** Un match, de compétition (`cid`) ou amical. */
async function lireMatch(mid: string, cid: string | null): Promise<CompMatch | null> {
  if (cid) {
    const snap = await adminDb.collection("competitions").doc(cid).collection("comp_matches").doc(mid).get();
    return snap.exists ? toCompMatch(snap.id, snap.data() as FirestoreCompMatch) : null;
  }
  const snap = await adminDb.collection("matches").doc(mid).get();
  return snap.exists ? amicalVersCompMatch(snap.id, snap.data() as Record<string, unknown>) : null;
}

/** Les buts d'un match, à l'heure où ils ont été saisis, pour les poser sur la courbe. */
function butsDe(match: CompMatch): ButSurLaCourbe[] {
  const buts: ButSurLaCourbe[] = [];
  for (const e of match.liveState?.events ?? []) {
    if (e.type !== "goal" || e.varStatus === "cancelled") continue;
    const ms = Date.parse(e.createdAt);
    if (!Number.isFinite(ms)) continue;
    buts.push({
      minute: minuteDe(ms),
      libelle: `${e.minute}'${e.playerName ? ` ${e.playerName}` : ""}`,
      cote: e.teamId === match.homeTeamId ? "home" : "away",
    });
  }
  return buts.sort((a, b) => a.minute - b.minute);
}

function audienceDUnMatch(match: CompMatch, cid: string | null, lues: SessionLue[]): MatchAudience {
  const r = resumer(lues);
  return {
    cible: cibleMatch(match.id),
    mid: match.id,
    cid,
    affiche: affiche(match),
    date: match.date,
    heure: match.time,
    statut: match.status,
    visites: r.visites,
    pic: r.pic,
    tempsMoyenMin: r.tempsMoyenMin,
    maintenant: match.status === "live" ? spectateursMaintenant(lues) : 0,
  };
}

/** Du plus suivi au moins suivi : le pic d'abord, les visites ensuite. */
const parSuivi = (a: MatchAudience, b: MatchAudience) =>
  (b.pic?.spectateurs ?? 0) - (a.pic?.spectateurs ?? 0) || b.visites - a.visites;

const provenanceVide = () => Object.fromEntries(VIAS.map((v) => [v, 0])) as Record<Via, number>;

// ---- Un match ----------------------------------------------------------------------

export async function audienceDeMatch(mid: string, cid: string | null): Promise<AudienceDeMatch | null> {
  const match = await lireMatch(mid, cid);
  if (!match) return null;
  const cible = cibleMatch(mid);
  const [lues, competition] = await Promise.all([
    // Un match se joue sur un jour, deux s'il passe minuit : tout ce qu'on a.
    sessionsDe(cible, "00000000"),
    cid ? adminDb.collection("competitions").doc(cid).get() : Promise.resolve(null),
  ]);
  const c = competition?.exists ? (competition.data() as FirestoreCompetition) : null;
  return {
    cible,
    mid,
    cid,
    affiche: affiche(match),
    date: match.date,
    heure: match.time,
    statut: match.status,
    competition: c ? { nom: c.name, slug: c.slug } : null,
    resume: resumer(lues),
    maintenant: match.status === "live" ? spectateursMaintenant(lues) : 0,
    buts: butsDe(match),
  };
}

// ---- Une compétition -----------------------------------------------------------------

export async function audienceDeCompetition(cid: string, periode: Periode): Promise<AudienceDeCompetition | null> {
  const compRef = adminDb.collection("competitions").doc(cid);
  const [compSnap, matchsSnap, abonnes] = await Promise.all([
    compRef.get(),
    compRef.collection("comp_matches").get(),
    adminDb.collection("users").where("followed_competition_ids", "array-contains", cid).count().get(),
  ]);
  if (!compSnap.exists) return null;
  const competition = compSnap.data() as FirestoreCompetition;
  const depuis = depuisDePeriode(periode);

  const matchs = matchsSnap.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch));
  const [pages, ...parMatch] = await Promise.all([
    sessionsDe(cibleCompetition(cid), depuis),
    ...matchs.map((m) => sessionsDe(cibleMatch(m.id), depuis)),
  ]);

  const audiences = matchs.map((m, i) => audienceDUnMatch(m, cid, parMatch[i]));
  const toutesLesSessionsDeMatch = parMatch.flat();
  const toutes = [...pages, ...toutesLesSessionsDeMatch];

  const parJour = new Map<string, JourDeCompetition>();
  const noter = (jour: string, cle: "pages" | "matchs") => {
    const j = parJour.get(jour) ?? { jour, pages: 0, matchs: 0 };
    j[cle] += 1;
    parJour.set(jour, j);
  };
  for (const s of pages) noter(s.jour, "pages");
  for (const s of toutesLesSessionsDeMatch) noter(s.jour, "matchs");

  const provenance = provenanceVide();
  for (const s of toutes) provenance[s.via] += 1;

  const meilleur = [...audiences].filter((a) => a.pic).sort(parSuivi)[0] ?? null;
  const resumeMatchs = resumer(toutesLesSessionsDeMatch);

  return {
    cid,
    nom: competition.name,
    slug: competition.slug,
    logo: competition.logo_url ?? null,
    organisateur: competition.organizer_name ?? null,
    periode,
    depuis,
    parJour: [...parJour.values()].sort((a, b) => a.jour.localeCompare(b.jour)),
    provenance,
    matchs: audiences.filter((a) => a.visites > 0).sort(parSuivi),
    totaux: {
      visitesPages: pages.length,
      visitesMatchs: toutesLesSessionsDeMatch.length,
      pic: meilleur?.pic ? { ...meilleur.pic, mid: meilleur.mid, affiche: meilleur.affiche } : null,
      tempsMoyenMin: resumeMatchs.tempsMoyenMin,
      partAppli: toutes.length > 0 ? provenance.app / toutes.length : 0,
      partConnectee: toutes.length > 0 ? toutes.filter((s) => s.connecte).length / toutes.length : 0,
      abonnes: abonnes.data().count ?? 0,
      maintenant: audiences.reduce((n, a) => n + a.maintenant, 0),
    },
  };
}

// ---- Le direct, sur toute la plateforme ----------------------------------------------

/**
 * Les spectateurs de chaque match en cours. Les matchs viennent du Direct
 * (compétitions et amicaux), sans le football mondial : sa lecture consomme le
 * quota de l'API externe, et ses matchs ne sont pas mesurés.
 */
export async function directMaintenant(): Promise<DirectAudience> {
  const [feed, amicaux] = await Promise.all([getDirectFeed(50), getPublicFriendlies()]);
  const enCours = [
    ...feed.flatMap((f) => f.matches.filter((m) => m.status === "live").map((m) => ({ m, cid: f.competition.id }))),
    ...amicaux.filter((m) => m.status === "live").map((m) => ({ m, cid: null as string | null })),
  ];
  // Hier aussi : un match commencé avant minuit a ses spectateurs sur deux jours.
  const depuis = jourMoins(jourAudience(), 1);
  const matchs = await Promise.all(enCours.map(async ({ m, cid }) => ({
    cible: cibleMatch(m.id),
    mid: m.id,
    cid,
    affiche: affiche(m),
    spectateurs: spectateursMaintenant(await sessionsDe(cibleMatch(m.id), depuis)),
  })));
  matchs.sort((a, b) => b.spectateurs - a.spectateurs);
  return { total: matchs.reduce((n, m) => n + m.spectateurs, 0), matchs };
}

// ---- Le panorama de l'administration -------------------------------------------------

export async function panorama(periode: Periode): Promise<PanoramaAudience> {
  const depuis = depuisDePeriode(periode);
  // Les cibles mesurées : leurs documents n'existent pas (seules leurs
  // sessions existent), et `listDocuments` les rend quand même.
  const refs = await adminDb.collection("audience").listDocuments();
  const lues = await Promise.all(refs.map(async (ref) => ({ cible: ref.id, sessions: await sessionsDe(ref.id, depuis) })));

  const provenance = provenanceVide();
  let visitesCompetitions = 0;
  let visitesMatchs = 0;
  const parCompetition = new Map<string, { visites: number; visitesMatchs: number; pic: number }>();
  const matchsAvecCid: { mid: string; cid: string | null; sessions: SessionLue[] }[] = [];

  for (const { cible, sessions: s } of lues) {
    const c = lireCible(cible);
    if (!c || s.length === 0) continue;
    for (const x of s) provenance[x.via] += 1;
    if (c.genre === "competition") {
      visitesCompetitions += s.length;
      const e = parCompetition.get(c.id) ?? { visites: 0, visitesMatchs: 0, pic: 0 };
      e.visites += s.length;
      parCompetition.set(c.id, e);
    } else {
      visitesMatchs += s.length;
      const cid = s.find((x) => x.cid)?.cid ?? null;
      matchsAvecCid.push({ mid: c.id, cid, sessions: s });
      if (cid) {
        const e = parCompetition.get(cid) ?? { visites: 0, visitesMatchs: 0, pic: 0 };
        e.visitesMatchs += s.length;
        e.pic = Math.max(e.pic, resumer(s).pic?.spectateurs ?? 0);
        parCompetition.set(cid, e);
      }
    }
  }

  const topCompetitions = [...parCompetition.entries()]
    .sort((a, b) => b[1].visites + b[1].visitesMatchs - (a[1].visites + a[1].visitesMatchs))
    .slice(0, 5);
  const noms = topCompetitions.length > 0
    ? await adminDb.getAll(...topCompetitions.map(([cid]) => adminDb.collection("competitions").doc(cid)))
    : [];

  const topMatchs = matchsAvecCid
    .map((m) => ({ ...m, resume: resumer(m.sessions) }))
    .sort((a, b) => (b.resume.pic?.spectateurs ?? 0) - (a.resume.pic?.spectateurs ?? 0) || b.resume.visites - a.resume.visites)
    .slice(0, 5);
  const matchs = (await Promise.all(topMatchs.map(async (m) => {
    const match = await lireMatch(m.mid, m.cid);
    return match ? audienceDUnMatch(match, m.cid, m.sessions) : null;
  }))).filter((m): m is MatchAudience => m != null);

  return {
    periode,
    depuis,
    visitesCompetitions,
    visitesMatchs,
    provenance,
    competitions: topCompetitions.map(([cid, e], i) => ({
      cid,
      nom: (noms[i]?.data() as FirestoreCompetition | undefined)?.name ?? "Compétition supprimée",
      ...e,
    })),
    matchs,
    direct: await directMaintenant(),
  };
}
