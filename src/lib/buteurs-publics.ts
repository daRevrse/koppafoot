import { adminDb } from "@/lib/firebase-admin";
import { classementDeLAffiche, momentDesButeurs, type ChoixDesButeurs } from "@/lib/buteurs-affiche";
import { toCompMatch } from "@/lib/competition-mappers";
import { imageDistante } from "@/lib/og-da";
import type { DonneesButeurs } from "@/lib/og-buteurs";
import { jourDeLome, logoDe, partenairesDuProgramme, type FirestorePartenariat } from "@/lib/partenaires";
import type { FirestoreCompMatch } from "@/types";

// ============================================
// Server-only. Les meilleurs buteurs d'une compétition, lus pour leur affiche
// (lib/og-buteurs) : le classement du choix (lib/buteurs-affiche), les noms
// et écussons des équipes, les partenaires, et tout ce que Satori doit
// recevoir déjà téléchargé.
//
// PUBLIQUE comme la page de la compétition et l'affiche du programme
// (lib/programme-public) : une compétition en brouillon n'a pas d'affiche.
// Pas d'affiche non plus sans buteur : `null`, la route répond 404 et la
// fenêtre de l'organisateur le dit.
//
// LES IMAGES SONT TÉLÉCHARGÉES ICI (lib/og-da, `imageDistante`), filtrées et
// converties : Satori ne lit pas le WebP. Un écusson une fois par équipe.
// ============================================

const MAJ = (s: string) => s.toLocaleUpperCase("fr-FR");

export async function buteursPublics(slug: string, choix: ChoixDesButeurs): Promise<DonneesButeurs | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const comps = await adminDb.collection("competitions").where("slug", "==", slug).limit(1).get();
  const compDoc = comps.docs[0];
  if (!compDoc) return null;
  const c = compDoc.data() as { name?: string; logo_url?: string | null; status?: string };
  if (c.status === "draft") return null;

  const [snapMatchs, snapEquipes, partenariats] = await Promise.all([
    compDoc.ref.collection("comp_matches").get(),
    compDoc.ref.collection("comp_teams").get(),
    adminDb.collection("partenariats").where("competition_id", "==", compDoc.id).get(),
  ]);
  const matchs = snapMatchs.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch));
  const classement = classementDeLAffiche(matchs, choix);
  if (classement.length === 0) return null;

  const equipes = new Map(snapEquipes.docs.map((d) => {
    const e = d.data() as { name?: string; logo_url?: string | null };
    return [d.id, { nom: e.name ?? "", logo: e.logo_url ?? null }];
  }));
  const idsEquipes = [...new Set(classement.map((l) => l.teamId))];
  const retenus = partenairesDuProgramme(
    partenariats.docs.map((d) => ({ id: d.id, ...(d.data() as FirestorePartenariat) })),
    compDoc.id,
    jourDeLome(),
  );
  const [logoCompetition, logosPartenaires, ...ecussons] = await Promise.all([
    imageDistante(c.logo_url, 640),
    Promise.all(retenus.map(async (p) => ({ annonceur: p.annonceur, logo: await imageDistante(logoDe(p), 600) }))),
    ...idsEquipes.map((id) => imageDistante(equipes.get(id)?.logo, 256)),
  ]);
  const ecussonDe = new Map(idsEquipes.map((id, i) => [id, ecussons[i]]));

  // Le surtitre dit le nom de la compétition quand son logo ne le dit pas.
  const moment = momentDesButeurs(choix);
  return {
    surtitre: logoCompetition ? moment : [MAJ(c.name ?? ""), moment].filter(Boolean).join(" · "),
    logoCompetition,
    lignes: classement.map((l) => ({
      rang: l.rang,
      nom: l.playerName,
      equipe: equipes.get(l.teamId)?.nom ?? "",
      ecusson: ecussonDe.get(l.teamId) ?? null,
      buts: l.goals,
    })),
    partenaires: logosPartenaires.filter((p): p is { annonceur: string; logo: string } => p.logo !== null),
  };
}
