"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";

// Une pièce de la console live (LiveMatchConsole).

export function useEcrituresEnVol() {
  /**
   * LES ÉCRITURES EN VOL. La console n'attend plus l'accusé du serveur pour
   * rendre la main : c'est ce qui la figeait dès que le réseau tombait — dix-
   * huit boutons grisés, sans un mot. Firestore garde l'écriture dans sa file
   * et l'envoie au retour du réseau ; la console, elle, compte ce qui n'est
   * pas encore parti, pour le dire.
   */
  const [enVol, setEnVol] = useState(0);
  const suivre = useCallback((ecriture: Promise<unknown>, echec: string) => {
    setEnVol((n) => n + 1);
    ecriture
      .catch((err) => {
        console.error(echec, err);
        toast.error(echec);
      })
      .finally(() => setEnVol((n) => Math.max(0, n - 1)));
  }, []);

  return { enVol, suivre };
}
