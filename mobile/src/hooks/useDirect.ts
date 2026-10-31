import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompetitionFeed } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";
import { isWorldComp } from "@/lib/world-board-shared";
import type { CompMatch } from "@/types";
import { usePremierPlan } from "~/hooks/usePremierPlan";
import { chargerDirect, delaiDuNouvelEssai } from "~/lib/direct-api";
import { ecouterAmicauxEnCours, ecouterMatchsCompetition } from "~/lib/direct-firestore";
import { garderDirect, lireDirectGarde } from "~/lib/direct-garde";
import { appliquerEcoutes, fusionnerAmicaux, remplacerMatchs } from "~/lib/direct-tableau";

/** Le réseau tarde au-delà de ce délai : l'écran dit que le tableau gardé date. Avant, ça clignoterait. */
const ATTENTE_AVANT_DE_LE_DIRE = 4000;

/**
 * Le tableau du Direct : le dernier gardé sur le téléphone dès l'ouverture, puis
 * l'API au lancement, au glisser-pour-rafraîchir et au retour au premier plan ;
 * les écouteurs Firestore par-dessus, comme sur le site.
 *
 * LES ÉCOUTEURS SE COUPENT EN ARRIÈRE-PLAN. Un tableau ouvert au fond d'une
 * poche, c'est de la batterie et du forfait pour personne — et pour ce public
 * le forfait compte. Ils se rebranchent au retour, avec un rafraîchissement.
 *
 * LE RÉSEAU QUI REVIENT RÉPARE L'ÉCRAN TOUT SEUL : après un échec, on réessaie,
 * de plus en plus loin. Personne ne devrait avoir à toucher « Réessayer » pour
 * apprendre que sa connexion est revenue.
 */
export function useDirect() {
  const actif = usePremierPlan();
  const [feed, setFeed] = useState<CompetitionFeed[] | null>(null);
  const [majA, setMajA] = useState<Date | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [echecs, setEchecs] = useState(0);
  // Le tableau à l'écran vient du téléphone : le réseau n'a pas encore répondu.
  const [depuisLeTelephone, setDepuisLeTelephone] = useState(false);
  const [patienceEpuisee, setPatienceEpuisee] = useState(false);

  // Ce que les écouteurs ont dit en dernier : plus frais que l'API (voir appliquerEcoutes).
  const ecoutes = useRef(new Map<string, CompMatch[]>());
  const amicaux = useRef<CompMatch[] | null>(null);
  const reseauARepondu = useRef(false);
  const enCours = useRef<Promise<void> | null>(null);

  // Un seul chargement à la fois : sur un réseau lent, ils s'empileraient sur le forfait.
  const charger = useCallback(() => {
    if (enCours.current) return enCours.current;
    const requete = (async () => {
      try {
        const board = await chargerDirect();
        const maintenant = new Date();
        reseauARepondu.current = true;
        setFeed(appliquerEcoutes(board, ecoutes.current, amicaux.current));
        setMajA(maintenant);
        setHorsLigne(false);
        setEchecs(0);
        setDepuisLeTelephone(false);
        void garderDirect(board, maintenant.getTime());
      } catch {
        // On garde le tableau affiché ; l'écran dit qu'il date.
        setHorsLigne(true);
        setEchecs((n) => n + 1);
      } finally {
        enCours.current = null;
      }
    })();
    enCours.current = requete;
    return requete;
  }, []);

  useEffect(() => {
    let parti = false;
    void lireDirectGarde().then((garde) => {
      // Le réseau a pu répondre le premier : son tableau est plus frais.
      if (!garde || parti || reseauARepondu.current) return;
      setFeed(appliquerEcoutes(garde.board, ecoutes.current, amicaux.current));
      setMajA(new Date(garde.majA));
      setDepuisLeTelephone(true);
    });
    return () => {
      parti = true;
    };
  }, []);

  useEffect(() => {
    if (!depuisLeTelephone) return;
    const t = setTimeout(() => setPatienceEpuisee(true), ATTENTE_AVANT_DE_LE_DIRE);
    return () => clearTimeout(t);
  }, [depuisLeTelephone]);

  useEffect(() => {
    if (!actif || echecs === 0) return;
    const t = setTimeout(() => void charger(), delaiDuNouvelEssai(echecs));
    return () => clearTimeout(t);
  }, [actif, echecs, charger]);

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

  return { feed, majA, horsLigne, miseAJourLente: depuisLeTelephone && patienceEpuisee, chargement, rafraichir };
}
