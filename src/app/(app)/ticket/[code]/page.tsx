"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { ResumeTicket } from "@/lib/reglement";
import { appeler } from "@/lib/reservations-client";
import { TicketLu } from "@/components/venue/ValiderTicket";
import { EnCours, FilAriane, LienBouton } from "@/components/venue/venue-ui";

// ============================================
// La page d'un ticket : celle que le QR code ouvre.
//
// LE GÉRANT SCANNE AVEC L'APPAREIL PHOTO DE SON TÉLÉPHONE, qui ouvre cette
// adresse dans son navigateur, où il est connecté. Aucun lecteur à installer.
//
// OUVRIR N'EST PAS VALIDER. La page montre ce que dit le ticket et demande le
// geste. Pour tout autre que le gérant du terrain, le serveur ne reconnaît
// pas le code : un ticket photographié ne sert à rien à qui n'a pas le terrain.
// ============================================

export default function PageTicket() {
  const { code } = useParams<{ code: string }>();
  const { user, loading } = useAuth();
  const [resume, setResume] = useState<ResumeTicket | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    if (!user) return;
    let vivant = true;
    appeler<ResumeTicket>(`/api/reservations/ticket?code=${encodeURIComponent(code)}`, "GET")
      .then((r) => { if (vivant) setResume(r); })
      .catch((err) => { if (vivant) setErreur(err instanceof Error ? err.message : "Ticket introuvable"); });
    return () => { vivant = false; };
  }, [user, code]);

  if (loading) return <EnCours hauteur="h-[60vh] items-center" />;
  if (!user) return null;

  const valider = async () => {
    setOccupe(true);
    try {
      setResume(await appeler<ResumeTicket>("/api/reservations/ticket", "POST", { code }));
      toast.success("Ticket validé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "La validation a échoué");
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl pb-24">
      <FilAriane items={[{ href: "/mes-terrains/reservations", label: "Réservations reçues" }, { label: "Ticket" }]} />
      <div className="mt-6">
        {resume ? (
          <TicketLu resume={resume} onValider={() => void valider()} occupe={occupe} />
        ) : erreur ? (
          <div className="border border-gray-200/70 bg-white p-5">
            <p className="text-sm font-black text-gray-900">{erreur}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
              Un ticket se valide par le gérant du terrain, connecté à son compte, le jour du match.
            </p>
            <LienBouton href="/mes-terrains/reservations" petit className="mt-4">
              Mes réservations reçues
            </LienBouton>
          </div>
        ) : (
          <EnCours />
        )}
      </div>
    </div>
  );
}
