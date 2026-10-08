"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Loader2, Megaphone, X } from "lucide-react";
import toast from "react-hot-toast";
import { getAnnonceRecrutement } from "@/lib/firestore";
import { annoncerRecrutement } from "@/lib/tribune-client";
import {
  LIBELLE_POSTE,
  MESSAGE_ANNONCE_MAX,
  POSTES_RECHERCHES,
  texteDeLAnnonce,
  type PosteRecherche,
} from "@/lib/annonce-recrutement";

// ============================================
// L'annonce de recrutement, côté équipe (lib/annonce-recrutement).
//
// Sous l'interrupteur « Statut de recrutement » : où en est l'annonce dans la
// Tribune, et le bouton pour la publier. La fenêtre s'ouvre aussi d'elle-même
// quand le manager rouvre le recrutement : c'est le moment où il a quelque
// chose à dire.
//
// La fenêtre est tenue par la page (`ouverte`, `onOuvrir`, `onFermer`) pour
// que l'interrupteur puisse l'ouvrir.
// ============================================

interface Props {
  teamId: string;
  teamName: string;
  /** Le lecteur est le manager : lui seul signe l'annonce. */
  estManager: boolean;
  ouverte: boolean;
  onOuvrir: () => void;
  onFermer: () => void;
}

export function AnnonceRecrutement({ teamId, teamName, estManager, ouverte, onOuvrir, onFermer }: Props) {
  const [annonce, setAnnonce] = useState<{ id: string; createdAt: string; closed: boolean } | null | undefined>(undefined);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let actif = true;
    getAnnonceRecrutement(teamId)
      .then((a) => { if (actif) setAnnonce(a); })
      .catch(() => { if (actif) setAnnonce(null); });
    return () => { actif = false; };
  }, [teamId, version]);

  const enLigne = annonce && !annonce.closed ? annonce : null;

  return (
    <div className="mt-4 border-t border-gray-200/70 pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <Megaphone size={16} className="mt-0.5 shrink-0 text-blue-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Annonce dans la Tribune</p>
            <p className="mt-0.5 text-sm text-gray-500">
              {annonce === undefined
                ? "…"
                : enLigne
                  ? `En ligne depuis le ${new Date(enLigne.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.`
                  : estManager
                    ? "Dis dans la Tribune quels postes tu cherches : les joueurs te demandent à rejoindre l'équipe d'un geste."
                    : "Seul le manager de l'équipe peut l'annoncer, sous son nom."}
            </p>
          </div>
        </div>
        {enLigne ? (
          <Link
            href={`/feed?post=${enLigne.id}`}
            className="shrink-0 border border-gray-200/70 px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Voir l&apos;annonce
          </Link>
        ) : estManager && annonce !== undefined ? (
          <button
            onClick={onOuvrir}
            className="flex shrink-0 items-center justify-center gap-2 bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Megaphone size={16} /> Annoncer dans la Tribune
          </button>
        ) : null}
      </div>

      {ouverte && estManager && (
        <FenetreAnnonce
          teamId={teamId}
          teamName={teamName}
          onFermer={onFermer}
          onPubliee={() => { setVersion((v) => v + 1); onFermer(); }}
        />
      )}
    </div>
  );
}

function FenetreAnnonce({ teamId, teamName, onFermer, onPubliee }: {
  teamId: string;
  teamName: string;
  onFermer: () => void;
  onPubliee: () => void;
}) {
  const [postes, setPostes] = useState<PosteRecherche[]>([]);
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const basculer = (p: PosteRecherche) =>
    setPostes((avant) => (avant.includes(p) ? avant.filter((x) => x !== p) : POSTES_RECHERCHES.filter((x) => x === p || avant.includes(x))));

  const publier = async () => {
    setEnvoi(true);
    try {
      const r = await annoncerRecrutement(teamId, postes, message);
      toast.success(r.action === "rouvrir" ? "Ton annonce est de nouveau en ligne." : "Annonce publiée dans la Tribune.");
      onPubliee();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "L'annonce n'est pas partie.");
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onFermer}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="annonce-titre"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-gray-200/70 bg-white p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="annonce-titre" className="text-lg font-bold font-display text-gray-900">Annoncer le recrutement</h3>
            <p className="mt-1 text-sm text-gray-500">Ton annonce paraît dans la Tribune, sous ton nom, avec un bouton pour demander à rejoindre {teamName}.</p>
          </div>
          <button onClick={onFermer} aria-label="Fermer" className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-wider text-gray-500">Postes recherchés</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {POSTES_RECHERCHES.map((p) => {
            const choisi = postes.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => basculer(p)}
                aria-pressed={choisi}
                className={`border px-3 py-1.5 text-sm font-medium transition-colors ${
                  choisi ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200/70 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {LIBELLE_POSTE[p]}
              </button>
            );
          })}
        </div>

        <label htmlFor="annonce-message" className="mt-5 block text-xs font-bold uppercase tracking-wider text-gray-500">
          Ton message <span className="font-normal normal-case tracking-normal text-gray-400">(facultatif)</span>
        </label>
        <textarea
          id="annonce-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MESSAGE_ANNONCE_MAX}
          rows={3}
          placeholder={texteDeLAnnonce(teamName, postes, null)}
          className="mt-2 w-full resize-none border border-gray-200/70 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        <p className="mt-1 text-right text-[11px] text-gray-400">{message.length}/{MESSAGE_ANNONCE_MAX}</p>

        <div className="mt-4 flex gap-3">
          <button
            onClick={publier}
            disabled={envoi}
            className="flex flex-1 items-center justify-center gap-2 bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {envoi ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />} Publier
          </button>
          <button
            onClick={onFermer}
            className="flex-1 border border-gray-200/70 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Plus tard
          </button>
        </div>
      </motion.div>
    </div>
  );
}
