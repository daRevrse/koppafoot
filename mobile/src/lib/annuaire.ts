import { LIBELLES_CATEGORIE } from "@/lib/genre";
import type { Competition, CompetitionStatus } from "@/types";

// L'annuaire des compétitions (app/(app)/competitions du site) : celles que
// le public voit, rangées comme le site, et sa recherche. Les compétitions
// du monde n'y sont pas : elles n'ont pas d'écran dans l'application, et
// leurs données viennent du fournisseur payant (voir lib/football-data).

/** L'ordre du site (getPublicCompetitions) : ce qui se joue, ce qui vient, ce qui est fini. */
const RANG: Record<CompetitionStatus, number> = {
  group_stage: 0, knockout: 0, registration: 1, registration_closed: 1, completed: 2, draft: 99,
};

/** Ce que le public voit : ni brouillon, ni compétition que l'administration n'a pas validée. */
export function competitionsPubliques(toutes: Competition[]): Competition[] {
  return toutes
    .filter((c) => c.status !== "draft" && c.isValidated)
    .sort((a, b) => RANG[a.status] - RANG[b.status]
      || (b.startDate ?? b.createdAt).localeCompare(a.startDate ?? a.createdAt));
}

const plier = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** La recherche du site : le nom, la ville, la catégorie en français et en anglais ; sans accents ni casse. */
export function rechercher(competitions: Competition[], recherche: string): Competition[] {
  const q = plier(recherche.trim());
  if (!q) return competitions;
  return competitions.filter((c) => plier([
    c.name,
    c.venueCity ?? "",
    c.category ? `${LIBELLES_CATEGORIE.fr[c.category]} ${LIBELLES_CATEGORIE.en[c.category]}` : "",
  ].join(" ")).includes(q));
}

const SECTIONS: { titre: string; statuts: CompetitionStatus[] }[] = [
  { titre: "En cours", statuts: ["group_stage", "knockout"] },
  { titre: "À venir", statuts: ["registration", "registration_closed"] },
  { titre: "Terminées", statuts: ["completed"] },
];

export function sectionsDeLAnnuaire(competitions: Competition[]): { titre: string; competitions: Competition[] }[] {
  return SECTIONS
    .map((s) => ({ titre: s.titre, competitions: competitions.filter((c) => s.statuts.includes(c.status)) }))
    .filter((s) => s.competitions.length > 0);
}

/** Le statut d'une carte de l'annuaire (CompetitionDirectoryCard) et la couleur de sa pastille. */
export const STATUT_DE_CARTE: Record<CompetitionStatus, { libelle: string; couleur: string }> = {
  draft: { libelle: "Brouillon", couleur: "#9ca3af" },
  registration: { libelle: "Inscriptions ouvertes", couleur: "#60a5fa" },
  registration_closed: { libelle: "À venir", couleur: "#fbbf24" },
  group_stage: { libelle: "En cours", couleur: "#34d399" },
  knockout: { libelle: "En cours", couleur: "#34d399" },
  completed: { libelle: "Terminée", couleur: "#9ca3af" },
};

const jour = (iso: string, annee: boolean) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(annee ? { year: "numeric" } : {}) });
};

/** « Du 18 oct. au 27 déc. 2026 » : l'année au début seulement si elle change, comme la carte du site. */
export function periodeCourte(debut: string | null, fin: string | null): string | null {
  if (debut && fin) return `Du ${jour(debut, debut.slice(0, 4) !== fin.slice(0, 4))} au ${jour(fin, true)}`;
  if (debut) return `À partir du ${jour(debut, true)}`;
  if (fin) return `Jusqu'au ${jour(fin, true)}`;
  return null;
}
