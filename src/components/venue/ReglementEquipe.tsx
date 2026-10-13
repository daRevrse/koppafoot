"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { CreditCard, Ticket } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { idPaiementDuRetour } from "@/lib/paiement";
import { numeroTogolais, type VueReglement } from "@/lib/reglement";
import { appeler } from "@/lib/reservations-client";
import { Bouton, classeChamp } from "@/components/venue/venue-ui";

// ============================================
// Les frais de réservation, vus de l'équipe : ce qu'il reste à payer, puis le
// ticket.
//
// LE TICKET EST CE QU'ON MONTRE. Un code de six caractères, qui se dicte, et
// un QR code que le gérant scanne avec l'appareil photo de son téléphone : il
// porte l'adresse de la page du ticket, rien d'autre.
//
// LES MOTS DE LA VIDÉO. Les frais sont annoncés comme elle les annonce,
// « remboursés si le match a lieu », avec ce que cela veut dire : ils sont
// déduits de ce qu'on règle sur place.
//
// LA RÉSERVATION DIT QUAND RELIRE, LE SERVEUR DIT QUOI. La liste écoute les
// réservations ; chacune porte une copie d'affichage de l'état de ses frais
// (`reglementVu`), que le serveur met à jour à chaque étape. Cette copie
// suffit à dire qu'une réservation est close, et comment. Tant qu'elle est
// ouverte, les montants, l'échéance et le code viennent du serveur, relus
// chaque fois que la copie change.
//
// PAS DE PAIEMENT SANS NUMÉRO OÙ RENDRE. Si le propriétaire annule, les frais
// reviennent à l'équipe par mobile money. Une demande faite depuis la fiche
// du terrain porte déjà un téléphone ; la réservation d'un match n'en porte
// pas, et c'est ici qu'on le demande, avant de payer.
// ============================================

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
const instant = (ms: number) =>
  new Date(ms).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const numeroLisible = (n: string) => n.replace(/(\d{2})(?=\d)/g, "$1 ");

/** Les états où il reste quelque chose à lire au serveur. */
const OUVERTS = ["acompte_attendu", "acompte_paye"];

/** Comment une réservation payante a fini. (« libere » se dit déjà dans l'état de la réservation.) */
const CLOS: Record<string, string> = {
  joue: "Match joué. Tes frais de réservation ont été déduits de ce que tu as réglé sur place.",
  absent: "Ton ticket n'a pas été validé : les frais de réservation restent au propriétaire.",
  annule_equipe: "Les frais de réservation déjà payés restent au propriétaire.",
  annule_proprietaire: "Le propriétaire a annulé : les frais de réservation que tu as payés te sont rendus.",
};

/**
 * Les règlements des réservations dont les frais sont attendus ou payés.
 * Relus quand une de ces réservations change d'état, pas à chaque rendu.
 */
export function useReglements(reservations: { id: string; reglementVu?: string | null }[]): Record<string, VueReglement> {
  const [vues, setVues] = useState<Record<string, VueReglement>>({});
  const cle = reservations
    .filter((r) => OUVERTS.includes(r.reglementVu ?? ""))
    .map((r) => `${r.id}:${r.reglementVu}`)
    .join(",");

  useEffect(() => {
    if (!cle) return;
    let vivant = true;
    const ids = cle.split(",").map((paire) => paire.split(":")[0]);
    void Promise.all(ids.map((id) =>
      appeler<VueReglement>(`/api/reservations/${id}/reglement`, "GET")
        .then((vue) => [id, vue] as const)
        .catch(() => null),
    )).then((paires) => {
      if (vivant) setVues(Object.fromEntries(paires.filter((p): p is readonly [string, VueReglement] => p !== null)));
    });
    return () => { vivant = false; };
  }, [cle]);

  return vues;
}

/**
 * Au retour de la page de paiement : demander au serveur où en est le
 * paiement, et le dire. L'adresse ne prouve rien (lib/paiement) : on n'y lit
 * que l'identifiant. C'est cette question qui fait régler le paiement quand
 * le webhook n'est pas encore passé ; le ticket arrive ensuite tout seul, par
 * la réservation qui change.
 */
export function RetourPaiement() {
  const { firebaseUser } = useAuth();
  const [id] = useState(() =>
    typeof window === "undefined" ? null : idPaiementDuRetour(new URLSearchParams(window.location.search).get("paiement")));

  useEffect(() => {
    if (!firebaseUser || !id) return;
    let vivant = true;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    let essais = 0;
    window.history.replaceState(null, "", window.location.pathname);

    const verifier = async () => {
      essais += 1;
      const etat = await appeler<{ statut?: string }>(`/api/paiements/${id}`, "GET").catch(() => null);
      if (!vivant) return;
      if (etat?.statut === "paye") {
        toast.success("Frais de réservation payés : ton ticket est prêt.");
        return;
      }
      if (etat?.statut === "echoue" || etat?.statut === "annule" || etat?.statut === "expire") {
        toast.error("Le paiement n'a pas abouti. Tu peux réessayer.");
        return;
      }
      if (essais >= 10) {
        toast("La confirmation tarde : ton ticket apparaîtra tout seul dès qu'elle arrive.");
        return;
      }
      minuterie = setTimeout(() => void verifier(), 3000);
    };
    void verifier();
    return () => { vivant = false; clearTimeout(minuterie); };
  }, [firebaseUser, id]);

  return null;
}

/**
 * `etat` : la copie d'affichage de la réservation. `vue` : ce que le serveur
 * en dit, tant qu'elle est ouverte (absente le temps de la lecture).
 */
export function ReglementEquipe({ etat, vue, occupe, onPayer }: {
  etat: string;
  vue: VueReglement | undefined;
  occupe: boolean;
  /** `telephone` : le numéro saisi ici, quand la réservation n'en portait pas. */
  onPayer: (telephone?: string) => void;
}) {
  // Local, et non dans la page : chaque frappe y redessinerait la liste.
  const [numero, setNumero] = useState("");
  const clos = CLOS[etat];
  if (clos) return <p className="mt-2 text-[11px] font-bold leading-relaxed text-gray-500">{clos}</p>;
  if (!vue || vue.role !== "equipe") return null;

  if (vue.etat === "acompte_attendu") {
    return (
      <div className="mt-3 border border-amber-300 bg-amber-50 px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-amber-900">
          Frais de réservation : {fcfa(vue.acompte)}
        </p>
        <p className="mt-1 text-[11px] font-bold leading-relaxed text-amber-900">
          À payer avant {instant(vue.echeance)} pour garder le créneau. Remboursés si le match a lieu : ils sont
          déduits de ce que tu règles sur place ({fcfa(vue.reste)} au lieu de {fcfa(vue.prix)}).
        </p>
        {vue.frais > 0 && (
          <p className="mt-1 text-[11px] text-amber-800">
            Avec {fcfa(vue.frais)} de frais de paiement, tu paies {fcfa(vue.total)}.
          </p>
        )}
        {vue.telephone ? (
          <p className="mt-1 text-[11px] text-amber-800">
            Si le propriétaire annule, ils te sont rendus au {numeroLisible(vue.telephone)}.
          </p>
        ) : (
          <label className="mt-2 block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-amber-900">
              Numéro mobile money où te rendre les frais si le propriétaire annule
            </span>
            <input
              inputMode="tel"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="90 12 34 56"
              className={`${classeChamp} max-w-[14rem]`}
            />
          </label>
        )}
        <Bouton
          petit
          Icon={CreditCard}
          occupe={occupe}
          disabled={!vue.telephone && !numeroTogolais(numero)}
          onClick={() => onPayer(vue.telephone ? undefined : numero)}
          className="mt-2"
        >
          Payer {fcfa(vue.total)}
        </Bouton>
      </div>
    );
  }

  if (vue.etat === "acompte_paye" && vue.code) {
    const adresse = `${window.location.origin}/ticket/${vue.code}`;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-4 border border-emerald-300 bg-emerald-50 px-4 py-3">
        <div className="shrink-0 bg-white p-2">
          <QRCodeSVG value={adresse} size={96} marginSize={0} title="Ticket de réservation" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
            <Ticket size={12} /> Ton ticket
          </p>
          <p className="mt-1 font-display text-2xl font-black tracking-[0.2em] text-gray-900">{vue.code}</p>
          <p className="mt-1 text-[11px] font-bold leading-relaxed text-emerald-900">
            Montre-le au gérant en arrivant. Il te restera {fcfa(vue.reste)} à régler sur place.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
