// ============================================
// Server-only. Le joueur de la semaine côté serveur : lire la semaine, les
// photos des candidats, les partenaires du jour.
//
// LA MÊME LECTURE QUE LE CLASSEMENT (`matchsDeLaPlateforme`) : les
// compétitions publiques hors entraînement et hors exhibition, et les amicaux.
// Lue à la demande de l'administration, jamais à l'affichage d'une page.
// ============================================

import { adminDb } from "@/lib/firebase-admin";
import { matchsDeLaPlateforme, photosDesJoueurs, photosSansCompte } from "@/lib/classement-admin";
import { classerLaSemaine, semaineDu, type CandidatDeLaSemaine, type ClassementDeLaSemaine } from "@/lib/joueur-semaine";
import type { LigneSansCompte } from "@/lib/classement";
import {
  formatDe, jourDeLome, partenairesDeLAffiche,
  type FirestorePartenariat, type FormatPartenaire,
} from "@/lib/partenaires";

/** Un partenaire que le pied de l'affiche peut montrer. */
export interface PartenaireDAffiche {
  id: string;
  annonceur: string;
  imageUrl: string | null;
  format: FormatPartenaire;
}

/** La semaine qui commence `lundi`, sans les compétitions écartées. */
export async function lireLaSemaine(lundi: string, ecartees: string[]): Promise<ClassementDeLaSemaine> {
  const matchs = await matchsDeLaPlateforme();
  return classerLaSemaine(matchs, semaineDu(lundi), new Set(ecartees));
}

/**
 * Les photos de plusieurs candidats, par clé : celle du profil pour un compte,
 * celle de la ligne d'effectif ou de la fiche de club sinon. Les mêmes
 * lectures groupées que le classement publié.
 */
export async function photosDesCandidats(candidats: CandidatDeLaSemaine[]): Promise<Map<string, string>> {
  const uids = candidats.flatMap((c) => (c.uid ? [c.uid] : []));
  const sansCompte = candidats.flatMap((c) =>
    !c.uid && c.ligneSansCompte ? [[c.cle, c.ligneSansCompte] as [string, LigneSansCompte]] : []);
  const [deComptes, deLignes] = await Promise.all([photosDesJoueurs(uids), photosSansCompte(sansCompte)]);
  const photos = new Map<string, string>();
  for (const c of candidats) {
    const url = c.uid ? deComptes.get(c.uid) : deLignes.get(c.cle);
    if (url) photos.set(c.cle, url);
  }
  return photos;
}

/** La photo d'un candidat, ou null : l'affiche montrera ses initiales. */
export async function photoDuCandidat(c: CandidatDeLaSemaine): Promise<string | null> {
  return (await photosDesCandidats([c])).get(c.cle) ?? null;
}

/** Les partenaires de l'emplacement `affiche_semaine` à l'affiche aujourd'hui, dans l'ordre proposé. */
export async function partenairesDuJour(): Promise<PartenaireDAffiche[]> {
  const snap = await adminDb.collection("partenariats").where("emplacements", "array-contains", "affiche_semaine").get();
  const candidats = snap.docs.map((d) => ({ id: d.id, ...(d.data() as FirestorePartenariat) }));
  return partenairesDeLAffiche(candidats, jourDeLome()).map((p) => ({
    id: p.id,
    annonceur: p.annonceur,
    imageUrl: p.image_url ?? null,
    format: formatDe(p),
  }));
}
