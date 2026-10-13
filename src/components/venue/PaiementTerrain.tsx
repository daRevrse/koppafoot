"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { acompteDe } from "@/lib/reglement";
import { appeler } from "@/lib/reservations-client";
import { Bouton, classeChamp } from "@/components/venue/venue-ui";

// ============================================
// Les frais de réservation d'un terrain, côté propriétaire : les activer,
// dire où être versé, régler le battement.
//
// CE QU'IL FAUT QU'IL SACHE AVANT D'ACTIVER, dit ici et pas dans des
// conditions : l'équipe paie 5 % dans l'application, le reste en liquide chez
// lui ; les frais lui reviennent si l'équipe ne vient pas ; il les rend s'il
// annule. Son prix reste son prix.
//
// TANT QUE LE PAIEMENT N'EST PAS EN SERVICE, SEUL LE BATTEMENT SE RÈGLE. Le
// serveur dit s'il l'est (`disponible`) : proposer d'activer des frais que
// les équipes ne pourraient pas payer ferait une promesse à sa place. Le
// battement, lui, n'a rien à voir avec l'argent.
// ============================================

interface Etat { actif: boolean; disponible: boolean; numero: string | null; battement: number; tarif: number }

export function PaiementTerrain({ venueId, tarif }: { venueId: string; tarif: number }) {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [actif, setActif] = useState(false);
  const [numero, setNumero] = useState("");
  const [battement, setBattement] = useState(0);
  const [envoi, setEnvoi] = useState(false);

  const poser = (e: Etat) => {
    setEtat(e);
    setActif(e.actif);
    setNumero(e.numero ?? "");
    setBattement(e.battement);
  };

  useEffect(() => {
    let vivant = true;
    appeler<Etat>(`/api/venues/${venueId}/paiement`, "GET")
      .then((e) => { if (vivant) poser(e); })
      .catch(() => {});
    return () => { vivant = false; };
  }, [venueId]);

  if (!etat) return null;

  const enregistrer = async () => {
    setEnvoi(true);
    try {
      poser(await appeler<Etat>(`/api/venues/${venueId}/paiement`, "PUT", { actif, numero, battement }));
      toast.success(actif && !etat.actif ? "Frais de réservation activés" : "Réglages enregistrés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'enregistrement a échoué");
    } finally {
      setEnvoi(false);
    }
  };

  const inchange = actif === etat.actif && numero.trim() === (etat.numero ?? "") && battement === etat.battement;
  const exemple = acompteDe(tarif);

  const champBattement = (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
        Battement après chaque créneau
      </span>
      <select value={battement} onChange={(e) => setBattement(Number(e.target.value))} className={classeChamp}>
        <option value={0}>Aucun</option>
        <option value={15}>15 minutes</option>
        <option value={30}>30 minutes</option>
      </select>
    </label>
  );

  return (
    <div className="border-t border-gray-200/70 px-5 py-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
        {etat.disponible ? "Frais de réservation et battement" : "Battement"}
      </p>

      {etat.disponible ? (
        <>
          <label className="mt-3 flex items-start gap-2.5 text-sm font-bold text-gray-900">
            <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} className="mt-1" />
            <span>
              Faire payer les frais de réservation dans l&apos;application
              <span className="mt-0.5 block text-[11px] font-semibold leading-relaxed text-gray-500">
                Une fois que tu as confirmé un créneau, l&apos;équipe paie 5 % du prix
                {exemple > 0 ? ` (${exemple.toLocaleString("fr-FR")} FCFA pour une heure)` : ""}{" "}et reçoit un ticket,
                que tu valides à son arrivée. Elle te règle le reste sur place : ton prix reste ton prix. Si elle ne
                vient pas ou annule, les frais te restent ; si c&apos;est toi qui annules, ils lui sont rendus.
              </span>
            </span>
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                Numéro mobile money où te verser
              </span>
              <input
                inputMode="tel"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="90 12 34 56"
                className={classeChamp}
              />
            </label>
            {champBattement}
          </div>
        </>
      ) : (
        <div className="mt-3 max-w-xs">{champBattement}</div>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
        Le battement garde ton terrain après chaque créneau, pour qu&apos;un match parti en retard ne déborde pas sur
        le suivant.{etat.disponible ? " Les frais te sont versés après le match, quelques jours plus tard." : ""}
      </p>

      <Bouton petit occupe={envoi} disabled={inchange} onClick={() => void enregistrer()} className="mt-3">
        Enregistrer
      </Bouton>
    </div>
  );
}
