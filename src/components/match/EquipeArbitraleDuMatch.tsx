"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import toast from "react-hot-toast";
import { Check, Flag, Loader2, Pencil, Radio, Users, X } from "lucide-react";
import { composerEquipe } from "@/lib/arbitrage-client";
import type { CorpsArbitral, Match } from "@/types";

// ============================================
// L'équipe de l'arbitre sur UN match : qui l'accompagne.
//
// Le corps arbitral est l'équipe permanente (voir /corps-arbitral) ; ici,
// l'arbitre désigné choisit, match par match, qui vient avec lui : jusqu'à
// deux assistants, et un scoreur. C'est le scoreur qui tient la console
// pendant la rencontre — l'arbitre a le sifflet, pas le téléphone. Il reçoit
// l'accès à la console dès qu'on l'ajoute, et le perd si on le retire.
// ============================================

const EN_PREPARATION = ["pending", "upcoming", "delayed"];

export default function EquipeArbitraleDuMatch({ match, corps }: {
  match: Match;
  /** Le corps que dirige l'arbitre, `null` s'il n'en a pas (encore). */
  corps: CorpsArbitral | null;
}) {
  const [ouvert, setOuvert] = useState(false);
  const e = match.equipeArbitrale ?? null;
  const modifiable = EN_PREPARATION.includes(match.status);

  return (
    <div className="mt-4 border border-gray-200/70 bg-gray-50/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
          <Users size={13} /> Ton équipe pour ce match
        </p>
        {modifiable && corps && (
          <button
            onClick={() => setOuvert(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 transition-colors hover:text-emerald-900"
          >
            {e ? <><Pencil size={12} /> Modifier</> : <><Users size={12} /> Composer mon équipe</>}
          </button>
        )}
      </div>

      {e ? (
        <ul className="mt-2.5 space-y-1.5 text-sm">
          {e.assistants.map((a) => (
            <li key={a.uid} className="flex items-center gap-2 text-gray-700">
              <Flag size={13} className="shrink-0 text-violet-500" />
              <span className="font-semibold">{a.nom}</span>
              <span className="text-xs text-gray-400">assistant</span>
            </li>
          ))}
          {e.scoreur && (
            <li className="flex items-center gap-2 text-gray-700">
              <Radio size={13} className="shrink-0 text-sky-500" />
              <span className="font-semibold">{e.scoreur.nom}</span>
              <span className="text-xs text-gray-400">scoreur, tient la console</span>
            </li>
          )}
        </ul>
      ) : corps ? (
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          Tu viens seul pour l&apos;instant. Emmène un scoreur de « {corps.nom}{" "}» : c&apos;est lui qui
          tiendra la console pendant que tu diriges.
        </p>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          Tu viens seul. Avec un{" "}
          <Link href="/corps-arbitral" className="font-bold text-gray-900 underline decoration-dotted underline-offset-2">
            corps arbitral
          </Link>
          , tu emmènes tes assistants et un scoreur qui tient la console à ta place.
        </p>
      )}

      {ouvert && corps && <Composer match={match} corps={corps} fermer={() => setOuvert(false)} />}
    </div>
  );
}

function Composer({ match, corps, fermer }: { match: Match; corps: CorpsArbitral; fermer: () => void }) {
  const e = match.equipeArbitrale ?? null;
  const [assistants, setAssistants] = useState<string[]>(e?.assistants.map((a) => a.uid) ?? []);
  const [scoreur, setScoreur] = useState<string | null>(e?.scoreur?.uid ?? null);
  const [envoi, setEnvoi] = useState(false);

  const arbitres = corps.membres.filter((m) => m.role === "arbitre");
  const scoreurs = corps.membres.filter((m) => m.role === "scoreur");

  useEffect(() => {
    const auClavier = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") fermer();
    };
    document.addEventListener("keydown", auClavier);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", auClavier);
      document.body.style.overflow = avant;
    };
  }, [fermer]);

  const basculer = (uid: string) =>
    setAssistants((l) => (l.includes(uid) ? l.filter((x) => x !== uid) : l.length >= 2 ? l : [...l, uid]));

  const enregistrer = async () => {
    setEnvoi(true);
    try {
      await composerEquipe(match.id, assistants, scoreur);
      toast.success("Équipe enregistrée, chacun est prévenu");
      fermer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'équipe n'a pas pu être enregistrée");
    } finally {
      setEnvoi(false);
    }
  };

  const case_ = (actif: boolean) =>
    `flex w-full items-center gap-3 border px-3 py-2.5 text-left text-sm transition-colors ${
      actif ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-gray-200/70 text-gray-700 hover:border-gray-400"
    }`;
  const coche = (actif: boolean, rond = false) => (
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${rond ? "rounded-full" : ""} ${
      actif ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-300 bg-white"
    }`}>
      {actif && <Check size={12} />}
    </span>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Fermer" onClick={fermer} className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px]" />
      <div role="dialog" aria-modal="true" aria-labelledby="composer-titre" className="relative flex max-h-[90dvh] w-full max-w-md flex-col border border-gray-200/70 bg-white">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200/70 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
              {match.homeTeamName} vs {match.awayTeamName}
            </p>
            <h2 id="composer-titre" className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-tight text-gray-900">
              Mon équipe
            </h2>
          </div>
          <button type="button" onClick={fermer} aria-label="Fermer" className="-mr-1 -mt-1 shrink-0 border border-gray-200/70 p-2 text-gray-400 transition-colors hover:border-gray-900 hover:text-gray-900">
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
              Arbitres assistants · deux au plus
            </p>
            {arbitres.length === 0 ? (
              <p className="text-xs text-gray-500">Aucun arbitre dans « {corps.nom} ».</p>
            ) : (
              <div className="space-y-2">
                {arbitres.map((a) => {
                  const actif = assistants.includes(a.uid);
                  return (
                    <button key={a.uid} type="button" onClick={() => basculer(a.uid)} className={case_(actif)}
                      disabled={!actif && assistants.length >= 2}>
                      {coche(actif)}
                      <span className="font-semibold">{a.nom}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
              Scoreur · il tient la console
            </p>
            <div className="space-y-2">
              {scoreurs.map((s) => (
                <button key={s.uid} type="button" onClick={() => setScoreur(s.uid)} className={case_(scoreur === s.uid)}>
                  {coche(scoreur === s.uid, true)}
                  <span className="font-semibold">{s.nom}</span>
                </button>
              ))}
              <button type="button" onClick={() => setScoreur(null)} className={case_(scoreur === null)}>
                {coche(scoreur === null, true)}
                <span>Pas de scoreur</span>
              </button>
            </div>
            {scoreurs.length === 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Aucun scoreur dans « {corps.nom} » :{" "}
                <Link href="/corps-arbitral" className="font-bold text-gray-900 underline decoration-dotted underline-offset-2">
                  invites-en un
                </Link>.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-t border-gray-200/70 p-5 sm:px-6">
          <button type="button" onClick={fermer} className="flex-1 border border-gray-200/70 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={enregistrer}
            disabled={envoi}
            className="flex flex-1 items-center justify-center gap-1.5 bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {envoi ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
