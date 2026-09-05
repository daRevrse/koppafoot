"use client";

import { useEffect, useState } from "react";

// ============================================
// Le temps qu'il reste avant le coup d'envoi.
//
// CE QUE ÇA COÛTE, puisque la question s'est posée : rien côté serveur, rien
// côté réseau, aucune lecture Firestore. Un `setInterval` d'une seconde et
// le rendu d'un composant feuille — quatre nombres. La dépense réelle n'est
// pas la ressource, ce sont trois pièges, et ils sont tenus ici :
//
//  1. L'ÉCART D'HYDRATATION. Une horloge rendue sur le serveur affiche
//     l'heure du serveur, que le client contredit à la première seconde, et
//     React se plaint. Le composant ne calcule donc RIEN avant d'être monté :
//     il rend `null` au premier passage, puis le compte à rebours.
//
//  2. LA BATTERIE. Un onglet laissé ouvert continuerait de battre la seconde
//     dans le vide. Le tic s'arrête quand la page passe en arrière-plan et
//     reprend au retour — avec un recalcul immédiat, sinon l'affichage
//     reprendrait là où il s'était arrêté.
//
//  3. LA FENÊTRE. Au-delà de 24 h, un compte à rebours n'apprend rien qu'une
//     date ne dise mieux — « dans 13 jours » n'a pas besoin des secondes. En
//     dehors de la fenêtre, le composant rend `null` et l'appelant garde son
//     texte : aucun minuteur n'est même créé.
// ============================================

const FENETRE_MS = 24 * 60 * 60 * 1000;

/** Le coup d'envoi, lu dans le fuseau du navigateur. */
function instantDuMatch(date: string, time: string | null): number | null {
  if (!date) return null;
  const d = new Date(`${date}T${(time || "00:00").slice(0, 5)}:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function Case({ valeur, unite }: { valeur: number; unite: string }) {
  return (
    <div className="flex min-w-[3.5rem] flex-col items-center">
      <span className="font-display text-3xl font-black tabular-nums leading-none text-gray-900 sm:text-4xl">
        {String(valeur).padStart(2, "0")}
      </span>
      <span className="mt-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-gray-400">
        {unite}
      </span>
    </div>
  );
}

export default function CompteARebours({
  date,
  time,
  children,
}: {
  date: string | null;
  time: string | null;
  /**
   * Ce qui s'affiche quand le compte a rebours n'a rien a dire : hors
   * fenetre, match annule, ou avant le montage.
   *
   * C'est le composant qui tranche, et lui seul. Laisser l'appelant calculer
   * « sommes-nous a moins de 24 h ? » aurait mis une seconde valeur dependante
   * de l'heure dans son rendu — donc un ecart entre le serveur et le client,
   * c'est-a-dire le piege n°1 deplace d'un cran.
   */
  children?: React.ReactNode;
}) {
  // `null` tant qu'on n'est pas monté : voir le piège n°1.
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

  if (reste === null) return <>{children}</>;

  const secondes = Math.floor(reste / 1000);
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = secondes % 60;

  return (
    <div className="flex flex-col items-center">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
        Coup d&apos;envoi dans
      </p>
      <div
        className="mt-3 flex items-start gap-3 sm:gap-5"
        role="timer"
        aria-live="off"
        aria-label={`Coup d'envoi dans ${h} heures ${m} minutes`}
      >
        <Case valeur={h} unite="heures" />
        <span aria-hidden className="font-display text-3xl font-black leading-none text-gray-200 sm:text-4xl">:</span>
        <Case valeur={m} unite="minutes" />
        <span aria-hidden className="font-display text-3xl font-black leading-none text-gray-200 sm:text-4xl">:</span>
        <Case valeur={s} unite="secondes" />
      </div>
    </div>
  );
}
