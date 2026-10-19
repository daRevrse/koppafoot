"use client";

import ImageUploadField from "@/components/ui/ImageUploadField";
import type { ReponseConsentement } from "@/lib/consentement-image";

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
  url, onUrlChange, file, onFile, visibleSur, aUnCompte = false, consentement, onConsentement,
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
  /**
   * LE CONSENTEMENT À L'IMAGE, demandé à celui qui pose la photo (voir
   * lib/consentement-image) : le joueur accepte-t-il qu'elle paraisse sur les
   * affiches de KoppaFoot ? Null : pas de réponse pour cette photo. L'écran
   * remet la réponse à null quand on choisit une nouvelle photo, et exige
   * une réponse avant d'enregistrer celle-ci.
   */
  consentement: ReponseConsentement | null;
  onConsentement: (r: ReponseConsentement) => void;
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
      {(url || file) && (
        <fieldset className="mt-3 border border-gray-200/70 bg-gray-50 px-3 py-2.5">
          <legend className="sr-only">Photo sur les affiches de KoppaFoot</legend>
          <p className="text-xs font-medium leading-relaxed text-gray-700">
            Ce joueur, ou ses parents s&apos;il est mineur, accepte-t-il que KoppaFoot utilise cette photo sur
            ses affiches et vidéos publiées sur les réseaux sociaux ?
          </p>
          <div className="mt-2 flex gap-2">
            {(["oui", "non"] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={consentement === r}
                onClick={() => onConsentement(r)}
                className={`border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  consentement === r ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-200/70 bg-white text-gray-700 hover:border-gray-900"
                }`}
              >
                {r === "oui" ? "Oui, il accepte" : "Non, un avatar"}
              </button>
            ))}
          </div>
          {!consentement && (
            <p className="mt-2 text-[11px] text-gray-500">Sans réponse, un avatar remplace sa photo sur nos affiches.</p>
          )}
        </fieldset>
      )}
    </div>
  );
}
