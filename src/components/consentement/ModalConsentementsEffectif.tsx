"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  consentementPour, reponsePourLaPhoto, type ConsentementImage, type ReponseConsentement,
} from "@/lib/consentement-image";

// ============================================
// LES PHOTOS DÉJÀ EN PLACE, SANS RÉPONSE : le consentement à l'image des
// joueurs sans compte, demandé une seule fois à ceux qui gèrent leur équipe.
//
// Une nouvelle photo pose la question au moment où on la choisit
// (ChampPhotoDuJoueur). Celles qu'on avait posées avant que la question
// existe n'ont pas de réponse, donc l'avatar sur les affiches : ce modal les
// liste, sur l'écran d'effectif, avec un oui ou un non pour chacune.
//
// UNE SEULE FOIS PAR ÉQUIPE ET PAR PERSONNE : l'enregistrer ou le remettre
// à plus tard le referme pour de bon (`consentements_effectif_demandes` sur
// son compte). Les lignes restées sans réponse gardent l'avatar ; on y
// répond encore depuis la photo de chaque joueur.
// ============================================

export interface JoueurAvecPhoto {
  id: string;
  nom: string;
  photo: string | null;
  /** Tel que la ligne ou la fiche le range. */
  consentement: unknown;
}

export default function ModalConsentementsEffectif({ cleEquipe, joueurs, enregistrer }: {
  /** « comp:<cid>:<tid> » ou « club:<teamId> ». */
  cleEquipe: string;
  joueurs: JoueurAvecPhoto[];
  enregistrer: (consentements: Record<string, ConsentementImage>) => Promise<void>;
}) {
  const { user, updateProfile } = useAuth();
  const [reponses, setReponses] = useState<Record<string, ReponseConsentement>>({});
  const [envoi, setEnvoi] = useState(false);
  const [ferme, setFerme] = useState(false);

  const aDemander = joueurs.filter((j) => j.photo && reponsePourLaPhoto(j.photo, j.consentement) === null);
  if (!user || ferme || aDemander.length === 0 || user.consentementsEffectifDemandes?.[cleEquipe]) return null;

  const marquerDemande = () =>
    updateProfile({
      consentements_effectif_demandes: {
        ...(user.consentementsEffectifDemandes ?? {}),
        [cleEquipe]: new Date().toISOString(),
      },
    });

  const terminer = async (avecReponses: boolean) => {
    setEnvoi(true);
    try {
      if (avecReponses) {
        const consentements: Record<string, ConsentementImage> = {};
        for (const j of aDemander) {
          const r = reponses[j.id];
          if (r && j.photo) consentements[j.id] = consentementPour(j.photo, r, user.uid);
        }
        if (Object.keys(consentements).length) await enregistrer(consentements);
      }
      await marquerDemande();
      setFerme(true);
      if (avecReponses) toast.success("Réponses enregistrées");
    } catch {
      toast.error("Les réponses n'ont pas pu être enregistrées");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consentements-effectif-titre"
      className="fixed inset-0 modal-layer flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col modal-sheet rounded-t-3xl bg-white p-6 sm:rounded-3xl">
        <h2 id="consentements-effectif-titre" className="font-display text-lg font-bold text-gray-900">
          Leurs photos sur nos affiches ?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          Chaque semaine, KoppaFoot met un joueur à l&apos;honneur sur ses réseaux sociaux. Pour ces joueurs sans
          compte, c&apos;est toi qui as posé la photo : acceptent-ils, ou leurs parents s&apos;ils sont mineurs,
          qu&apos;elle paraisse sur nos affiches et vidéos ? Sans réponse, un avatar la remplace.
        </p>
        <ul className="mt-4 flex-1 divide-y divide-gray-100 overflow-y-auto">
          {aDemander.map((j) => (
            <li key={j.id} className="flex items-center gap-3 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={j.photo ?? ""} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{j.nom}</span>
              {(["oui", "non"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reponses[j.id] === r}
                  onClick={() => setReponses((avant) => ({ ...avant, [j.id]: r }))}
                  className={`border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    reponses[j.id] === r ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-200/70 bg-white text-gray-700 hover:border-gray-900"
                  }`}
                >
                  {r === "oui" ? "Oui" : "Non"}
                </button>
              ))}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            disabled={envoi}
            onClick={() => void terminer(true)}
            className="flex flex-1 items-center justify-center gap-2 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {envoi && <Loader2 size={16} className="animate-spin" />}
            Enregistrer
          </button>
          <button
            type="button"
            disabled={envoi}
            onClick={() => void terminer(false)}
            className="flex-1 border border-gray-200/70 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:border-gray-900 disabled:opacity-50"
          >
            Plus tard
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-gray-400">
          Cette liste ne reviendra pas : tu pourras répondre depuis la photo de chaque joueur.
        </p>
      </div>
    </div>
  );
}
