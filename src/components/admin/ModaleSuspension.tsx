"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminAction } from "@/hooks/useAdminApi";
import { BOUTON_CONTOUR, BOUTON_PLEIN, Modale } from "@/components/admin/ui";

// ============================================
// Suspendre ou réactiver un compte, en disant ce que ça fait.
//
// Depuis la liste des comptes comme depuis sa fiche. Suspendre bloque la
// connexion (lib/suspension-serveur) : la fenêtre le dit avant, et exige le
// motif, que relira le prochain administrateur à ouvrir la fiche.
// ============================================

export default function ModaleSuspension({ uid, nom, suspendre, onFermer, onFait }: {
  uid: string;
  nom: string;
  /** Vrai pour suspendre (ou bloquer la connexion d'un compte déjà suspendu), faux pour réactiver. */
  suspendre: boolean;
  onFermer: () => void;
  onFait: (actif: boolean) => void;
}) {
  const agir = useAdminAction();
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const pret = !suspendre || motif.trim().length >= 5;

  const valider = async () => {
    if (!pret) return;
    setEnCours(true);
    try {
      await agir(`/api/admin/comptes/${uid}/suspension`, "POST", { suspendre, motif: motif.trim() });
      toast.success(suspendre ? "Compte suspendu" : "Compte réactivé");
      onFait(!suspendre);
      onFermer();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'opération a échoué");
      setEnCours(false);
    }
  };

  return (
    <Modale titre={suspendre ? `Suspendre ${nom}` : `Réactiver ${nom}`} onFermer={onFermer}>
      {suspendre ? (
        <div className="space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
            <li>Le compte ne peut plus se connecter, ni sur le site ni sur l&apos;application. Une session ouverte se ferme aussitôt.</li>
            <li>Il disparaît de la recherche de joueurs, des invitations de scoreurs et des envois groupés, et ne reçoit plus de notifications sur son téléphone.</li>
            <li>Rien n&apos;est effacé : équipes, matchs et statistiques restent. Le compte se réactive d&apos;ici.</li>
          </ul>
          <label htmlFor={`motif-suspension-${uid}`} className="block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
            Motif, lu par les administrateurs
          </label>
          <textarea
            id={`motif-suspension-${uid}`}
            rows={3}
            maxLength={500}
            autoFocus
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="ex : Propos injurieux répétés en Tribune, malgré deux avertissements."
            className="w-full resize-none border border-gray-200/70 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
          />
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          Le compte pourra de nouveau se connecter, et réapparaît dans la recherche et les envois.
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onFermer} className={BOUTON_CONTOUR}>Annuler</button>
        <button onClick={valider} disabled={!pret || enCours} className={BOUTON_PLEIN}>
          {enCours && <Loader2 size={13} className="animate-spin" />}
          {suspendre ? "Suspendre" : "Réactiver"}
        </button>
      </div>
    </Modale>
  );
}
