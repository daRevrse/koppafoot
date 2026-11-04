"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { PiloteConsole } from "@/lib/console-pilote";
import {
  ajouterRetouche, appliquerRetouches, estHorsLigne, lireFile, type Retouche,
} from "@/lib/retouches-en-attente";
import type { CompMatch } from "@/types";

// Une pièce de la console live (LiveMatchConsole).

export function useRetouchesEnAttente(pilote: PiloteConsole, matchBrut: CompMatch | null, enLigne: boolean) {
  /**
   * LES RETOUCHES QUI ATTENDENT LE RÉSEAU : le passeur d'un but, la victime
   * d'une faute, l'issue d'un penalty. Elles s'écrivent par transaction, et
   * une transaction ne part pas hors ligne. On les garde donc ici — et sur
   * l'appareil, pour qu'un rechargement ne les perde pas —, et on les rejoue
   * quand le réseau revient. Voir lib/retouches-en-attente.
   *
   * Tenues par une référence ET un état : la référence pour les gestes lancés
   * depuis un message (« Annuler »), qui voient la file du moment où ils sont
   * lus, l'état pour le rendu.
   */
  const [retouches, setRetouches] = useState<Retouche[]>([]);
  const retouchesRef = useRef<Retouche[]>([]);
  const cleRetouches = matchBrut ? `koppafoot:console-retouches:${matchBrut.competitionId}:${matchBrut.id}` : null;
  const majRetouches = useCallback((changer: (f: Retouche[]) => Retouche[]) => {
    const suivante = changer(retouchesRef.current);
    retouchesRef.current = suivante;
    setRetouches(suivante);
    if (!cleRetouches) return;
    try {
      if (suivante.length > 0) localStorage.setItem(cleRetouches, JSON.stringify(suivante));
      else localStorage.removeItem(cleRetouches);
    } catch {
      // Stockage refusé (navigation privée) : la file tient jusqu'au rechargement.
    }
  }, [cleRetouches]);
  useEffect(() => {
    if (!cleRetouches) return;
    let relue: Retouche[] = [];
    try {
      relue = lireFile(localStorage.getItem(cleRetouches));
    } catch {
      // Voir plus haut.
    }
    retouchesRef.current = relue;
    setRetouches(relue);
  }, [cleRetouches]);

  /**
   * LE MATCH TEL QU'IL SERA, retouches en attente appliquées. C'est lui que
   * toute la console lit : le scoreur voit son passeur tout de suite, pas au
   * retour du réseau.
   */
  const match = useMemo<CompMatch | null>(() => {
    if (!matchBrut?.liveState || retouches.length === 0) return matchBrut;
    return {
      ...matchBrut,
      liveState: { ...matchBrut.liveState, events: appliquerRetouches(matchBrut.liveState.events, retouches) },
    };
  }, [matchBrut, retouches]);

  /** Écrire une retouche par le pilote. Voir lib/retouches-en-attente. */
  const ecrireRetouche = useCallback((r: Retouche): Promise<void> => {
    if (r.genre === "passeur") return pilote.poserPasseur(r.eventId, r.valeur);
    if (r.genre === "victime") return pilote.poserVictime(r.eventId, r.valeur);
    return pilote.poserIssuePenalty(r.eventId, r.valeur.issue, r.valeur.tireur);
  }, [pilote]);

  /**
   * Rejouer la file, dans l'ordre.
   *
   * APRÈS LES ÉCRITURES DE L'APPAREIL : le but d'un passeur en attente est
   * peut-être lui-même encore dans la file de Firestore, et la transaction qui
   * le cherche sur le serveur ne l'y trouverait pas. `ecrituresEnvoyees`
   * attend qu'il y soit.
   */
  const envoiEnCours = useRef(false);
  const envoyerLesRetouches = useCallback(async () => {
    if (envoiEnCours.current || retouchesRef.current.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    envoiEnCours.current = true;
    try {
      await pilote.ecrituresEnvoyees();
      for (const r of [...retouchesRef.current]) {
        try {
          await ecrireRetouche(r);
          // Par identité : une réponse plus récente à la même question a
          // pu la remplacer entre-temps, et celle-là reste à écrire.
          majRetouches((f) => f.filter((x) => x !== r));
        } catch (err) {
          if (estHorsLigne(err)) break;
          // Refusée pour de bon : l'événement a été retiré ailleurs, ou
          // l'écriture n'est pas permise. On l'abandonne, en le disant quand
          // ce n'est pas le premier cas.
          majRetouches((f) => f.filter((x) => x !== r));
          if (!/introuvable/i.test(String((err as { message?: unknown })?.message ?? ""))) {
            toast.error("Une précision n'a pas pu être enregistrée");
          }
        }
      }
    } finally {
      envoiEnCours.current = false;
    }
  }, [pilote, ecrireRetouche, majRetouches]);

  // Au retour du réseau, et toutes les vingt secondes tant qu'il en reste :
  // `navigator.onLine` peut dire oui sur un réseau trop faible pour passer.
  useEffect(() => {
    if (!enLigne || retouches.length === 0) return;
    void envoyerLesRetouches();
    const t = setInterval(() => void envoyerLesRetouches(), 20_000);
    return () => clearInterval(t);
  }, [enLigne, retouches.length, envoyerLesRetouches]);

  /** Poser une retouche : affichée tout de suite, écrite dès que possible. */
  const retoucher = (r: Retouche) => {
    majRetouches((f) => ajouterRetouche(f, r));
    void envoyerLesRetouches();
  };

  return { match, retouches, majRetouches, retoucher };
}
