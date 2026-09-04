"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, AlertTriangle, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { createBooking, getVenueById } from "@/lib/firestore";
import {
  dateLongue, dateCourte, aujourdhui, duree, finCreneau, prixHeure, aUnPrix, seChevauchent,
} from "@/lib/terrains";
import { Etiquette, Bouton, Pastilles, EnCours } from "@/components/venue/venue-ui";

// ============================================
// Demander un créneau sur un terrain.
//
// Le geste reste volontairement pauvre : une date, une heure, une durée. Pas
// de paiement, pas de contrat — la plateforme met les deux parties d'accord
// sur un moment, le reste se règle entre elles.
//
// Une demande naît toujours « en attente ». C'est le propriétaire qui
// confirme, et les règles Firestore le tiennent : un demandeur ne peut pas
// écrire une réservation déjà confirmée.
//
// LA DISPONIBILITÉ SE RELIT EN DIRECT. La page qui porte ce composant est
// rendue à l'avance et mise en cache : un terrain passé en « fermé » y
// restait ouvert le temps du cache, et on pouvait déposer une demande sur un
// terrain qui n'en prenait plus. La collection `venues` est en lecture
// publique, une relecture au montage coûte un document et supprime la
// fenêtre — y compris pour un visiteur sans compte.
//
// LE CHEVAUCHEMENT EST SIGNALÉ AVANT L'ENVOI. Les créneaux déjà confirmés
// étaient affichés, mais rien ne disait que celui qu'on venait de choisir
// tombait dedans : on découvrait le refus deux jours plus tard. On ne bloque
// toujours pas — c'est au propriétaire d'arbitrer, et une demande sur un
// créneau occupé peut valoir pour une annulation — mais on prévient.
// ============================================

interface Creneau {
  date: string;
  time: string;
  duration: number;
}

const DUREES = [
  { value: "1", label: "1 h" },
  { value: "1.5", label: "1 h 30" },
  { value: "2", label: "2 h" },
  { value: "3", label: "3 h" },
];

export default function BookingRequest({
  venueId,
  venueName,
  ownerId,
  available,
  pricePerHour = 0,
}: {
  venueId: string;
  venueName: string;
  ownerId: string;
  /** L'état au moment du rendu serveur. Sert de valeur de départ, puis est relu. */
  available: boolean;
  pricePerHour?: number;
}) {
  const { user, loading: authLoading } = useAuth();
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [ouvert, setOuvert] = useState(available);
  const [date, setDate] = useState(aujourdhui());
  const [time, setTime] = useState("18:00");
  const [dureeChoisie, setDureeChoisie] = useState("1.5");
  const [busy, setBusy] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  const heures = Number(dureeChoisie);

  useEffect(() => {
    let vivant = true;

    fetch(`/api/public/venue/${encodeURIComponent(venueId)}/slots`)
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((d) => { if (vivant) setCreneaux(d.slots ?? []); })
      .catch(() => {});

    // L'état réel, par-dessus celui du cache.
    getVenueById(venueId)
      .then((v) => { if (vivant && v) setOuvert(v.available); })
      .catch(() => {});

    return () => { vivant = false; };
  }, [venueId]);

  /** Les créneaux confirmés qui recouvrent celui qu'on est en train de demander. */
  const conflits = useMemo(
    () => creneaux.filter((c) => seChevauchent(c, { date, time, duration: heures })),
    [creneaux, date, time, heures],
  );

  /** L'occupation à venir, groupée par jour : une liste plate ne se lit pas. */
  const occupation = useMemo(() => {
    const parJour = new Map<string, Creneau[]>();
    for (const c of [...creneaux].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))) {
      const liste = parJour.get(c.date) ?? [];
      liste.push(c);
      parJour.set(c.date, liste);
    }
    return [...parJour.entries()].slice(0, 5);
  }, [creneaux]);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await createBooking({
        venueId,
        venueName,
        ownerId,
        userId: user.uid,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        date,
        time,
        duration: heures,
      });
      setEnvoye(true);
      toast.success("Demande envoyée");
    } catch (err) {
      console.error("Booking request failed:", err);
      toast.error("La demande n'a pas pu être envoyée");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 border border-gray-200/70 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-gray-200/70 px-6 py-5">
        <h2 className="font-display text-xl font-black uppercase tracking-tight text-gray-900">
          Demander un créneau
        </h2>
        {aUnPrix(pricePerHour) && (
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
            {prixHeure(pricePerHour)}
          </p>
        )}
      </div>

      <div className="p-6">
        {occupation.length > 0 && (
          <div className="mb-6">
            <Etiquette className="mb-2.5">Déjà réservé</Etiquette>
            <ul className="space-y-1.5">
              {occupation.map(([jour, liste]) => (
                <li key={jour} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="min-w-[104px] text-[11px] font-black uppercase tracking-[0.1em] text-gray-400">
                    {dateCourte(jour)}
                  </span>
                  <span className="text-[11px] font-bold text-gray-600">
                    {liste.map((c) => `${c.time} → ${finCreneau(c.time, c.duration)}`).join("  ·  ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!ouvert ? (
          <p className="flex items-start gap-3 text-sm leading-relaxed text-gray-500">
            <Lock size={17} className="mt-0.5 shrink-0 text-gray-400" />
            <span>
              Ce terrain est marqué <strong className="font-black text-gray-900">fermé</strong> par
              son propriétaire. Il ne prend pas de demande pour le moment.
            </span>
          </p>
        ) : authLoading ? (
          <EnCours hauteur="py-6" />
        ) : !user ? (
          <>
            <p className="max-w-xl text-sm leading-relaxed text-gray-500">
              Demander un créneau demande un compte : le propriétaire doit savoir
              à qui il confie son terrain, et vous devez pouvoir suivre sa réponse.
            </p>
            <Link
              href={`/login?for=creneau&next=/terrains/${venueId}`}
              className="mt-5 inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
            >
              Créer mon compte
            </Link>
          </>
        ) : envoye ? (
          <div className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 p-4">
            <Check size={17} className="mt-0.5 shrink-0 text-emerald-600" />
            <p className="text-sm font-semibold leading-relaxed text-emerald-900">
              Demande envoyée pour le {dateLongue(date)} de {time} à {finCreneau(time, heures)}.
              Le propriétaire est prévenu ; vous suivrez sa réponse dans{" "}
              <Link href="/mes-reservations" className="underline">mes réservations</Link>.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="booking-date" className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                  Date
                </label>
                <input
                  id="booking-date"
                  type="date"
                  value={date}
                  min={aujourdhui()}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="booking-time" className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                  Heure de début
                </label>
                <input
                  id="booking-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4">
              <Etiquette className="mb-2">Durée</Etiquette>
              <Pastilles
                options={DUREES}
                value={dureeChoisie}
                onChange={setDureeChoisie}
                nom="Durée du créneau"
              />
            </div>

            {/* Le récapitulatif : ce qu'on demande, dit en toutes lettres, et
                ce que ça coûtera si le propriétaire a annoncé un tarif. */}
            <div className="mt-6 border border-gray-200/70 bg-gray-50 px-4 py-3.5">
              <p className="text-sm font-bold text-gray-900">
                {dateLongue(date)}, {time} → {finCreneau(time, heures)}
                <span className="font-semibold text-gray-500"> · {duree(heures)}</span>
              </p>
              {aUnPrix(pricePerHour) && (
                <p className="mt-1 text-[11px] font-bold text-gray-500">
                  Soit environ{" "}
                  <strong className="font-black text-gray-900">
                    {(pricePerHour * heures).toLocaleString("fr-FR")} FCFA
                  </strong>
                  , à régler directement au propriétaire.
                </p>
              )}
            </div>

            {conflits.length > 0 && (
              <p className="mt-4 flex items-start gap-3 border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
                <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
                <span>
                  Ce créneau en recoupe un déjà confirmé
                  {conflits[0] && ` (${conflits[0].time} → ${finCreneau(conflits[0].time, conflits[0].duration)})`}.
                  Vous pouvez tout de même demander — le propriétaire tranchera —
                  mais une autre heure a plus de chances d&apos;aboutir.
                </span>
              </p>
            )}

            <Bouton
              Icon={CalendarDays}
              onClick={submit}
              occupe={busy}
              disabled={!date || !time}
              className="mt-6"
            >
              Demander ce créneau
            </Bouton>

            <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
              Rien n&apos;est payé ni garanti ici : le propriétaire reçoit la
              demande, il est prévenu, et il décide.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
