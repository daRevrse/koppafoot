import { adminDb } from "@/lib/firebase-admin";
import { toCompMatch } from "@/lib/competition-mappers";
import { amicalVersCompMatch } from "@/lib/friendlies-shared";
import { getDirectFeed } from "@/lib/competition-admin";
import { getPublicFriendlies } from "@/lib/friendlies-admin";
import {
  avecLeResume, cibleCompetition, cibleMatch, depuisDePeriode, jourAudience, jourMoins, lireCible,
  lireSession, minuteDe, resumeAStocker, RETENTION_JOURS, spectateursMaintenant, tempsMoyen, VIAS,
  type AudienceDeCompetition, type AudienceDeMatch, type ButSurLaCourbe, type DirectAudience,
  type JourDeCompetition, type MatchAudience, type PanoramaAudience, type Periode, type ResumeAudience,
  type ResumeStocke, type SessionLue, type Via,
} from "@/lib/audience";
import type { CompMatch, FirestoreCompMatch, FirestoreCompetition } from "@/types";

// ============================================
// La mesure d'audience, côté serveur : les chiffres que montrent
// l'administration, la page Statistiques des organisateurs et le rapport PDF,
// calculés ici une fois (voir lib/audience).
//
// UNE LECTURE, DEUX SOURCES : les sessions pour les jours encore détaillés,
// le résumé de `audience/{cible}` pour les jours dont la tâche de nuit a purgé
// le détail (`resumerLAudience`, plus bas). `avecLeResume` les assemble sans
// jamais compter un jour deux fois.
// ============================================

const sessions = (cible: string) => adminDb.collection("audience").doc(cible).collection("sessions");

/** Les sessions d'une cible depuis un jour. */
export async function sessionsDe(cible: string, depuis: string): Promise<SessionLue[]> {
  const snap = await sessions(cible).where("jour", ">=", depuis).get();
  return snap.docs.map((d) => lireSession(d.data())).filter((s): s is SessionLue => s != null);
}

/** Le résumé stocké d'une cible, avec la compétition d'un match qu'il retient. */
type Stocke = ResumeStocke & { cid?: string | null };

interface Lu {
  sessions: SessionLue[];
  resume: ResumeAudience;
  stocke: Stocke | null;
}

/** Ce qu'on sait d'une cible depuis un jour : ses sessions, et son résumé pour le reste. */
async function lire(cible: string, depuis: string): Promise<Lu> {
  const [lues, doc] = await Promise.all([
    sessionsDe(cible, depuis),
    adminDb.collection("audience").doc(cible).get(),
  ]);
  const stocke = doc.exists ? (doc.data() as Stocke) : null;
  return { sessions: lues, resume: avecLeResume(lues, stocke, depuis), stocke };
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

function audienceDUnMatch(match: CompMatch, cid: string | null, lu: Lu): MatchAudience {
  return {
    cible: cibleMatch(match.id),
    mid: match.id,
    cid,
    affiche: affiche(match),
    date: match.date,
    heure: match.time,
    statut: match.status,
    visites: lu.resume.visites,
    pic: lu.resume.pic,
    tempsMoyenMin: lu.resume.tempsMoyenMin,
    maintenant: match.status === "live" ? spectateursMaintenant(lu.sessions) : 0,
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
  const [lu, competition] = await Promise.all([
    // Un match se joue sur un jour, deux s'il passe minuit : tout ce qu'on a.
    lire(cible, "00000000"),
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
    resume: lu.resume,
    maintenant: match.status === "live" ? spectateursMaintenant(lu.sessions) : 0,
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
    lire(cibleCompetition(cid), depuis),
    ...matchs.map((m) => lire(cibleMatch(m.id), depuis)),
  ]);
  const audiences = matchs.map((m, i) => audienceDUnMatch(m, cid, parMatch[i]));

  const parJour = new Map<string, JourDeCompetition>();
  const noter = (r: ResumeAudience, cle: "pages" | "matchs") => {
    for (const j of r.parJour) {
      const e = parJour.get(j.jour) ?? { jour: j.jour, pages: 0, matchs: 0 };
      e[cle] += j.visites;
      parJour.set(j.jour, e);
    }
  };
  noter(pages.resume, "pages");
  for (const lu of parMatch) noter(lu.resume, "matchs");

  const tous = [pages, ...parMatch];
  const provenance = provenanceVide();
  for (const lu of tous) for (const v of VIAS) provenance[v] += lu.resume.provenance[v];
  const visites = tous.reduce((n, lu) => n + lu.resume.visites, 0);
  const connectees = tous.reduce((n, lu) => n + lu.resume.connectees, 0);
  const visitesMatchs = parMatch.reduce((n, lu) => n + lu.resume.visites, 0);

  // Le temps moyen se calcule sur les spectateurs eux-mêmes quand leurs
  // sessions sont encore là ; une fois purgées, sur la moyenne de chaque match.
  const sessionsDeDirect = parMatch.flatMap((lu) => lu.sessions).filter((s) => s.minutes.length > 0);
  const moyennes = audiences.map((a) => a.tempsMoyenMin).filter((t) => t > 0);
  const tempsMoyenMin = sessionsDeDirect.length > 0
    ? tempsMoyen(sessionsDeDirect)
    : moyennes.length > 0 ? Math.round((moyennes.reduce((a, b) => a + b, 0) / moyennes.length) * 10) / 10 : 0;

  const meilleur = [...audiences].filter((a) => a.pic).sort(parSuivi)[0] ?? null;

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
      visitesPages: pages.resume.visites,
      visitesMatchs,
      pic: meilleur?.pic ? { ...meilleur.pic, mid: meilleur.mid, affiche: meilleur.affiche } : null,
      tempsMoyenMin,
      partAppli: visites > 0 ? provenance.app / visites : 0,
      partConnectee: visites > 0 ? connectees / visites : 0,
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
  // Les cibles mesurées. Avant la première nuit de résumé, leurs documents
  // n'existent pas (seules leurs sessions existent) : `listDocuments` les rend
  // quand même.
  const refs = await adminDb.collection("audience").listDocuments();
  const lues = await Promise.all(refs.map(async (ref) => ({ cible: ref.id, lu: await lire(ref.id, depuis) })));

  const provenance = provenanceVide();
  let visitesCompetitions = 0;
  let visitesMatchs = 0;
  const parCompetition = new Map<string, { visites: number; visitesMatchs: number; pic: number }>();
  const desMatchs: { mid: string; cid: string | null; lu: Lu }[] = [];

  for (const { cible, lu } of lues) {
    const c = lireCible(cible);
    if (!c || lu.resume.visites === 0) continue;
    for (const v of VIAS) provenance[v] += lu.resume.provenance[v];
    if (c.genre === "competition") {
      visitesCompetitions += lu.resume.visites;
      const e = parCompetition.get(c.id) ?? { visites: 0, visitesMatchs: 0, pic: 0 };
      e.visites += lu.resume.visites;
      parCompetition.set(c.id, e);
    } else {
      visitesMatchs += lu.resume.visites;
      const cid = lu.sessions.find((x) => x.cid)?.cid ?? lu.stocke?.cid ?? null;
      desMatchs.push({ mid: c.id, cid, lu });
      if (cid) {
        const e = parCompetition.get(cid) ?? { visites: 0, visitesMatchs: 0, pic: 0 };
        e.visitesMatchs += lu.resume.visites;
        e.pic = Math.max(e.pic, lu.resume.pic?.spectateurs ?? 0);
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

  const topMatchs = desMatchs
    .sort((a, b) => (b.lu.resume.pic?.spectateurs ?? 0) - (a.lu.resume.pic?.spectateurs ?? 0)
      || b.lu.resume.visites - a.lu.resume.visites)
    .slice(0, 5);
  const matchs = (await Promise.all(topMatchs.map(async (m) => {
    const match = await lireMatch(m.mid, m.cid);
    return match ? audienceDUnMatch(match, m.cid, m.lu) : null;
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

// ---- La tâche de nuit ----------------------------------------------------------------

/**
 * Résumer, puis purger. Chaque nuit (voir /api/cron/auto-validate) : les jours
 * terminés passent dans `audience/{cible}` — visites, provenance, courbe d'un
 * match —, le nombre d'abonnés de chaque compétition mesurée est photographié,
 * et les sessions de plus de RETENTION_JOURS jours sont effacées.
 *
 * REJOUABLE : un jour déjà résumé dont les sessions sont encore là est
 * recalculé, jamais additionné (voir `resumeAStocker`).
 */
export async function resumerLAudience(aujourdhui: string = jourAudience()): Promise<{ cibles: number; purgees: number }> {
  const limite = jourMoins(aujourdhui, RETENTION_JOURS);
  const refs = await adminDb.collection("audience").listDocuments();
  let purgees = 0;

  for (const ref of refs) {
    const cible = lireCible(ref.id);
    if (!cible) continue;
    const [snap, doc] = await Promise.all([ref.collection("sessions").get(), ref.get()]);
    const lues = snap.docs.map((d) => lireSession(d.data())).filter((s): s is SessionLue => s != null);
    const existant = doc.exists ? (doc.data() as Stocke) : null;

    const resume: Stocke = {
      ...resumeAStocker(lues, existant, aujourdhui),
      ...(cible.genre === "match" ? { cid: lues.find((s) => s.cid)?.cid ?? existant?.cid ?? null } : {}),
    };
    if (cible.genre === "competition") {
      const abonnes = await adminDb.collection("users")
        .where("followed_competition_ids", "array-contains", cible.id).count().get();
      resume.abonnes = { ...(existant?.abonnes ?? {}), [aujourdhui]: abonnes.data().count ?? 0 };
    }
    await ref.set({ ...resume, maj_le: new Date().toISOString() }, { merge: true });

    // Le détail s'efface APRÈS le résumé : une tâche interrompue entre les deux
    // garde ses sessions, et la nuit suivante les résume à nouveau.
    const anciennes = snap.docs.filter((d) => {
      const jour = d.get("jour");
      return typeof jour === "string" && jour < limite;
    });
    for (let i = 0; i < anciennes.length; i += 400) {
      const lot = adminDb.batch();
      for (const d of anciennes.slice(i, i + 400)) lot.delete(d.ref);
      await lot.commit();
    }
    purgees += anciennes.length;
  }
  return { cibles: refs.length, purgees };
}
