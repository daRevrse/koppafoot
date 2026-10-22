import AsyncStorage from "@react-native-async-storage/async-storage";
import { arrayUnion, doc, increment, serverTimestamp, setDoc, updateDoc, type DocumentReference } from "firebase/firestore";
import { useEffect, useRef } from "react";
import { appareilDuJour, idSession, jourAudience, minuteDe, type AppareilStocke } from "@/lib/audience";
import { usePremierPlan } from "~/hooks/usePremierPlan";
import { auth, db } from "~/lib/firebase";

// La mesure d'audience du site (lib/audience-client), depuis l'application :
// une session par appareil, par jour et par page, et les minutes de direct
// passées à l'écran. Les visites venues de l'application se lisent « app »
// dans les statistiques des organisateurs. Rien ne se dit en cas d'échec :
// mesurer ne doit jamais gêner la lecture.

const CLE = "koppafoot:audience";

async function lireStockage(): Promise<unknown> {
  try {
    return JSON.parse((await AsyncStorage.getItem(CLE)) ?? "null");
  } catch {
    return null;
  }
}

function ecrireStockage(a: AppareilStocke): void {
  AsyncStorage.setItem(CLE, JSON.stringify(a)).catch(() => {});
}

/** Compte une visite de `cible`, et chaque minute de direct tant que l'application est à l'écran. */
export function useAudience(cible: string | null, { direct = false, cid = null }: { direct?: boolean; cid?: string | null } = {}): void {
  const actif = usePremierPlan();
  const session = useRef<{ cible: string; ref: DocumentReference } | null>(null);
  const derniereMinute = useRef<number | null>(null);

  useEffect(() => {
    if (!cible) return;
    let vivant = true;
    void (async () => {
      const jour = jourAudience();
      const appareil = appareilDuJour(await lireStockage(), jour);
      if (!vivant) return;
      const ref = doc(db, "audience", cible, "sessions", idSession(jour, appareil.appareil));
      session.current = { cible, ref };
      const minute = direct ? minuteDe(Date.now()) : null;
      if (minute != null) derniereMinute.current = minute;

      const creer = () => setDoc(ref, {
        jour,
        vues: 1,
        premiere: serverTimestamp(),
        derniere: serverTimestamp(),
        minutes: minute != null ? [minute] : [],
        via: "app",
        connecte: auth.currentUser != null,
        ...(cid ? { cid } : {}),
      });
      const ajouter = () => updateDoc(ref, {
        vues: increment(1),
        derniere: serverTimestamp(),
        ...(minute != null ? { minutes: arrayUnion(minute) } : {}),
      });
      const connue = appareil.cibles.includes(cible);
      try {
        await (connue ? ajouter().catch(creer) : creer().catch(ajouter));
        ecrireStockage(connue ? appareil : { ...appareil, cibles: [...appareil.cibles, cible] });
      } catch {
        // Hors ligne, ou refusé : la visite ne compte pas, la page s'affiche quand même.
      }
    })();
    return () => {
      vivant = false;
      session.current = null;
    };
    // Une visite par arrivée sur la page : ni `direct` ni `cid` ne la recomptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cible]);

  // Les minutes de direct : une par minute de mur, tant que l'application est
  // à l'écran (la page du site écoute `visibilitychange`, l'application son état).
  useEffect(() => {
    if (!cible || !direct || !actif) return;
    const battre = () => {
      const s = session.current;
      if (!s || s.cible !== cible) return;
      const minute = minuteDe(Date.now());
      if (derniereMinute.current === minute) return;
      derniereMinute.current = minute;
      updateDoc(s.ref, { minutes: arrayUnion(minute), derniere: serverTimestamp() }).catch(() => {});
    };
    battre();
    const t = setInterval(battre, 20_000);
    return () => clearInterval(t);
  }, [cible, direct, actif]);
}
