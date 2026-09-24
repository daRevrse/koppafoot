import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompetitionFeed } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";
import { isWorldComp } from "@/lib/world-board-shared";
import type { CompMatch } from "@/types";
import { usePremierPlan } from "~/hooks/usePremierPlan";
import { chargerDirect } from "~/lib/direct-api";
import { ecouterAmicauxEnCours, ecouterMatchsCompetition } from "~/lib/direct-firestore";
import { appliquerEcoutes, fusionnerAmicaux, remplacerMatchs } from "~/lib/direct-tableau";

/**
 * Le tableau du Direct : l'API au lancement, au glisser-pour-rafraîchir et au
 * retour au premier plan ; les écouteurs Firestore par-dessus, comme sur le
 * site.
 *
 * LES ÉCOUTEURS SE COUPENT EN ARRIÈRE-PLAN. Un tableau ouvert au fond d'une
 * poche, c'est de la batterie et du forfait pour personne — et pour ce public
 * le forfait compte. Ils se rebranchent au retour, avec un rafraîchissement.
 */
export function useDirect() {
  const actif = usePremierPlan();
  const [feed, setFeed] = useState<CompetitionFeed[] | null>(null);
  const [majA, setMajA] = useState<Date | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const [chargement, setChargement] = useState(false);

  // Ce que les écouteurs ont dit en dernier : plus frais que l'API (voir appliquerEcoutes).
  const ecoutes = useRef(new Map<string, CompMatch[]>());
  const amicaux = useRef<CompMatch[] | null>(null);

  const charger = useCallback(async () => {
    try {
      const board = await chargerDirect();
      setFeed(appliquerEcoutes(board, ecoutes.current, amicaux.current));
      setMajA(new Date());
      setHorsLigne(false);
    } catch {
      // On garde le tableau affiché ; l'écran dit qu'il date.
      setHorsLigne(true);
    }
  }, []);

  // Le geste de l'utilisateur (tirer pour rafraîchir, « Réessayer ») montre
  // qu'il travaille ; le rechargement au retour au premier plan, non — sans
  // quoi l'indicateur tournerait à chaque fois qu'on revient dans l'application.
  const rafraichir = useCallback(async () => {
    setChargement(true);
    await charger();
    setChargement(false);
  }, [charger]);

  useEffect(() => {
    if (actif) void charger();
  }, [actif, charger]);

  // Chaîne stable : le flux change à chaque score, la liste des compétitions non.
  const ids = useMemo(
    () =>
      (feed ?? [])
        .map((f) => f.competition.id)
        .filter((id) => id !== FRIENDLY_COMP_ID && !isWorldComp(id))
        .join(","),
    [feed],
  );

  useEffect(() => {
    if (!actif || !ids) return;
    const carte = ecoutes.current;
    const arrets = ids.split(",").map((cid) =>
      ecouterMatchsCompetition(cid, (matches) => {
        carte.set(cid, matches);
        setFeed((prev) => (prev ? remplacerMatchs(prev, cid, matches) : prev));
      }),
    );
    return () => {
      arrets.forEach((arret) => arret());
      carte.clear();
    };
  }, [actif, ids]);

  useEffect(() => {
    if (!actif) return;
    const arret = ecouterAmicauxEnCours((frais) => {
      amicaux.current = frais;
      setFeed((prev) => (prev ? fusionnerAmicaux(prev, frais) : prev));
    });
    return () => {
      arret();
      amicaux.current = null;
    };
  }, [actif]);

  // La minute avance seule entre deux écritures Firestore.
  const [, battre] = useState(0);
  useEffect(() => {
    if (!actif) return;
    const t = setInterval(() => battre((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [actif]);

  return { feed, majA, horsLigne, chargement, rafraichir };
}
