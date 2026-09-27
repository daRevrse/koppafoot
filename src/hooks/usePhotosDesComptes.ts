import { useEffect, useState } from "react";

// ============================================
// Les photos de profil de quelques comptes, pour une page publique.
//
// Une seule requête pour tous (voir /api/public/photos), et une mémoire pour
// la visite : basculer d'onglet ou recevoir un nouvel événement du direct
// rend la page, pas la liste des joueurs — on ne redemande que ce qu'on n'a
// jamais demandé.
// ============================================

/** `null` : demandé, et sans photo. Absent : jamais demandé. */
const connues = new Map<string, string | null>();

function lire(uids: string[]): Record<string, string | null> {
  const r: Record<string, string | null> = {};
  for (const uid of uids) {
    if (connues.has(uid)) r[uid] = connues.get(uid) ?? null;
  }
  return r;
}

/**
 * La photo de chaque compte, par uid, dès qu'on la connaît.
 *
 * Lue dans la mémoire à chaque rendu : l'état ne sert qu'à en provoquer un
 * quand la réponse arrive.
 */
export function usePhotosDesComptes(uids: (string | null | undefined)[]): Record<string, string | null> {
  const liste = [...new Set(uids.filter((u): u is string => !!u))].sort();
  const cle = liste.join(",");
  const [, setReponses] = useState(0);

  useEffect(() => {
    const manquants = (cle ? cle.split(",") : []).filter((u) => !connues.has(u));
    if (manquants.length === 0) return;
    let vivant = true;
    fetch(`/api/public/photos?uids=${encodeURIComponent(manquants.join(","))}`)
      .then((r) => (r.ok ? r.json() : { photos: {} }))
      .then((j: { photos?: Record<string, string> }) => {
        for (const uid of manquants) connues.set(uid, j.photos?.[uid] ?? null);
        if (vivant) setReponses((n) => n + 1);
      })
      .catch(() => {
        // Sans photo, les initiales et les numéros restent : rien ne manque.
      });
    return () => { vivant = false; };
  }, [cle]);

  return lire(liste);
}
