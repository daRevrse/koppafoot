import { useEffect, useState } from "react";
import type { Genre } from "@/lib/genre";

// ============================================
// Les photos de profil de quelques comptes, pour une page publique — et leur
// genre, qui vient avec.
//
// Une seule requête pour tous (voir /api/public/photos), et une mémoire pour
// la visite : basculer d'onglet ou recevoir un nouvel événement du direct
// rend la page, pas la liste des joueurs — on ne redemande que ce qu'on n'a
// jamais demandé.
//
// LE GENRE PASSE PAR LA MÊME REQUÊTE : il accorde ce que la fiche dit des
// joueurs (« Joueuse du match », « Gardienne »), et les deux se demandent
// pour les mêmes comptes, au même moment. Deux crochets qui liraient chacun
// de leur côté feraient deux allers-retours pour une seule feuille.
// ============================================

interface Compte {
  photo: string | null;
  genre: Genre | null;
}

/** Présent : demandé (photo ou genre éventuellement nuls). Absent : jamais demandé. */
const connus = new Map<string, Compte>();

export interface ComptesPublics {
  photos: Record<string, string | null>;
  genres: Record<string, Genre | null>;
}

function lire(uids: string[]): ComptesPublics {
  const photos: Record<string, string | null> = {};
  const genres: Record<string, Genre | null> = {};
  for (const uid of uids) {
    const c = connus.get(uid);
    if (!c) continue;
    photos[uid] = c.photo;
    genres[uid] = c.genre;
  }
  return { photos, genres };
}

/**
 * La photo et le genre de chaque compte, par uid, dès qu'on les connaît.
 *
 * Lus dans la mémoire à chaque rendu : l'état ne sert qu'à en provoquer un
 * quand la réponse arrive.
 */
export function useComptesPublics(uids: (string | null | undefined)[]): ComptesPublics {
  const liste = [...new Set(uids.filter((u): u is string => !!u))].sort();
  const cle = liste.join(",");
  const [, setReponses] = useState(0);

  useEffect(() => {
    const manquants = (cle ? cle.split(",") : []).filter((u) => !connus.has(u));
    if (manquants.length === 0) return;
    let vivant = true;
    fetch(`/api/public/photos?uids=${encodeURIComponent(manquants.join(","))}`)
      .then((r) => (r.ok ? r.json() : { photos: {}, genres: {} }))
      .then((j: { photos?: Record<string, string>; genres?: Record<string, Genre> }) => {
        for (const uid of manquants) {
          connus.set(uid, { photo: j.photos?.[uid] ?? null, genre: j.genres?.[uid] ?? null });
        }
        if (vivant) setReponses((n) => n + 1);
      })
      .catch(() => {
        // Sans photo, les initiales et les numéros restent ; sans genre, le
        // masculin par défaut. Rien ne manque.
      });
    return () => { vivant = false; };
  }, [cle]);

  return lire(liste);
}

/** La photo seule, pour les écrans qui n'accordent rien. */
export function usePhotosDesComptes(uids: (string | null | undefined)[]): Record<string, string | null> {
  return useComptesPublics(uids).photos;
}
