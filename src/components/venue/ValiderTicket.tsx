"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Check, Ticket } from "lucide-react";
import type { ResumeTicket } from "@/lib/reglement";
import { appeler } from "@/lib/reservations-client";
import { dateLongue, finCreneau } from "@/lib/terrains";
import { Bouton, classeChamp } from "@/components/venue/venue-ui";

// ============================================
// Valider le ticket d'une équipe arrivée sur place.
//
// DEUX PORTES, UN MÊME GESTE. Le gérant tape le code ici, ou scanne le QR
// avec l'appareil photo de son téléphone, qui ouvre /ticket/{code}. Les deux
// montrent d'abord ce que dit le ticket, puis demandent de valider : on ne
// déclare pas une équipe présente en ouvrant un lien.
// ============================================

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

/** Ce que dit un ticket, et le bouton pour le valider. */
export function TicketLu({ resume, onValider, occupe }: { resume: ResumeTicket; onValider: () => void; occupe: boolean }) {
  return (
    <div className="border border-gray-200/70 bg-white p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">{resume.terrain}</p>
      <p className="mt-1 text-lg font-black text-gray-900">{resume.equipe}</p>
      <p className="mt-1 text-[11px] font-bold text-gray-500">
        {dateLongue(resume.date)} · {resume.time} → {finCreneau(resume.time, resume.duration)}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-px border border-gray-200/70 bg-gray-200/70">
        <div className="bg-white px-3 py-2.5">
          <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">Frais déjà payés</dt>
          <dd className="mt-0.5 text-sm font-black text-emerald-700">{fcfa(resume.acompte)}</dd>
        </div>
        <div className="bg-white px-3 py-2.5">
          <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">Reste à régler sur place</dt>
          <dd className="mt-0.5 text-sm font-black text-gray-900">{fcfa(resume.reste)}</dd>
        </div>
      </dl>
      {resume.valide ? (
        <p className="mt-4 flex items-center gap-1.5 text-sm font-black text-emerald-700">
          <Check size={15} /> Ticket validé
        </p>
      ) : (
        <Bouton Icon={Check} occupe={occupe} onClick={onValider} className="mt-4">
          Valider le ticket
        </Bouton>
      )}
    </div>
  );
}

export function ValiderTicket() {
  const [code, setCode] = useState("");
  const [resume, setResume] = useState<ResumeTicket | null>(null);
  const [occupe, setOccupe] = useState(false);

  const lire = async () => {
    setOccupe(true);
    try {
      setResume(await appeler<ResumeTicket>(`/api/reservations/ticket?code=${encodeURIComponent(code.trim())}`, "GET"));
    } catch (err) {
      setResume(null);
      toast.error(err instanceof Error ? err.message : "Ticket introuvable");
    } finally {
      setOccupe(false);
    }
  };

  const valider = async () => {
    setOccupe(true);
    try {
      setResume(await appeler<ResumeTicket>("/api/reservations/ticket", "POST", { code: code.trim() }));
      toast.success("Ticket validé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "La validation a échoué");
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="mt-6 border border-gray-200/70 bg-gray-50 p-5">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">
        <Ticket size={12} /> Valider un ticket
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); void lire(); }}
      >
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setResume(null); }}
          placeholder="Code à 6 caractères"
          maxLength={9}
          autoCapitalize="characters"
          autoComplete="off"
          className={`${classeChamp} max-w-[14rem] font-black tracking-[0.2em]`}
        />
        <Bouton petit variante="contour" occupe={occupe && !resume} disabled={code.trim().length < 6} type="submit">
          Lire le ticket
        </Bouton>
      </form>
      <p className="mt-2 text-[11px] text-gray-500">
        Ou scanne le QR code de l&apos;équipe avec l&apos;appareil photo de ton téléphone.
      </p>
      {resume && (
        <div className="mt-4">
          <TicketLu resume={resume} onValider={() => void valider()} occupe={occupe} />
        </div>
      )}
    </div>
  );
}
