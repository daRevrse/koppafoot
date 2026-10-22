import { adminDb } from "@/lib/firebase-admin";
import { calendrierDeCompetition, type JourDuCalendrier } from "@/lib/calendrier-competition";
import { DEFAULT_HALF_DURATION, halfDuration } from "@/lib/competition-format";
import { toCompMatch } from "@/lib/competition-mappers";
import { dateAvecJourLong } from "@/lib/dates";
import { imageDistante } from "@/lib/og-da";
import type { DonneesProgramme } from "@/lib/og-programme";
import { jourDeLome, logoDe, partenairesDuProgramme, type FirestorePartenariat } from "@/lib/partenaires";
import { paginer, selectionnerProgramme, titreDuProgramme, type ChoixDuProgramme } from "@/lib/programme";
import type { CompetitionFormat, CompetitionType, FirestoreCompMatch } from "@/types";

// ============================================
// Server-only. Le programme d'une compétition, lu pour son affiche
// (lib/og-programme) : les matchs choisis, rangés comme dans le PDF
// (lib/calendrier-competition), coupés en pages (lib/programme), et tout ce
// que Satori doit recevoir déjà téléchargé.
//
// PUBLIQUE comme la page de la compétition : une compétition en brouillon
// n'a pas d'affiche, la même règle que celles du tableau et du champion
// (lib/phase-finale-publique).
//
// LES IMAGES SONT TÉLÉCHARGÉES ICI (lib/og-da, `imageDistante`), filtrées et
// converties : Satori ne lit pas le WebP. Un écusson une fois par adresse,
// même s'il revient à chaque ligne.
// ============================================

const MAJ = (s: string) => s.toLocaleUpperCase("fr-FR");
const dateLongue = (d: string) => MAJ(dateAvecJourLong(new Date(`${d}T00:00:00`)));

/** Le surtitre : le nom quand le logo ne le dit pas, puis l'étape ou les dates. */
function surtitreDe(
  choix: ChoixDuProgramme, nom: string, avecLogo: boolean, type: CompetitionType | undefined, jours: JourDuCalendrier[],
): string {
  const parts: string[] = avecLogo ? [] : [MAJ(nom)];
  if ("journee" in choix) {
    parts.push(type === "league" ? "CHAMPIONNAT" : "PHASE DE POULES");
  } else if (choix.dates.length === 1) {
    parts.push(dateLongue(choix.dates[0]));
    // Le terrain, quand tous les matchs du jour s'y jouent.
    const lieux = new Set(jours.flatMap((j) => j.lignes.map((l) => l.lieu)));
    const [lieu] = lieux;
    if (lieux.size === 1 && lieu) parts.push(MAJ(lieu));
  } else {
    parts.push(`DU ${dateLongue(choix.dates[0])} AU ${dateLongue(choix.dates[choix.dates.length - 1])}`);
  }
  return parts.filter(Boolean).join(" · ");
}

export async function programmePublic(
  slug: string,
  choix: ChoixDuProgramme,
  page: number,
): Promise<DonneesProgramme | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const comps = await adminDb.collection("competitions").where("slug", "==", slug).limit(1).get();
  const compDoc = comps.docs[0];
  if (!compDoc) return null;
  const c = compDoc.data() as {
    name?: string; logo_url?: string | null; status?: string; competition_type?: CompetitionType;
    format?: CompetitionFormat | null;
  };
  if (c.status === "draft") return null;

  const snap = await compDoc.ref.collection("comp_matches").get();
  const matchs = snap.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch));
  const cal = calendrierDeCompetition(
    selectionnerProgramme(matchs, choix),
    c.format ? halfDuration(c.format) : DEFAULT_HALF_DURATION,
  );
  // Sur une affiche de journée, le titre dit déjà la journée : les lignes ne la répètent pas.
  const jours = "journee" in choix
    ? cal.jours.map((j) => ({ ...j, lignes: j.lignes.map((l) => ({ ...l, phase: l.phase.replace(/ · Journée \d+$/, "") })) }))
    : cal.jours;
  const pages = paginer(jours);
  const choisie = pages[page - 1];
  if (!choisie) return null;

  // Les écussons de la page, une fois par adresse.
  const adresses = new Set<string>();
  for (const l of choisie.flatMap((j) => j.lignes)) {
    if (l.domicile.logo) adresses.add(l.domicile.logo);
    if (l.exterieur.logo) adresses.add(l.exterieur.logo);
  }
  const partenariats = await adminDb.collection("partenariats").where("competition_id", "==", compDoc.id).get();
  const retenus = partenairesDuProgramme(
    partenariats.docs.map((d) => ({ id: d.id, ...(d.data() as FirestorePartenariat) })),
    compDoc.id,
    jourDeLome(),
  );
  const [logoCompetition, logosPartenaires, ...ecussons] = await Promise.all([
    imageDistante(c.logo_url, 640),
    Promise.all(retenus.map(async (p) => ({ annonceur: p.annonceur, logo: await imageDistante(logoDe(p), 600) }))),
    ...[...adresses].map((a) => imageDistante(a, 256)),
  ]);
  const parAdresse = new Map([...adresses].map((a, i) => [a, ecussons[i]]));
  const avecEcusson = (camp: JourDuCalendrier["lignes"][number]["domicile"]) =>
    ({ ...camp, logo: camp.logo ? parAdresse.get(camp.logo) ?? null : null });

  return {
    titre: titreDuProgramme(choix),
    surtitre: surtitreDe(choix, c.name ?? "", Boolean(logoCompetition), c.competition_type, choisie),
    logoCompetition,
    jours: choisie.map((j) => ({
      ...j,
      lignes: j.lignes.map((l) => ({ ...l, domicile: avecEcusson(l.domicile), exterieur: avecEcusson(l.exterieur) })),
    })),
    page: pages.length > 1 ? { n: page, total: pages.length } : null,
    partenaires: logosPartenaires.filter((p): p is { annonceur: string; logo: string } => p.logo !== null),
  };
}
