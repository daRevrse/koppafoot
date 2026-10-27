import { useCallback, useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/fil-actus";
import { usePremierPlan } from "~/hooks/usePremierPlan";
import { aRecharger, chargerActus } from "~/lib/actus";

/**
 * Le fil d'Actus : chargé à l'ouverture de l'onglet, au glisser-pour-rafraîchir,
 * et au retour dans l'application s'il a plus d'un quart d'heure (aRecharger).
 * Rien n'écoute en continu : un titre de presse n'est pas un score.
 */
export function useActus() {
  const actif = usePremierPlan();
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [majA, setMajA] = useState<Date | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const [chargement, setChargement] = useState(false);

  const charger = useCallback(async () => {
    try {
      const fil = await chargerActus();
      setArticles(fil);
      setMajA(new Date());
      setHorsLigne(false);
    } catch {
      // On garde le fil affiché ; l'écran dit qu'il date.
      setHorsLigne(true);
    }
  }, []);

  // Comme le Direct : seul le geste de l'utilisateur fait tourner l'indicateur.
  const rafraichir = useCallback(async () => {
    setChargement(true);
    await charger();
    setChargement(false);
  }, [charger]);

  // L'heure du dernier chargement réussi, pour ne pas en dépendre : l'effet la changerait lui-même.
  const charge = useRef<Date | null>(null);
  useEffect(() => {
    charge.current = majA;
  }, [majA]);

  useEffect(() => {
    if (actif && aRecharger(charge.current, new Date())) void charger();
  }, [actif, charger]);

  return { articles, majA, horsLigne, chargement, rafraichir };
}
