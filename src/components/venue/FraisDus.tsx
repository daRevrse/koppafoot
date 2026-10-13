"use client";

import { useEffect, useState } from "react";
import type { VueReglement } from "@/lib/reglement";
import { appeler } from "@/lib/reservations-client";

// ============================================
// Ce qui est dû au gérant pour une réservation close, et si c'est versé.
//
// La liste des réservations dit comment une réservation a fini (sa copie
// d'affichage) ; ce qui est dû, et la date du versement, se lisent au
// serveur. Une ligne par réservation close : on ne lit que celles-là.
// ============================================

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

export function FraisDus({ reservationId }: { reservationId: string }) {
  const [du, setDu] = useState<VueReglement["du"]>(null);

  useEffect(() => {
    let vivant = true;
    appeler<VueReglement>(`/api/reservations/${reservationId}/reglement`, "GET")
      .then((vue) => { if (vivant) setDu(vue.du); })
      .catch(() => {});
    return () => { vivant = false; };
  }, [reservationId]);

  if (!du) return null;
  return (
    <p className="mt-2 text-[11px] font-bold text-gray-500">
      {du.verseLe
        ? `Frais de réservation versés le ${new Date(du.verseLe).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} : ${fcfa(du.montant)}.`
        : `Frais de réservation dus : ${fcfa(du.montant)}. Ils te sont versés quelques jours après le match.`}
    </p>
  );
}
