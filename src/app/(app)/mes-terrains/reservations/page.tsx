"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, X, MapPin, AlertTriangle, User } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { onBookingsByOwner, updateBookingStatus } from "@/lib/firestore";
import { isVenueOwner } from "@/lib/hats";
import type { Booking } from "@/types";
import { dateLongue, duree, finCreneau, aujourdhui, seChevauchent } from "@/lib/terrains";
import {
  Panneau, FilAriane, Fanion, Bouton, LienBouton, EtatVide, EnCours, Etiquette,
  useConfirmation, type Ton,
} from "@/components/venue/venue-ui";

// ============================================
// Les demandes REÇUES sur ses terrains.
//
// À ne pas confondre avec /mes-reservations, qui liste les créneaux qu'on a
// demandés ailleurs, en tant que client. Un propriétaire a les deux : il loue
// son terrain et peut jouer sur celui d'un autre.
//
// C'EST DÉSORMAIS LA SEULE PAGE QUI RÉPOND. /mes-terrains affichait la même
// liste avec les mêmes boutons ; il n'en reste là-bas qu'un compteur.
//
// LE CHEVAUCHEMENT EST CALCULÉ AVANT DE CONFIRMER. Deux équipes peuvent
// parfaitement demander le même samedi 18 h — on ne bloque pas le dépôt — mais
// accepter les deux est l'erreur qui coûte un client, et elle ne se voyait pas
// dans une liste triée par date d'arrivée. Le produit la nomme au moment où
// elle se commet.
//
// Confirmer appartient au propriétaire, et les règles Firestore le tiennent :
// un demandeur ne peut écrire que l'annulation.
// ============================================

const ETATS: Record<string, { label: string; ton: Ton }> = {
  pending: { label: "En attente", ton: "attente" },
  confirmed: { label: "Confirmé", ton: "ok" },
  cancelled: { label: "Refusé", ton: "refus" },
  completed: { label: "Passé", ton: "neutre" },
};

function Ligne({
  b,
  conflit,
  actions,
  onRepondre,
  occupe,
}: {
  b: Booking;
  conflit: Booking | null;
  actions: boolean;
  onRepondre: (b: Booking, statut: "confirmed" | "cancelled") => void;
  occupe: boolean;
}) {
  const etat = ETATS[b.status] ?? ETATS.pending;

  return (
    <li className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
            <User size={13} className="shrink-0 text-gray-400" />
            {b.userName || "Une équipe"}
          </p>
          <p className="mt-1.5 text-[11px] font-bold text-gray-500">
            {dateLongue(b.date)} · {b.time} → {finCreneau(b.time, b.duration)} · {duree(b.duration)}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
            <MapPin size={11} />
            {b.venueName}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions ? (
            <>
              <Bouton
                petit
                Icon={Check}
                occupe={occupe}
                onClick={() => onRepondre(b, "confirmed")}
              >
                Confirmer
              </Bouton>
              <Bouton
                petit
                variante="danger"
                Icon={X}
                disabled={occupe}
                onClick={() => onRepondre(b, "cancelled")}
              >
                Refuser
              </Bouton>
            </>
          ) : (
            <>
              <Fanion ton={etat.ton}>{etat.label}</Fanion>
              {b.status === "confirmed" && b.date >= aujourdhui() && (
                <button
                  type="button"
                  onClick={() => onRepondre(b, "cancelled")}
                  className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-red-500"
                >
                  Annuler
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {conflit && (
        <p className="mt-4 flex items-start gap-2.5 border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-bold leading-relaxed text-amber-900">
          <AlertTriangle size={15} className="mt-px shrink-0 text-amber-600" />
          <span>
            Chevauche un créneau déjà confirmé sur {conflit.venueName} :{" "}
            {conflit.time} → {finCreneau(conflit.time, conflit.duration)} pour{" "}
            {conflit.userName || "une équipe"}.
          </span>
        </p>
      )}
    </li>
  );
}

export default function ReservationsRecuesPage() {
  const { user, loading: authLoading } = useAuth();
  const [demandes, setDemandes] = useState<Booking[] | null>(null);
  const [agit, setAgit] = useState<string | null>(null);
  const { demander, Dialogue } = useConfirmation();

  useEffect(() => {
    if (!user) return;
    return onBookingsByOwner(user.uid, setDemandes);
  }, [user]);

  const today = aujourdhui();
  const liste = useMemo(() => (demandes ?? []).filter((b) => b.date >= today), [demandes, today]);

  const confirmees = useMemo(
    () => liste.filter((b) => b.status === "confirmed"),
    [liste],
  );

  /** Pour chaque demande en attente, le créneau confirmé qu'elle recouvre. */
  const conflits = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const b of liste) {
      if (b.status !== "pending") continue;
      const heurt = confirmees.find((c) => c.venueId === b.venueId && seChevauchent(c, b));
      if (heurt) map.set(b.id, heurt);
    }
    return map;
  }, [liste, confirmees]);

  const parDate = (a: Booking, b: Booking) =>
    a.date.localeCompare(b.date) || a.time.localeCompare(b.time);

  const attente = useMemo(() => liste.filter((b) => b.status === "pending").sort(parDate), [liste]);
  const traitees = useMemo(() => liste.filter((b) => b.status !== "pending").sort(parDate), [liste]);

  if (authLoading) return <EnCours hauteur="h-[60vh] items-center" />;
  if (!user) return null;

  if (!isVenueOwner(user)) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <EtatVide
          Icon={MapPin}
          titre="Pas encore de terrain"
          action={<LienBouton href="/terrains/candidature">Référencer mon terrain</LienBouton>}
        >
          Cette page liste les demandes reçues sur vos terrains. Pour en
          recevoir, il faut d&apos;abord en référencer un.
        </EtatVide>
      </div>
    );
  }

  const repondre = async (b: Booking, statut: "confirmed" | "cancelled") => {
    const heurt = conflits.get(b.id);

    // Confirmer par-dessus un créneau déjà pris : on ne l'interdit pas — le
    // propriétaire connaît son terrain, il peut avoir deux surfaces ou savoir
    // que l'autre équipe se désiste — mais on le lui dit en toutes lettres.
    if (statut === "confirmed" && heurt) {
      const ok = await demander({
        titre: "Deux équipes sur le même créneau ?",
        corps: (
          <>
            {b.userName || "Cette équipe"} demande {b.time} → {finCreneau(b.time, b.duration)},
            et {heurt.userName || "une autre équipe"} a déjà{" "}
            {heurt.time} → {finCreneau(heurt.time, heurt.duration)} de confirmé sur{" "}
            {heurt.venueName}. Confirmer les deux, c&apos;est en décevoir une.
          </>
        ),
        action: "Confirmer quand même",
      });
      if (!ok) return;
    }

    if (statut === "cancelled" && b.status === "confirmed") {
      const ok = await demander({
        titre: "Annuler un créneau confirmé ?",
        corps: (
          <>
            {b.userName || "L'équipe"} avait ce créneau pour le {dateLongue(b.date)}.
            Elle sera prévenue de l&apos;annulation.
          </>
        ),
        action: "Annuler le créneau",
        danger: true,
      });
      if (!ok) return;
    }

    setAgit(b.id);
    try {
      await updateBookingStatus(b, statut, "proprietaire");
      toast.success(statut === "confirmed" ? "Créneau confirmé, l'équipe est prévenue" : "Demande refusée");
    } catch (err) {
      console.error("Booking answer failed:", err);
      toast.error("L'enregistrement a échoué");
    } finally {
      setAgit(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <FilAriane
        items={[
          { href: "/", label: "Direct" },
          { href: "/mes-terrains", label: "Mes terrains" },
          { label: "Réservations reçues" },
        ]}
      />

      <Panneau
        surtitre="Espace terrain"
        titre="Réservations reçues"
        compteur={attente.length > 0 ? { valeur: attente.length, libelle: "en attente" } : undefined}
      />

      {demandes === null ? (
        <EnCours />
      ) : liste.length === 0 ? (
        <div className="mt-6">
          <EtatVide
            Icon={CalendarDays}
            titre="Aucune demande"
            action={<LienBouton href="/mes-terrains" variante="contour">Voir mes terrains</LienBouton>}
          >
            Rien à venir sur vos terrains. Une fiche avec photo et tarif reçoit
            plus de demandes qu&apos;une fiche vide.
          </EtatVide>
        </div>
      ) : (
        <>
          {attente.length > 0 && (
            <section className="mt-6">
              <h2 className="border-b border-gray-200/70 pb-3">
                <Etiquette className="tracking-[0.15em]">
                  En attente de réponse ({attente.length})
                </Etiquette>
              </h2>
              <ul className="divide-y divide-gray-200/70 border-x border-b border-gray-200/70 bg-white">
                {attente.map((b) => (
                  <Ligne
                    key={b.id}
                    b={b}
                    conflit={conflits.get(b.id) ?? null}
                    actions
                    onRepondre={repondre}
                    occupe={agit === b.id}
                  />
                ))}
              </ul>
            </section>
          )}

          {traitees.length > 0 && (
            <section className="mt-8">
              <h2 className="border-b border-gray-200/70 pb-3">
                <Etiquette className="tracking-[0.15em]">Déjà traitées</Etiquette>
              </h2>
              <ul className="divide-y divide-gray-200/70 border-x border-b border-gray-200/70 bg-white">
                {traitees.map((b) => (
                  <Ligne
                    key={b.id}
                    b={b}
                    conflit={null}
                    actions={false}
                    onRepondre={repondre}
                    occupe={agit === b.id}
                  />
                ))}
              </ul>
            </section>
          )}

          <p className="mt-8">
            <Link
              href="/mes-terrains"
              className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-emerald-700"
            >
              ← Mes terrains
            </Link>
          </p>
        </>
      )}

      <Dialogue />
    </div>
  );
}
