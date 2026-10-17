"use client";

import { useEffect, useRef } from "react";
import { arrayUnion, doc, increment, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  appareilDuJour, idSession, jourAudience, lireVia, minuteDe, type AppareilStocke,
} from "@/lib/audience";

// ============================================
// La mesure d'audience, côté navigateur (voir lib/audience).
//
// À l'ouverture d'une page cible : une visite. Pendant un direct, page
// visible : un battement par minute. JAMAIS BLOQUANT — une écriture refusée,
// hors ligne ou impossible est oubliée, la page ne le saura pas.
//
// Les règles Firestore valident chaque écriture (voir firestore.rules,
// `audience`) : un visiteur sans compte écrit, mais seulement ce qu'une
// session de mesure peut contenir.
// ============================================

const CLE = "koppafoot:audience";

function lireStockage(): unknown {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? "null");
  } catch {
    return null;
  }
}

function ecrireStockage(a: AppareilStocke): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(a));
  } catch {
    // Navigation privée, stockage plein : la mesure s'en passe.
  }
}

/** Un navigateur piloté (robot, test) ne compte pas. */
const estPilote = () => typeof navigator !== "undefined" && navigator.webdriver === true;

/**
 * Mesurer l'audience d'une page.
 *
 * `cible` : `comp-{cid}` ou `match-{mid}` (lib/audience), `null` tant qu'on ne
 * sait pas ce que la page montre. `direct` : le match est en cours, chaque
 * minute de page visible compte. `cid` : la compétition d'un match de
 * compétition.
 */
export function useAudience(
  cible: string | null,
  { direct = false, cid = null }: { direct?: boolean; cid?: string | null } = {},
): void {
  // La session de cette page, une fois connue : le battement s'en sert.
  const session = useRef<{ cible: string; ref: ReturnType<typeof doc> } | null>(null);
  const derniereMinute = useRef<number | null>(null);

  // La visite, une fois par page et par cible.
  useEffect(() => {
    if (!cible || estPilote()) return;
    const jour = jourAudience();
    const appareil = appareilDuJour(lireStockage(), jour);
    const ref = doc(db, "audience", cible, "sessions", idSession(jour, appareil.appareil));
    session.current = { cible, ref };

    const visible = document.visibilityState === "visible";
    const minute = direct && visible ? minuteDe(Date.now()) : null;
    if (minute != null) derniereMinute.current = minute;

    const creer = () => setDoc(ref, {
      jour,
      vues: 1,
      premiere: serverTimestamp(),
      derniere: serverTimestamp(),
      minutes: minute != null ? [minute] : [],
      via: lireVia(new URLSearchParams(window.location.search).get("via")),
      connecte: auth.currentUser != null,
      ...(cid ? { cid } : {}),
    });
    const ajouter = () => updateDoc(ref, {
      vues: increment(1),
      derniere: serverTimestamp(),
      ...(minute != null ? { minutes: arrayUnion(minute) } : {}),
    });

    // La session du jour existe-t-elle déjà ? Le stockage le dit, sans lecture
    // (les sessions ne se lisent pas depuis un navigateur). S'il se trompe — un
    // autre onglet, un stockage effacé —, on tente l'autre écriture.
    const connue = appareil.cibles.includes(cible);
    (connue ? ajouter().catch(creer) : creer().catch(ajouter))
      .then(() => {
        if (!connue) ecrireStockage({ ...appareil, cibles: [...appareil.cibles, cible] });
        else ecrireStockage(appareil);
      })
      .catch(() => {
        // Refusée ou impossible : la page continue sans mesure.
      });

    return () => {
      session.current = null;
    };
    // `cid` accompagne la cible, il ne change pas sans elle ; `direct` qui
    // bascule ensuite est l'affaire du battement, pas d'une seconde visite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cible]);

  // Le battement : une minute de direct à la fois, page visible seulement.
  useEffect(() => {
    if (!cible || !direct || estPilote()) return;
    let minuteur: ReturnType<typeof setTimeout> | null = null;

    const battre = () => {
      const s = session.current;
      if (!s || s.cible !== cible || document.visibilityState !== "visible") return;
      const minute = minuteDe(Date.now());
      if (derniereMinute.current === minute) return;
      derniereMinute.current = minute;
      updateDoc(s.ref, { minutes: arrayUnion(minute), derniere: serverTimestamp() }).catch(() => {
        // Le battement suivant réessaiera la minute suivante.
      });
    };

    // À une seconde tirée au hasard dans chaque minute : mille spectateurs
    // n'écrivent pas tous à la même seconde.
    const planifier = () => {
      const maintenant = Date.now();
      const debutMinuteSuivante = (minuteDe(maintenant) + 1) * 60_000;
      const delai = debutMinuteSuivante - maintenant + Math.floor(Math.random() * 50_000);
      minuteur = setTimeout(() => {
        battre();
        planifier();
      }, delai);
    };

    // Le direct commence page ouverte, ou la page revient au premier plan : la
    // minute en cours part tout de suite.
    battre();
    planifier();
    const auRetour = () => {
      if (document.visibilityState === "visible") battre();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      if (minuteur) clearTimeout(minuteur);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [cible, direct]);
}

/** La même mesure, à poser dans une page serveur ou un gabarit. */
export function MesureAudience(props: { cible: string | null; direct?: boolean; cid?: string | null }): null {
  useAudience(props.cible, { direct: props.direct, cid: props.cid });
  return null;
}
