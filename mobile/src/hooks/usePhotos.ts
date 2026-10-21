import { useEffect, useState } from "react";
import { genreDuJoueur, type Genre } from "@/lib/genre";
import { cleDeLaLigne, photoDeLaLigne } from "@/lib/photos-sans-compte";
import { API_URL } from "~/lib/config";
import type { Fiche } from "~/lib/fiche-match";

// Les visages, comme le site (hooks/usePhotosDesComptes) : la route publique
// /api/public/photos, une fois par identifiant, et un cache qui dure le temps
// de l'application. Sans photo, la pastille garde son numéro : un échec ne
// se dit pas.

const comptesConnus = new Map<string, string | null>();
const genresConnus = new Map<string, Genre | null>();
const lignesConnues = new Map<string, string | null>();

function useLecture(
  cles: (string | null | undefined)[],
  connus: Map<string, string | null>,
  parametre: "uids" | "lignes",
): Record<string, string | null> {
  const liste = [...new Set(cles.filter((c): c is string => !!c))].sort();
  const cle = liste.join(",");
  const [, setReponses] = useState(0);

  useEffect(() => {
    const manquants = (cle ? cle.split(",") : []).filter((c) => !connus.has(c));
    if (manquants.length === 0) return;
    let vivant = true;
    fetch(`${API_URL}/api/public/photos?${parametre}=${encodeURIComponent(manquants.join(","))}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((j: { photos?: Record<string, string>; genres?: Record<string, Genre>; lignes?: Record<string, string> }) => {
        const lues = parametre === "uids" ? j.photos : j.lignes;
        for (const c of manquants) {
          connus.set(c, lues?.[c] ?? null);
          if (parametre === "uids") genresConnus.set(c, j.genres?.[c] ?? null);
        }
        if (vivant) setReponses((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [cle, connus, parametre]);

  return Object.fromEntries(liste.map((c) => [c, connus.get(c) ?? null]));
}

/**
 * Le visage de chaque ligne des deux feuilles, par identifiant de ligne, et
 * celui de l'homme du match : le compte, la photo posée sur la ligne
 * d'effectif, sinon celle de sa fiche au club (lib/photos-sans-compte).
 */
export function usePhotosDeLaFiche(fiche: Fiche): {
  parLigne: Record<string, string | null>;
  homme: string | null;
  /** « Homme » ou « joueuse » du match : le compte d'abord, la catégorie de la compétition sinon. */
  genreHomme: Genre | null;
} {
  const lignes = Object.values(fiche.lignesPhoto);
  const parCompte = useLecture([...lignes.map((l) => l.user_id), fiche.mvp.userId], comptesConnus, "uids");
  const sansCompte = useLecture(
    lignes.map((l) => (l.user_id || l.photo_url ? null : cleDeLaLigne(l.club, l))),
    lignesConnues,
    "lignes",
  );
  const parLigne: Record<string, string | null> = {};
  for (const l of lignes) parLigne[l.id] = photoDeLaLigne(l, l.club, parCompte, sansCompte);
  const homme = fiche.mvp.userId
    ? parCompte[fiche.mvp.userId] ?? null
    : fiche.mvp.playerId ? parLigne[fiche.mvp.playerId] ?? null : null;
  const genreHomme = genreDuJoueur(
    fiche.mvp.userId ? genresConnus.get(fiche.mvp.userId) ?? null : null,
    fiche.competition?.categorie ?? null,
  );
  return { parLigne, homme, genreHomme };
}
