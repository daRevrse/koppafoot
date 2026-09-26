"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Award, Flag, Loader2, MapPin, Search, Send, UserRound, X, XCircle,
} from "lucide-react";
import { getCorpsDirigesPar, searchReferees } from "@/lib/firestore";
import { gesteArbitre, NIVEAUX_LICENCE, type GesteArbitre } from "@/lib/arbitrage-client";
import type { CorpsArbitral, Match, UserProfile } from "@/types";

// ============================================
// L'arbitre d'un match, vu par ses managers.
//
// LE MANAGER NE POUVAIT QU'ATTENDRE. Un arbitre pouvait se porter candidat,
// et la carte du match proposait alors d'accepter ou refuser ; c'était tout.
// Pas moyen d'aller chercher un arbitre (la recherche et l'invitation
// existaient dans lib/firestore, sans aucun écran), ni de retirer une
// invitation restée sans réponse, ni de libérer un arbitre qui ne viendra
// pas. Et l'adversaire, pourtant manager du même match, ne voyait même pas
// la candidature.
//
// UN SEUL PANNEAU, QUATRE ÉTATS, dans l'ordre où ils se succèdent :
//  - personne : « Trouver un arbitre » ouvre la recherche ;
//  - une candidature : l'accepter ou la refuser ;
//  - une invitation envoyée : attendre, ou l'annuler ;
//  - un arbitre confirmé : son nom, et de quoi le retirer.
// Chaque geste passe par /api/matches/[mid]/arbitre, qui prévient l'arbitre.
// ============================================

/** Les matchs qui se préparent encore : on peut y désigner quelqu'un. */
const EN_PREPARATION = ["pending", "upcoming", "delayed"];

const btn =
  "inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function NomArbitre({ match, className = "" }: { match: Match; className?: string }) {
  if (!match.refereeId) return <span className={className}>{match.refereeName}</span>;
  return (
    <Link
      href={`/profile/${match.refereeId}`}
      onClick={(e) => e.stopPropagation()}
      className={`underline decoration-dotted underline-offset-2 hover:decoration-solid ${className}`}
    >
      {match.refereeName ?? "L'arbitre"}
    </Link>
  );
}

export default function ArbitreDuMatch({
  match,
  aujourdhui,
}: {
  match: Match;
  /** « YYYY-MM-DD », le jour local : un match passé ne cherche plus d'arbitre. */
  aujourdhui: string;
}) {
  const [enCours, setEnCours] = useState<GesteArbitre | null>(null);
  const [recherche, setRecherche] = useState(false);

  const agir = async (action: GesteArbitre, succes: string, arbitreId?: string) => {
    setEnCours(action);
    try {
      await gesteArbitre(match.id, action, arbitreId);
      toast.success(succes);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'action n'a pas pu être enregistrée");
      return false;
    } finally {
      setEnCours(null);
    }
  };

  const ouvert = EN_PREPARATION.includes(match.status);
  const statut = match.refereeStatus;
  // Les boutons vivent sur une carte qui ouvre la fiche au clic : aucun ne
  // doit la déclencher en passant.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (statut === "pending") {
    return (
      <div onClick={stop} className="mt-4 border border-amber-200 bg-amber-50 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Award size={16} className="shrink-0 text-amber-600" />
            <span className="text-sm font-bold text-amber-900">Un arbitre se propose</span>
          </div>
          <NomArbitre match={match} className="truncate text-xs font-bold italic text-amber-800" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => agir("valider", "Arbitre confirmé, il est prévenu")}
            disabled={!!enCours || !ouvert}
            className={`${btn} flex-1 bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            {enCours === "valider" ? <Loader2 size={13} className="animate-spin" /> : null}
            Accepter l&apos;arbitre
          </button>
          <button
            onClick={() => agir("refuser", "Candidature refusée")}
            disabled={!!enCours}
            className={`${btn} flex-1 border border-amber-300 text-amber-900 hover:bg-amber-100`}
          >
            {enCours === "refuser" ? <Loader2 size={13} className="animate-spin" /> : null}
            Refuser
          </button>
        </div>
      </div>
    );
  }

  if (statut === "invited") {
    return (
      <div onClick={stop} className="mt-4 flex flex-wrap items-center justify-between gap-2 border border-blue-200 bg-blue-50 px-3 py-2.5">
        <p className="flex min-w-0 items-center gap-2 text-xs text-blue-900">
          <Send size={13} className="shrink-0 text-blue-600" />
          <span className="min-w-0">
            Invitation envoyée à <NomArbitre match={match} className="font-bold" />, en attente de sa réponse.
          </span>
        </p>
        <button
          onClick={() => agir("annuler", "Invitation annulée")}
          disabled={!!enCours || match.status === "live"}
          className={`${btn} border border-blue-200 bg-white text-blue-800 hover:bg-blue-100`}
        >
          {enCours === "annuler" ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
          Annuler l&apos;invitation
        </button>
      </div>
    );
  }

  if (statut === "confirmed") {
    const retirer = () => {
      const ok = window.confirm(
        `Retirer ${match.refereeName ?? "l'arbitre"} de ce match ?\n\nIl sera prévenu, et le match cherchera de nouveau un arbitre.`,
      );
      if (ok) void agir("annuler", "Arbitre retiré, il est prévenu");
    };
    return (
      <div onClick={stop} className="mt-4 flex flex-wrap items-center justify-between gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <div className="min-w-0 text-xs text-emerald-900">
          <p className="flex items-center gap-2">
            <Flag size={13} className="shrink-0 text-emerald-600" />
            <span className="min-w-0">
              Arbitre : <NomArbitre match={match} className="font-bold" />
            </span>
          </p>
          {/* Qui vient avec lui : c'est souvent la vraie question du manager,
              « qui tient la console ? ». */}
          {match.equipeArbitrale && (
            <p className="mt-1 pl-[21px] text-emerald-800/80">
              {[
                match.equipeArbitrale.assistants.length > 0
                  ? `${match.equipeArbitrale.assistants.length > 1 ? "Assistants" : "Assistant"} : ${match.equipeArbitrale.assistants.map((a) => a.nom).join(", ")}`
                  : null,
                match.equipeArbitrale.scoreur ? `Scoreur : ${match.equipeArbitrale.scoreur.nom}` : null,
              ].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {ouvert && (
          <button
            onClick={retirer}
            disabled={!!enCours}
            className={`${btn} text-emerald-800 hover:text-red-600`}
          >
            {enCours === "annuler" ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
            Retirer
          </button>
        )}
      </div>
    );
  }

  // Personne : on va le chercher, tant que le match se prépare.
  if (!ouvert || match.date < aujourdhui) return null;
  return (
    <div onClick={stop} className="mt-3">
      <button
        onClick={() => setRecherche(true)}
        className={`${btn} border border-gray-200/70 text-gray-700 hover:border-gray-900 hover:text-gray-900`}
      >
        <Search size={13} /> Trouver un arbitre
      </button>
      {recherche && (
        <TrouverArbitre
          match={match}
          fermer={() => setRecherche(false)}
          inviter={async (a) => {
            const ok = await agir("inviter", `Invitation envoyée à ${a.firstName}`, a.uid);
            if (ok) setRecherche(false);
          }}
          invitation={enCours === "inviter"}
        />
      )}
    </div>
  );
}

// ============================================
// La recherche
// ============================================

function TrouverArbitre({
  match, fermer, inviter, invitation,
}: {
  match: Match;
  fermer: () => void;
  inviter: (a: UserProfile) => void;
  invitation: boolean;
}) {
  const ville = (match.venueCity ?? "").trim();
  const [ici, setIci] = useState(!!ville);
  const [niveau, setNiveau] = useState("");
  const [nom, setNom] = useState("");
  const [resultat, setResultat] = useState<{
    cle: string;
    liste: UserProfile[];
    /** Le corps arbitral que dirige chacun, pour savoir qui vient avec lui. */
    corps: Map<string, CorpsArbitral>;
  } | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  // Le nom se filtre sur place ; la ville et le niveau relancent la requête.
  const villeCherchee = ici && ville ? ville : "";
  const cle = `${villeCherchee}|${niveau}`;
  const liste = resultat?.cle === cle ? resultat.liste : null;
  const corpsDe = resultat?.corps ?? new Map<string, CorpsArbitral>();

  useEffect(() => {
    let perime = false;
    // Ni les managers du match ni l'adversaire : on n'arbitre pas son propre match.
    const exclus = new Set([match.managerId, match.awayManagerId].filter(Boolean));
    searchReferees({ city: villeCherchee || undefined, licenseLevel: niveau || undefined })
      .then((r) => r
        .filter((a) => !exclus.has(a.uid))
        .sort((a, b) =>
          (b.experienceYears ?? 0) - (a.experienceYears ?? 0)
          || `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)))
      .catch((err) => {
        console.error("Recherche d'arbitres :", err);
        return [] as UserProfile[];
      })
      .then(async (l) => {
        const corps = await getCorpsDirigesPar(l.map((a) => a.uid)).catch(() => new Map<string, CorpsArbitral>());
        if (!perime) setResultat({ cle, liste: l, corps });
      });
    return () => {
      perime = true;
    };
  }, [cle, villeCherchee, niveau, match.managerId, match.awayManagerId]);

  useEffect(() => {
    champ.current?.focus();
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    document.addEventListener("keydown", auClavier);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", auClavier);
      document.body.style.overflow = avant;
    };
  }, [fermer]);

  const q = nom.trim().toLowerCase();
  const affiches = (liste ?? []).filter((a) => !q || `${a.firstName} ${a.lastName}`.toLowerCase().includes(q));

  const puce = (actif: boolean) =>
    `border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
      actif ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
    }`;

  // Sous <body> : la carte du match ouvre la fiche au clic, et ses parents
  // coupent ce qui dépasse.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Fermer" onClick={fermer} className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="arbitre-titre"
        className="relative flex max-h-[90dvh] w-full max-w-lg flex-col border border-gray-200/70 bg-white"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200/70 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
              {match.homeTeamName} vs {match.awayTeamName}
            </p>
            <h2 id="arbitre-titre" className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-tight text-gray-900">
              Trouver un arbitre
            </h2>
          </div>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer"
            className="-mr-1 -mt-1 shrink-0 border border-gray-200/70 p-2 text-gray-400 transition-colors hover:border-gray-900 hover:text-gray-900"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3 border-b border-gray-200/70 p-5 sm:px-6">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={champ}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Chercher par nom"
              className="w-full border border-gray-200/70 py-2.5 pl-9 pr-3 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {ville && (
              <>
                <button onClick={() => setIci(true)} className={puce(ici)}>{ville}</button>
                <button onClick={() => setIci(false)} className={puce(!ici)}>Partout</button>
                <span className="mx-1 w-px self-stretch bg-gray-200/70" />
              </>
            )}
            <select
              value={niveau}
              onChange={(e) => setNiveau(e.target.value)}
              aria-label="Niveau de licence"
              className="border border-gray-200/70 bg-white px-2 py-1.5 text-[11px] font-bold text-gray-600 focus:border-gray-900 focus:outline-none"
            >
              <option value="">Tous les niveaux</option>
              {Object.entries(NIVEAUX_LICENCE).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {liste === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-gray-300" aria-label="Chargement" />
            </div>
          ) : affiches.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-bold text-gray-900">Aucun arbitre trouvé</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {ici && ville
                  ? `Personne à ${ville} pour ces critères. Élargis à toutes les villes.`
                  : "Essaie un autre nom ou un autre niveau."}
              </p>
              {ici && ville && (
                <button onClick={() => setIci(false)} className={`${btn} mt-4 border border-gray-200/70 text-gray-700 hover:border-gray-900`}>
                  Voir partout
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200/70">
              {affiches.map((a) => {
                const niveauLu = a.licenseLevel ? NIVEAUX_LICENCE[a.licenseLevel] ?? a.licenseLevel : null;
                return (
                  <li key={a.uid} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden bg-violet-50 text-violet-600">
                      {a.profilePictureUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.profilePictureUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UserRound size={18} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/profile/${a.uid}`}
                        target="_blank"
                        className="block truncate text-sm font-bold text-gray-900 hover:text-emerald-700"
                      >
                        {a.firstName} {a.lastName}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                        {a.locationCity && (
                          <span className="flex items-center gap-0.5"><MapPin size={10} /> {a.locationCity}</span>
                        )}
                        {niveauLu && <span className="font-bold text-violet-700">Licence {niveauLu}</span>}
                        {typeof a.experienceYears === "number" && a.experienceYears > 0 && (
                          <span>{a.experienceYears} an{a.experienceYears > 1 ? "s" : ""} d&apos;expérience</span>
                        )}
                      </p>
                      {corpsDe.get(a.uid) && (() => {
                        const c = corpsDe.get(a.uid)!;
                        const scoreurs = c.membres.filter((m) => m.role === "scoreur").length;
                        const arbitres = c.membres.filter((m) => m.role === "arbitre").length;
                        return (
                          <p className="mt-1 truncate text-[11px] text-gray-500">
                            <span className="font-bold text-gray-700">« {c.nom} »</span>
                            {arbitres > 0 && <> · {arbitres} assistant{arbitres > 1 ? "s" : ""}</>}
                            {scoreurs > 0 && <> · {scoreurs} scoreur{scoreurs > 1 ? "s" : ""}</>}
                          </p>
                        );
                      })()}
                    </div>
                    <button
                      onClick={() => {
                        setChoisi(a.uid);
                        inviter(a);
                      }}
                      disabled={invitation}
                      className={`${btn} shrink-0 bg-emerald-600 text-white hover:bg-emerald-700`}
                    >
                      {invitation && choisi === a.uid ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      Inviter
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="border-t border-gray-200/70 px-5 py-3 text-[11px] leading-relaxed text-gray-400 sm:px-6">
          L&apos;arbitre reçoit ton invitation par notification et l&apos;accepte depuis ses désignations.
          S&apos;il a un corps arbitral, il vient avec ses assistants et un scoreur qui tient la console.
        </p>
      </div>
    </div>,
    document.body,
  );
}
