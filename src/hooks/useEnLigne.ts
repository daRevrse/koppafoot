import { useSyncExternalStore } from "react";

// ============================================
// L'appareil a-t-il du réseau ?
//
// `navigator.onLine` ne promet qu'une chose : quand il dit NON, il n'y a
// vraiment pas de réseau. Quand il dit oui, le réseau peut encore être trop
// faible pour passer. Il sert donc à annoncer la coupure franche ; la lenteur
// se lit ailleurs, aux écritures qui tardent à partir.
// ============================================

function abonner(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useEnLigne(): boolean {
  return useSyncExternalStore(
    abonner,
    () => navigator.onLine,
    // Au rendu serveur, on ne sait rien : on suppose le réseau, comme avant.
    () => true,
  );
}
