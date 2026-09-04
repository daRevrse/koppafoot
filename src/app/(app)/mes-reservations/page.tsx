"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Search } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { onBookingsByUser, updateBookingStatus } from "@/lib/firestore";
import type { Booking } from "@/types";
import { dateLongue, duree, finCreneau, aujourdhui } from "@/lib/terrains";
import {
  Panneau, FilAriane, Fanion, LienBouton, EtatVide, EnCours, Etiquette,
  useConfirmation, type Ton,
} from "@/components/venue/venue-ui";

// ============================================
// Mes réservations, le côté demandeur.
//
// Sans cette page, une demande partait dans le vide : le propriétaire la
// voyait, le demandeur non. Il devait retourner sur la fiche du terrain pour
// deviner si son samedi soir tenait.
//
// L'ÉTAT VIDE NE MÈNE PLUS DANS LE MUR. Il disait « Trouve un terrain » et
// renvoyait vers /terrains, qui est la vitrine des PROPRIÉTAIRES : on y
// lisait « Référencer mon terrain » alors qu'on cherchait où jouer. Il n'y
// avait alors aucun annuaire, la seule voie était la recherche globale. Il
// existe désormais, et c'est là que ce bouton envoie.
//
// Annuler reste possible des deux côtés, et c'est délibéré : un match qui
// tombe à l'eau se dit tout de suite, et le propriétaire est prévenu pour
// pouvoir redonner le créneau. Confirmer, en revanche, n'appartient qu'au
// propriétaire : les règles Firestore le tiennent, pas seulement l'absence
// de bouton.
// ============================================

const ETATS: Record<string, { label: string; ton: Ton; sens: string }> = {
  pending: { label: "En attente", ton: "attente", sens: "Le propriétaire n'a pas encore répondu." },
  confirmed: { label: "Confirmé", ton: "ok", sens: "Le terrain est à vous sur ce créneau." },
  cancelled: { label: "Annulé", ton: "refus", sens: "Ce créneau n'a pas été retenu." },
  completed: { label: "Passé", ton: "neutre", sens: "" },
};

export default function MyBookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [demandes, setDemandes] = useState<Booking[] | null>(null);
  const [agit, setAgit] = useState<string | null>(null);
  const { demander, Dialogue } = useConfirmation();

  useEffect(() => {
    if (!user) return;
    return onBookingsByUser(user.uid, setDemandes);
  }, [user]);

  const today = aujourdhui();

  const { aVenir, passees } = useMemo(() => {
    const liste = demandes ?? [];
    const tri = (a: Booking, b: Booking) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
    return {
      aVenir: liste.filter((b) => b.date >= today).sort(tri),
      passees: liste.filter((b) => b.date < today).sort(tri).reverse(),
    };
  }, [demandes, today]);

  if (authLoading) return <EnCours hauteur="h-[60vh] items-center" />;
  if (!user) return null;

  const annuler = async (b: Booking) => {
    const ok = await demander({
      titre: "Annuler cette demande ?",
      corps: (
        <>
          {b.venueName}, le {dateLongue(b.date)} à {b.time}.
          {b.status === "confirmed"
            ? " Le créneau était confirmé : le propriétaire sera prévenu qu'il se libère."
            : " Le propriétaire n'aura plus à y répondre."}
        </>
      ),
      action: "Annuler la demande",
      danger: true,
    });
    if (!ok) return;

    setAgit(b.id);
    try {
      await updateBookingStatus(b, "cancelled", "demandeur");
      toast.success("Demande annulée");
    } catch (err) {
      console.error("Cancel failed:", err);
      toast.error("L'annulation a échoué");
    } finally {
      setAgit(null);
    }
  };

  const Ligne = ({ b, annulable }: { b: Booking; annulable: boolean }) => {
    const etat = ETATS[b.status] ?? ETATS.pending;
    return (
      <li className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <Link
            href={`/terrains/${b.venueId}`}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-900 transition-colors hover:text-emerald-700"
          >
            <MapPin size={13} className="shrink-0 text-gray-400" />
            {b.venueName}
          </Link>
          <p className="mt-1.5 text-[11px] font-bold text-gray-500">
            {dateLongue(b.date)} · {b.time} → {finCreneau(b.time, b.duration)} · {duree(b.duration)}
          </p>
          {etat.sens && b.date >= today && (
            <p className="mt-1 text-[11px] text-gray-400">{etat.sens}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Fanion ton={etat.ton}>{etat.label}</Fanion>
          {annulable && (
            <button
              type="button"
              onClick={() => annuler(b)}
              disabled={agit === b.id}
              className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-red-500 disabled:opacity-40"
            >
              Annuler
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <FilAriane
        items={[
          { href: "/", label: "Direct" },
          { href: "/terrains/annuaire", label: "Où jouer" },
          { label: "Mes réservations" },
        ]}
      />

      <Panneau
        surtitre="Terrains"
        titre="Mes réservations"
        actions={
          <LienBouton href="/terrains/annuaire" Icon={Search} petit>
            Chercher un terrain
          </LienBouton>
        }
      >
        Les créneaux que vous avez demandés. Le propriétaire confirme ou
        refuse, et vous êtes prévenu dès qu&apos;il répond.
      </Panneau>

      <div className="mt-6">
        {demandes === null ? (
          <EnCours />
        ) : (demandes.length === 0 ? (
          <EtatVide
            Icon={CalendarDays}
            titre="Aucune demande"
            action={<LienBouton href="/terrains/annuaire" Icon={Search}>Trouver un terrain</LienBouton>}
          >
            Parcourez les terrains référencés, choisissez une date et demandez
            le créneau. Le propriétaire répond, et tout se suit ici.
          </EtatVide>
        ) : (
          <>
            {aVenir.length > 0 && (
              <section>
                <h2 className="border-b border-gray-200/70 pb-3">
                  <Etiquette className="tracking-[0.15em]">À venir ({aVenir.length})</Etiquette>
                </h2>
                <ul className="divide-y divide-gray-200/70 border-x border-b border-gray-200/70 bg-white">
                  {aVenir.map((b) => (
                    <Ligne key={b.id} b={b} annulable={b.status !== "cancelled"} />
                  ))}
                </ul>
              </section>
            )}

            {passees.length > 0 && (
              <section className={aVenir.length > 0 ? "mt-8" : ""}>
                <h2 className="border-b border-gray-200/70 pb-3">
                  <Etiquette className="tracking-[0.15em]">Passées</Etiquette>
                </h2>
                <ul className="divide-y divide-gray-200/70 border-x border-b border-gray-200/70 bg-white">
                  {passees.map((b) => (
                    <Ligne key={b.id} b={b} annulable={false} />
                  ))}
                </ul>
              </section>
            )}
          </>
        ))}
      </div>

      <Dialogue />
    </div>
  );
}
