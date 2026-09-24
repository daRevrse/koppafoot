/**
 * L'étoile touchée sans compte.
 *
 * Elle ouvre la connexion ; si le compte naît ou s'ouvre dans la foulée, la
 * compétition est suivie sans que l'utilisateur ait à refaire le geste —
 * l'équivalent du `?next=` du site.
 *
 * Dix minutes de validité : assez pour une inscription, profil compris ; pas
 * assez pour qu'une étoile touchée hier et une fenêtre refermée aussitôt
 * ressurgissent à la connexion suivante.
 */

const VALIDITE_MS = 10 * 60_000;

let enAttente: { cid: string; depuis: number } | null = null;

export function mettreEnAttente(cid: string, maintenant: number = Date.now()): void {
  enAttente = { cid, depuis: maintenant };
}

export function prendreEnAttente(maintenant: number = Date.now()): string | null {
  const courant = enAttente;
  enAttente = null;
  if (!courant || maintenant - courant.depuis > VALIDITE_MS) return null;
  return courant.cid;
}

export function oublierEnAttente(): void {
  enAttente = null;
}

export async function appliquerSuiviEnAttente(
  uid: string,
  suivre: (uid: string, cid: string, oui: boolean) => Promise<void>,
  maintenant: number = Date.now(),
): Promise<boolean> {
  const cid = prendreEnAttente(maintenant);
  if (!cid) return false;
  await suivre(uid, cid, true);
  return true;
}
