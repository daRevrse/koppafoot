"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, Check, X, MapPin, AlertTriangle, User, Phone, Mail, MessageCircle,
  Lock, Swords, CalendarPlus, History, List, CalendarRange, Repeat,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { onBookingsByOwner, onVenuesByOwner } from "@/lib/firestore";
import { agirSurReservation, bloquerCreneau } from "@/lib/reservations-client";
import { isVenueOwner } from "@/lib/hats";
import PlanningSemaine from "@/components/venue/PlanningSemaine";
import type { Booking, PropositionCreneau, Venue } from "@/types";
import {
  dateLongue, duree, finCreneau, aujourdhui, seChevauchent, jourDe, plusSemaines,
} from "@/lib/terrains";
import {
  Panneau, FilAriane, Fanion, Bouton, LienBouton, EtatVide, EnCours, Etiquette, Champ, Pastilles,
  useConfirmation, classeChamp, type Ton,
} from "@/components/venue/venue-ui";

// ============================================
// Les demandes REÇUES sur ses terrains.
//
// À ne pas confondre avec /mes-reservations, qui liste les créneaux qu'on a
// demandés ailleurs, en tant que client. Un propriétaire a les deux : il loue
// son terrain et peut jouer sur celui d'un autre.
//
// C'EST LA SEULE PAGE QUI RÉPOND. /mes-terrains n'en garde qu'un compteur.
//
// LE CHEVAUCHEMENT EST CALCULÉ AVANT DE CONFIRMER. Deux équipes peuvent
// parfaitement demander le même samedi 18 h — on ne bloque pas le dépôt — mais
// accepter les deux est l'erreur qui coûte un client, et elle ne se voyait pas
// dans une liste triée par date d'arrivée.
//
// CE QUI MANQUAIT POUR RÉPONDRE, et qui est là désormais :
//  - COMMENT JOINDRE L'ÉQUIPE. Le paiement se règle entre elle et lui, hors
//    de la plateforme, et il n'avait qu'un nom. Le téléphone s'appelle ou
//    s'ouvre dans WhatsApp d'un geste ;
//  - POUR QUOI. Une demande née d'un match dit lequel ;
//  - UN « NON » QUI AIDE. Refuser peut proposer un autre créneau, que
//    l'équipe prend d'un geste ;
//  - LES CRÉNEAUX PRIS AILLEURS. Un habitué, un appel : le propriétaire les
//    bloque ici, et la fiche publique les montre occupés ;
//  - LES HABITUÉS. Un créneau bloqué peut se répéter chaque semaine, et la
//    série se lit en une ligne au lieu de douze ;
//  - L'HISTORIQUE. Tout ce qui était passé disparaissait de l'écran ;
//  - LA SEMAINE. La liste dit ce qui est demandé, pas ce qui reste libre :
//    la vue Semaine montre les soirs pris et libres d'un coup d'œil, et un
//    créneau libre s'y bloque d'un geste (voir PlanningSemaine).
//
// Toutes les réponses passent par le serveur (voir lib/reservations-client),
// qui prévient l'autre partie et met à jour le match quand il y en a un.
// ============================================

const ETATS: Record<string, { label: string; ton: Ton }> = {
  pending: { label: "En attente", ton: "attente" },
  confirmed: { label: "Confirmé", ton: "ok" },
  cancelled: { label: "Refusé", ton: "refus" },
  completed: { label: "Passé", ton: "neutre" },
};

const DUREES = [
  { value: "1", label: "1 h" },
  { value: "1.5", label: "1 h 30" },
  { value: "2", label: "2 h" },
  { value: "3", label: "3 h" },
];

/**
 * Le lien WhatsApp d'un numéro, ou `null`.
 *
 * WhatsApp veut le numéro international. Un numéro local à huit chiffres est
 * un numéro togolais — le produit vit à Lomé — et prend l'indicatif 228 ;
 * au-delà, on ne devine pas, le lien d'appel suffit.
 */
function whatsappDe(tel: string): string | null {
  const brut = tel.trim();
  let chiffres = brut.replace(/\D/g, "");
  if (brut.startsWith("00")) chiffres = chiffres.slice(2);
  else if (!brut.startsWith("+")) {
    if (chiffres.length !== 8) return null;
    chiffres = `228${chiffres}`;
  }
  return chiffres.length >= 10 ? `https://wa.me/${chiffres}` : null;
}

/** Qui demande : la personne, et son équipe quand elle en a précisé une. */
function qui(b: Booking): string {
  const nom = b.userName || "Une équipe";
  return b.teamName ? `${nom} (${b.teamName})` : nom;
}

/** Ce qu'une série de blocages couvre encore, vu de sa première date à venir. */
interface Serie {
  jusqua: string;
  nombre: number;
}

function Contact({ b }: { b: Booking }) {
  const tel = b.contact?.telephone;
  const email = b.contact?.email;
  if (!tel && !email) return null;
  const wa = tel ? whatsappDe(tel) : null;
  const lien =
    "inline-flex items-center gap-1.5 border border-gray-200/70 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900";
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {tel && (
        <a href={`tel:${tel.replace(/\s/g, "")}`} className={lien}>
          <Phone size={12} />
          {tel}
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={lien}>
          <MessageCircle size={12} />
          WhatsApp
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={lien}>
          <Mail size={12} />
          Email
        </a>
      )}
    </div>
  );
}

/** Refuser, en proposant éventuellement autre chose. */
function Refus({
  b,
  onValider,
  onFermer,
  occupe,
}: {
  b: Booking;
  onValider: (proposition: PropositionCreneau | null) => void;
  onFermer: () => void;
  occupe: boolean;
}) {
  const [date, setDate] = useState(b.date);
  const [time, setTime] = useState(b.time);
  const [proposer, setProposer] = useState(false);

  return (
    <div className="mt-4 border border-gray-200/70 bg-gray-50 p-4">
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={proposer}
          onChange={(e) => setProposer(e.target.checked)}
          className="h-4 w-4 accent-emerald-600"
        />
        <span className="text-[11px] font-bold text-gray-700">
          Proposer un autre créneau à l&apos;équipe
        </span>
      </label>

      {proposer && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Champ label="Date" htmlFor={`p-date-${b.id}`}>
            <input
              id={`p-date-${b.id}`}
              type="date"
              min={aujourdhui()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={classeChamp}
            />
          </Champ>
          <Champ label="Heure" htmlFor={`p-heure-${b.id}`}>
            <input
              id={`p-heure-${b.id}`}
              type="time"
              step={1800}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={classeChamp}
            />
          </Champ>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Bouton
          petit
          variante="danger"
          Icon={X}
          occupe={occupe}
          disabled={proposer && (!date || !time)}
          onClick={() => onValider(proposer ? { date, time } : null)}
        >
          {proposer ? "Refuser et proposer" : "Refuser"}
        </Bouton>
        <Bouton petit variante="contour" onClick={onFermer} disabled={occupe}>
          Retour
        </Bouton>
      </div>
      {b.matchId && (
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
          {b.competitionId ? "L'organisateur" : "Le manager"}{" "}du match est prévenu, et invité à changer
          d&apos;horaire ou de terrain.
        </p>
      )}
    </div>
  );
}

function Ligne({
  b,
  conflit,
  occupe,
  onAgir,
  serie = null,
}: {
  b: Booking;
  conflit: Booking | null;
  occupe: boolean;
  onAgir: (
    b: Booking,
    action: "confirmer" | "refuser" | "annuler",
    proposition?: PropositionCreneau | null,
    serie?: boolean,
  ) => void;
  /** Pour un blocage répété : jusqu'où la série court encore. */
  serie?: Serie | null;
}) {
  const [refus, setRefus] = useState(false);
  const etat = ETATS[b.status] ?? ETATS.pending;
  const blocage = b.kind === "blocage";
  const aVenir = b.date >= aujourdhui();

  return (
    <li className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
            {blocage ? (
              <Lock size={13} className="shrink-0 text-gray-400" />
            ) : (
              <User size={13} className="shrink-0 text-gray-400" />
            )}
            {blocage ? (b.note || "Créneau bloqué") : (b.userName || "Une équipe")}
            {!blocage && b.teamName && (
              <span className="font-semibold text-gray-500">· {b.teamName}</span>
            )}
          </p>
          <p className="mt-1.5 text-[11px] font-bold text-gray-500">
            {dateLongue(b.date)} · {b.time} → {finCreneau(b.time, b.duration)} · {duree(b.duration)}
          </p>
          {serie && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
              <Repeat size={12} className="shrink-0 text-gray-400" />
              Chaque {jourDe(b.date).toLowerCase()}, jusqu&apos;au {dateLongue(serie.jusqua)} ·{" "}
              {serie.nombre} créneau{serie.nombre > 1 ? "x" : ""}
            </p>
          )}
          <p className="mt-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
            <MapPin size={11} />
            {b.venueName}
          </p>
          {b.matchLabel && (
            <p className="mt-2 inline-flex items-center gap-1.5 bg-gray-900 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white">
              <Swords size={11} />
              {b.matchLabel}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {b.status === "pending" && aVenir ? (
            !refus && (
              <>
                <Bouton petit Icon={Check} occupe={occupe} onClick={() => onAgir(b, "confirmer")}>
                  Confirmer
                </Bouton>
                <Bouton petit variante="danger" Icon={X} disabled={occupe} onClick={() => setRefus(true)}>
                  Refuser
                </Bouton>
              </>
            )
          ) : (
            <>
              {blocage ? <Fanion ton="neutre">Bloqué</Fanion> : <Fanion ton={etat.ton}>{etat.label}</Fanion>}
              {b.status === "confirmed" && aVenir && (
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => onAgir(b, "annuler")}
                  className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-red-500 disabled:opacity-40"
                >
                  {blocage ? (serie ? "Débloquer ce jour" : "Débloquer") : "Annuler"}
                </button>
              )}
              {blocage && serie && b.status === "confirmed" && aVenir && (
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => onAgir(b, "annuler", null, true)}
                  className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-red-500 disabled:opacity-40"
                >
                  Débloquer la série
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {b.message && (
        <p className="mt-3 border-l-2 border-emerald-500 bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-700">
          {b.message}
        </p>
      )}

      {!blocage && <Contact b={b} />}

      {b.status === "cancelled" && b.proposition && (
        <p className="mt-3 text-[11px] font-bold text-gray-500">
          Tu as proposé le {dateLongue(b.proposition.date)} à {b.proposition.time}.
        </p>
      )}

      {conflit && (
        <p className="mt-4 flex items-start gap-2.5 border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-bold leading-relaxed text-amber-900">
          <AlertTriangle size={15} className="mt-px shrink-0 text-amber-600" />
          <span>
            Chevauche un créneau déjà pris sur {conflit.venueName} :{" "}
            {conflit.time} → {finCreneau(conflit.time, conflit.duration)}
            {conflit.kind === "blocage" ? " (bloqué)" : ` pour ${qui(conflit)}`}.
          </span>
        </p>
      )}

      {refus && (
        <Refus
          b={b}
          occupe={occupe}
          onFermer={() => setRefus(false)}
          onValider={(p) => { onAgir(b, "refuser", p); }}
        />
      )}
    </li>
  );
}

/** Prendre un créneau soi-même : un habitué, une réservation au téléphone. */
function Blocage({
  terrains,
  onFermer,
  initial,
}: {
  terrains: Venue[];
  onFermer: () => void;
  /** Le créneau touché dans le planning, s'il y en a un. */
  initial?: { venueId: string; date: string; time: string } | null;
}) {
  const [venueId, setVenueId] = useState(initial?.venueId ?? terrains[0]?.id ?? "");
  const [date, setDate] = useState(initial?.date ?? aujourdhui());
  const [time, setTime] = useState(initial?.time ?? "18:00");
  const [dureeChoisie, setDureeChoisie] = useState("1.5");
  const [note, setNote] = useState("");
  const [occupe, setOccupe] = useState(false);
  // Un habitué : le même créneau chaque semaine, douze semaines par défaut.
  const [repeter, setRepeter] = useState(false);
  const [jusqua, setJusqua] = useState(() => plusSemaines(initial?.date ?? aujourdhui(), 11));
  const finMax = plusSemaines(date, 25);
  const fin = jusqua < date ? date : jusqua > finMax ? finMax : jusqua;
  const semaines = Math.floor((Date.parse(fin) - Date.parse(date)) / (7 * 86_400_000)) + 1;

  const valider = async () => {
    setOccupe(true);
    try {
      const r = await bloquerCreneau({
        venueId, date, time, duration: Number(dureeChoisie), note, jusqua: repeter ? fin : null,
      });
      toast.success(
        r.nombre > 1
          ? `${r.nombre} créneaux bloqués, chaque ${jourDe(date).toLowerCase()} jusqu'au ${dateLongue(r.jusqua)}.`
          : "Créneau bloqué : il apparaît pris sur la fiche.",
      );
      onFermer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Le blocage a échoué");
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="mt-6 space-y-4 border border-gray-200/70 bg-white p-5 sm:p-6">
      <p className="text-sm leading-relaxed text-gray-600">
        Un créneau pris hors de KoppaFoot — un habitué, un appel. Il apparaît
        occupé sur la fiche publique, sans nom ni motif.
      </p>
      {terrains.length > 1 && (
        <Champ label="Terrain" htmlFor="b-terrain">
          <select
            id="b-terrain"
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
            className={classeChamp}
          >
            {terrains.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </Champ>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ label="Date" htmlFor="b-date">
          <input id="b-date" type="date" min={aujourdhui()} value={date}
            onChange={(e) => setDate(e.target.value)} className={classeChamp} />
        </Champ>
        <Champ label="Heure" htmlFor="b-heure">
          <input id="b-heure" type="time" step={1800} value={time}
            onChange={(e) => setTime(e.target.value)} className={classeChamp} />
        </Champ>
      </div>
      <div>
        <Etiquette className="mb-2">Durée</Etiquette>
        <Pastilles options={DUREES} value={dureeChoisie} onChange={setDureeChoisie} nom="Durée du blocage" />
      </div>
      <div className="space-y-3">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={repeter} onChange={(e) => setRepeter(e.target.checked)} />
          <span className="text-[11px] font-bold text-gray-600">
            Chaque semaine, le {jourDe(date).toLowerCase()} : un habitué, un entraînement régulier
          </span>
        </label>
        {repeter && (
          <Champ
            label="Jusqu'au"
            htmlFor="b-jusqua"
            aide={`${semaines} créneau${semaines > 1 ? "x" : ""} bloqué${semaines > 1 ? "s" : ""}, au plus 26 semaines d'un coup.`}
          >
            <input id="b-jusqua" type="date" min={date} max={finMax} value={fin}
              onChange={(e) => setJusqua(e.target.value)} className={classeChamp} />
          </Champ>
        )}
      </div>
      <Champ label="Pour qui, pour quoi" htmlFor="b-note" optionnel aide="Pour toi seul : la fiche publique n'affiche que « déjà réservé ».">
        <input id="b-note" type="text" maxLength={120} value={note}
          onChange={(e) => setNote(e.target.value)} placeholder="ex: Les habitués du jeudi" className={classeChamp} />
      </Champ>
      <div className="flex flex-wrap gap-2">
        <Bouton Icon={Lock} occupe={occupe} disabled={!venueId || !date || !time} onClick={valider}>
          {repeter && semaines > 1 ? `Bloquer ${semaines} créneaux` : "Bloquer le créneau"}
        </Bouton>
        <Bouton variante="contour" onClick={onFermer} disabled={occupe}>Annuler</Bouton>
      </div>
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="border-b border-gray-200/70 pb-3">
        <Etiquette className="tracking-[0.15em]">{titre}</Etiquette>
      </h2>
      <ul className="divide-y divide-gray-200/70 border-x border-b border-gray-200/70 bg-white">
        {children}
      </ul>
    </section>
  );
}

export default function ReservationsRecuesPage() {
  const { user, loading: authLoading } = useAuth();
  const [demandes, setDemandes] = useState<Booking[] | null>(null);
  const [terrains, setTerrains] = useState<Venue[]>([]);
  const [agit, setAgit] = useState<string | null>(null);
  const [blocage, setBlocage] = useState(false);
  const [historique, setHistorique] = useState(false);
  const [vue, setVue] = useState<"liste" | "semaine">("liste");
  /** Le créneau libre touché dans le planning : il préremplit le blocage. */
  const [aBloquer, setABloquer] = useState<{ venueId: string; date: string; time: string } | null>(null);
  /** La réservation touchée dans le planning : elle s'ouvre sous lui. */
  const [choisie, setChoisie] = useState<string | null>(null);
  const { demander, Dialogue } = useConfirmation();

  useEffect(() => {
    if (!user) return;
    const a = onBookingsByOwner(user.uid, setDemandes);
    const b = onVenuesByOwner(user.uid, setTerrains);
    return () => { a(); b(); };
  }, [user]);

  const today = aujourdhui();
  const parDate = (a: Booking, b: Booking) =>
    a.date.localeCompare(b.date) || a.time.localeCompare(b.time);

  // Un blocage levé n'est rien : ni un refus, ni un souvenir. Il quitte les
  // listes, sans quoi débloquer une série de douze jeudis remplissait
  // « Refusées ou annulées » de douze lignes « Bloqué ».
  const leve = (b: Booking) => b.kind === "blocage" && b.status === "cancelled";
  const aVenir = useMemo(() => (demandes ?? []).filter((b) => b.date >= today && !leve(b)), [demandes, today]);
  const passees = useMemo(
    () => (demandes ?? []).filter((b) => b.date < today && !leve(b)).sort((a, b) => parDate(b, a)),
    [demandes, today],
  );
  const attente = useMemo(() => aVenir.filter((b) => b.status === "pending").sort(parDate), [aVenir]);
  const confirmees = useMemo(() => aVenir.filter((b) => b.status === "confirmed").sort(parDate), [aVenir]);
  const ecartees = useMemo(() => aVenir.filter((b) => b.status === "cancelled").sort(parDate), [aVenir]);

  /** Chaque série de blocages à venir : jusqu'où elle court, combien il en reste. */
  const series = useMemo(() => {
    const map = new Map<string, Serie>();
    for (const b of confirmees) {
      if (!b.serieId) continue;
      const s = map.get(b.serieId);
      map.set(b.serieId, s
        ? { jusqua: b.date > s.jusqua ? b.date : s.jusqua, nombre: s.nombre + 1 }
        : { jusqua: b.date, nombre: 1 });
    }
    return map;
  }, [confirmees]);

  // Dans la liste, une série se lit en une ligne : sa prochaine date. Le
  // planning, lui, montre chaque semaine.
  const prises = useMemo(() => {
    const vues = new Set<string>();
    return confirmees.filter((b) => {
      if (!b.serieId) return true;
      if (vues.has(b.serieId)) return false;
      vues.add(b.serieId);
      return true;
    });
  }, [confirmees]);

  /** Pour chaque demande en attente, le créneau déjà pris qu'elle recouvre. */
  const conflits = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const b of attente) {
      const heurt = confirmees.find((c) => c.venueId === b.venueId && seChevauchent(c, b));
      if (heurt) map.set(b.id, heurt);
    }
    return map;
  }, [attente, confirmees]);

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
          Cette page liste les demandes reçues sur tes terrains. Pour en
          recevoir, il faut d&apos;abord en référencer un.
        </EtatVide>
      </div>
    );
  }

  const agir = async (
    b: Booking,
    action: "confirmer" | "refuser" | "annuler",
    proposition?: PropositionCreneau | null,
    serie?: boolean,
  ) => {
    const heurt = conflits.get(b.id);

    // Confirmer par-dessus un créneau déjà pris : on ne l'interdit pas — le
    // propriétaire connaît son terrain, il peut avoir deux surfaces — mais on
    // le lui dit en toutes lettres.
    if (action === "confirmer" && heurt) {
      const ok = await demander({
        titre: "Deux équipes sur le même créneau ?",
        corps: (
          <>
            {qui(b)} demande {b.time} → {finCreneau(b.time, b.duration)},
            et {heurt.time} → {finCreneau(heurt.time, heurt.duration)} est déjà pris sur{" "}
            {heurt.venueName}. Confirmer les deux, c&apos;est en décevoir une.
          </>
        ),
        action: "Confirmer quand même",
      });
      if (!ok) return;
    }

    if (action === "annuler") {
      const suite = b.serieId ? series.get(b.serieId) : undefined;
      const ok = await demander(
        b.kind === "blocage" && serie && suite
          ? {
              titre: "Débloquer toute la série ?",
              corps: (
                <>
                  Chaque {jourDe(b.date).toLowerCase()} à {b.time}, du {dateLongue(b.date)} au{" "}
                  {dateLongue(suite.jusqua)}, redevient libre sur la fiche.
                </>
              ),
              action: "Débloquer la série",
            }
          : b.kind === "blocage"
          ? {
              titre: "Débloquer ce créneau ?",
              corps: <>Il redevient libre sur la fiche, le {dateLongue(b.date)} à {b.time}.</>,
              action: "Débloquer",
            }
          : {
              titre: "Annuler un créneau confirmé ?",
              corps: (
                <>
                  {qui(b)} avait ce créneau pour le {dateLongue(b.date)}.
                  Elle sera prévenue de l&apos;annulation.
                </>
              ),
              action: "Annuler le créneau",
              danger: true,
            },
      );
      if (!ok) return;
    }

    setAgit(b.id);
    try {
      const r = await agirSurReservation(b.id, action, proposition, serie);
      toast.success(
        action === "confirmer"
          ? "Créneau confirmé, l'équipe est prévenue"
          : action === "refuser"
            ? proposition ? "Refusé, ta proposition est envoyée" : "Demande refusée"
            : b.kind === "blocage"
              ? (r.nombre ?? 1) > 1 ? `${r.nombre} créneaux débloqués` : "Créneau débloqué"
              : "Créneau annulé, l'équipe est prévenue",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'enregistrement a échoué");
    } finally {
      setAgit(null);
    }
  };

  const ligne = (b: Booking, conflit: Booking | null = null) => (
    <Ligne
      key={b.id}
      b={b}
      conflit={conflit}
      occupe={agit === b.id}
      onAgir={agir}
      serie={b.serieId ? series.get(b.serieId) ?? null : null}
    />
  );

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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {terrains.length > 0 && !blocage ? (
          <Bouton petit variante="contour" Icon={CalendarPlus} onClick={() => { setABloquer(null); setBlocage(true); }}>
            Bloquer un créneau
          </Bouton>
        ) : <span />}
        {terrains.length > 0 && (
          <div role="group" aria-label="Affichage" className="flex border border-gray-200/70">
            {([["liste", "Liste", List], ["semaine", "Semaine", CalendarRange]] as const).map(([v, label, Icone]) => (
              <button
                key={v}
                type="button"
                onClick={() => setVue(v)}
                aria-pressed={vue === v}
                className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
                  vue === v ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <Icone size={13} />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {blocage && (
        <Blocage
          key={aBloquer ? `${aBloquer.venueId}-${aBloquer.date}-${aBloquer.time}` : "vide"}
          terrains={terrains}
          initial={aBloquer}
          onFermer={() => { setBlocage(false); setABloquer(null); }}
        />
      )}

      {vue === "semaine" && demandes && (
        <>
          <PlanningSemaine
            reservations={demandes}
            terrains={terrains}
            choisie={choisie}
            onCreneauLibre={(venueId, date, time) => {
              setChoisie(null);
              setABloquer({ venueId, date, time });
              setBlocage(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onReservation={(b) => { setBlocage(false); setChoisie(b.id); }}
          />
          {(() => {
            const b = demandes.find((x) => x.id === choisie);
            if (!b) return null;
            return (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <Etiquette>Créneau choisi</Etiquette>
                  <button
                    type="button"
                    onClick={() => setChoisie(null)}
                    aria-label="Fermer"
                    className="p-1 text-gray-400 transition-colors hover:text-gray-900"
                  >
                    <X size={15} />
                  </button>
                </div>
                <ul className="mt-2 border border-gray-200/70 bg-white">
                  {ligne(b, b.status === "pending" ? conflits.get(b.id) ?? null : null)}
                </ul>
              </div>
            );
          })()}
        </>
      )}

      {vue === "semaine" ? null : demandes === null ? (
        <EnCours />
      ) : aVenir.length === 0 && passees.length === 0 ? (
        <div className="mt-6">
          <EtatVide
            Icon={CalendarDays}
            titre="Aucune demande"
            action={<LienBouton href="/mes-terrains" variante="contour">Voir mes terrains</LienBouton>}
          >
            Rien à venir sur tes terrains. Une fiche avec photo, tarif et
            horaires reçoit plus de demandes qu&apos;une fiche vide.
          </EtatVide>
        </div>
      ) : (
        <>
          {attente.length > 0 && (
            <Section titre={`En attente de réponse (${attente.length})`}>
              {attente.map((b) => ligne(b, conflits.get(b.id) ?? null))}
            </Section>
          )}

          {prises.length > 0 && (
            <Section titre="À venir">{prises.map((b) => ligne(b))}</Section>
          )}

          {ecartees.length > 0 && (
            <Section titre="Refusées ou annulées">{ecartees.map((b) => ligne(b))}</Section>
          )}

          {aVenir.length === 0 && (
            <p className="mt-8 text-sm text-gray-500">Rien à venir sur tes terrains.</p>
          )}

          {passees.length > 0 && (
            historique ? (
              <Section titre={`Passées (${passees.length})`}>{passees.map((b) => ligne(b))}</Section>
            ) : (
              <button
                type="button"
                onClick={() => setHistorique(true)}
                className="mt-8 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-gray-900"
              >
                <History size={13} />
                Voir l&apos;historique ({passees.length})
              </button>
            )
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
