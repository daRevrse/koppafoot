"use client";

import { useEffect, useState } from "react";

// ============================================
// Le temps qu'il reste avant le coup d'envoi.
//
// Il vivait dans un composant qui dessinait trois grandes cases au milieu du
// fil du match. Le tableau d'affichage le porte désormais, au-dessus de
// l'heure, dans sa version pleine comme dans sa version repliée : un hook,
// pour qu'un seul minuteur serve les deux.
//
// CE QUE ÇA COÛTE : rien côté serveur, rien côté réseau, aucune lecture
// Firestore. Un `setInterval` d'une seconde. La dépense réelle, ce sont trois
// pièges, et ils sont tenus ici :
//
//  1. L'ÉCART D'HYDRATATION. Une horloge rendue sur le serveur afficherait
//     l'heure du serveur, que le client contredirait à la première seconde.
//     Le hook rend donc `null` tant qu'il n'est pas monté.
//
//  2. LA BATTERIE. Un onglet laissé ouvert continuerait de battre la seconde
//     dans le vide. Le tic s'arrête quand la page passe en arrière-plan et
//     reprend au retour, avec un recalcul immédiat.
//
//  3. LA FENÊTRE. Au-delà de 24 h, un compte à rebours n'apprend rien qu'une
//     date ne dise mieux — « dans 13 jours » n'a pas besoin des secondes. Hors
//     de la fenêtre, le hook rend `null` et l'appelant garde sa date : aucun
//     minuteur n'est même créé.
// ============================================

const FENETRE_MS = 24 * 60 * 60 * 1000;

/** Le coup d'envoi, lu dans le fuseau du navigateur. */
function instantDuMatch(date: string, time: string | null): number | null {
  if (!date) return null;
  const d = new Date(`${date}T${(time || "00:00").slice(0, 5)}:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Les millisecondes avant le coup d'envoi quand il tombe dans les 24 h,
 * sinon `null`. Passer `date: null` éteint le compte (match commencé, annulé).
 */
export function useCompteARebours(date: string | null, time: string | null): number | null {
  const [reste, setReste] = useState<number | null>(null);

  useEffect(() => {
    const cible = date ? instantDuMatch(date, time) : null;
    if (cible === null) return;

    const calculer = () => {
      const delta = cible - Date.now();
      // Hors fenêtre, ou déjà passé : on rend la main à l'appelant.
      setReste(delta > 0 && delta <= FENETRE_MS ? delta : null);
      return delta;
    };

    if (calculer() <= 0) return;

    let minuteur: ReturnType<typeof setInterval> | null = null;
    const demarrer = () => {
      if (minuteur !== null) return;
      minuteur = setInterval(() => {
        if (calculer() <= 0 && minuteur !== null) {
          clearInterval(minuteur);
          minuteur = null;
        }
      }, 1000);
    };
    const arreter = () => {
      if (minuteur !== null) { clearInterval(minuteur); minuteur = null; }
    };

    // Piège n°2 : on ne bat la seconde que quand quelqu'un regarde.
    const auChangement = () => {
      if (document.hidden) arreter();
      else { calculer(); demarrer(); }
    };
    document.addEventListener("visibilitychange", auChangement);
    if (!document.hidden) demarrer();

    return () => {
      arreter();
      document.removeEventListener("visibilitychange", auChangement);
    };
  }, [date, time]);

  return reste;
}

/** « 02:44:45 ». */
export function formatCompteARebours(ms: number): string {
  const secondes = Math.floor(ms / 1000);
  return [Math.floor(secondes / 3600), Math.floor((secondes % 3600) / 60), secondes % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
