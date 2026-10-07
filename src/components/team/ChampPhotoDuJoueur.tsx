"use client";

import ImageUploadField from "@/components/ui/ImageUploadField";

// ============================================
// La photo d'un joueur SANS COMPTE, dans les fenêtres qui l'éditent : celle
// du club (fiche dans `ghost_players`), celle de l'organisateur et celle du
// manager d'une équipe de compétition (ligne d'effectif).
//
// IL N'A PAS DE COMPTE POUR LA METTRE LUI-MÊME : c'est le club ou
// l'organisateur qui la pose, et les pages qui la montrent sont publiques.
// D'où la mention de son accord, que personne d'autre ne peut vérifier —
// sous le champ et non dans son indication, que le champ remplace par le
// poids gagné dès qu'on choisit une image.
//
// Un joueur QUI A UN COMPTE choisit sa photo lui-même, sur son profil : le
// champ s'efface alors devant une phrase qui le dit.
// ============================================

export default function ChampPhotoDuJoueur({
  url, onUrlChange, file, onFile, visibleSur, aUnCompte = false,
}: {
  /** La photo enregistrée ; "" une fois retirée. */
  url: string;
  onUrlChange: (v: string) => void;
  /** Celle qu'on vient de choisir, déjà allégée par le champ. */
  file: File | null;
  onFile: (f: File | null) => void;
  /** « sur la fiche publique du club et sur les feuilles de match ». */
  visibleSur: string;
  aUnCompte?: boolean;
}) {
  if (aUnCompte) {
    return (
      <p className="border border-gray-200/70 bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-500">
        Ce joueur a un compte : sa photo est celle de son profil, c&apos;est lui qui la choisit.
      </p>
    );
  }
  return (
    <div>
      <ImageUploadField
        label="Photo (facultative)"
        url={url}
        onUrlChange={onUrlChange}
        file={file}
        onFile={onFile}
        maxMb={10}
      />
      <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
        Avec son accord, et celui de ses parents s&apos;il est mineur : elle paraît {visibleSur}.
      </p>
    </div>
  );
}
