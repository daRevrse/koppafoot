"use client";

import { useEffect, useState } from "react";
import { Download, Share2, Trophy, GitBranch } from "lucide-react";
import toast from "react-hot-toast";
import { lienAbsolu, partagerLien } from "@/lib/partage";
import { avecVia } from "@/lib/audience";

// ============================================
// Les affiches de la phase finale, à partager : le tableau, puis le champion
// (lib/og-phase-finale). Sur la page publique de la compétition et dans
// l'espace organisateur.
//
// PRÉPARÉES D'AVANCE, comme celle d'un match : `navigator.share` exige une
// activation fraîche, aller chercher l'image au clic la consommerait. Une
// affiche que la route refuse (pas encore de champion) n'a pas de bouton.
//
// « TÉLÉCHARGER » À CÔTÉ DE « PARTAGER » : un navigateur d'ordinateur refuse
// presque toujours de partager un fichier, et retombe sur la copie du lien.
// L'organisateur qui prépare ses publications depuis un ordinateur doit
// pouvoir récupérer l'image elle-même.
// ============================================

interface Affiche {
  fichier: File;
  adresse: string;
}

/** L'image d'une route, prête à partager, ou `null` si la route n'en a pas. */
function useAffiche(route: string, version: string): Affiche | null {
  const [affiche, setAffiche] = useState<{ cle: string; valeur: Affiche | null } | null>(null);
  const cle = `${route}?v=${version}`;
  useEffect(() => {
    let vivant = true;
    let adresse: string | null = null;
    (async () => {
      try {
        // La version dans l'adresse : une affiche d'avant les quarts ne
        // doit pas sortir du cache une fois les quarts joués.
        const reponse = await fetch(cle);
        if (!reponse.ok) {
          if (vivant) setAffiche({ cle, valeur: null });
          return;
        }
        const image = await reponse.blob();
        if (!vivant) return;
        adresse = URL.createObjectURL(image);
        const nom = route.split("/").pop() ?? "affiche";
        setAffiche({ cle, valeur: { fichier: new File([image], `koppafoot-${nom}.png`, { type: image.type }), adresse } });
      } catch {
        if (vivant) setAffiche({ cle, valeur: null });
      }
    })();
    return () => {
      vivant = false;
      if (adresse) URL.revokeObjectURL(adresse);
    };
  }, [cle, route]);
  return affiche?.cle === cle ? affiche.valeur : null;
}

function LigneAffiche({ affiche, libelle, Icone, texte, lien, nomFichier }: {
  affiche: Affiche;
  libelle: string;
  Icone: typeof Trophy;
  texte: string;
  lien: string;
  nomFichier: string;
}) {
  const partager = async () => {
    const resultat = await partagerLien({ title: libelle, text: texte, url: lien, fichier: affiche.fichier });
    if (resultat === "copie") toast.success("Lien copié — télécharge l'affiche pour la joindre");
    else if (resultat === "echec") toast.error("Partage impossible, télécharge l'affiche");
  };
  return (
    <div className="flex items-center gap-3 border border-gray-200/70 bg-white px-3 py-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={affiche.adresse} alt="" className="h-14 w-11 shrink-0 object-cover" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
          <Icone size={14} className="shrink-0 text-primary-600" />
          {libelle}
        </p>
        <p className="text-xs text-gray-500">Pour un statut WhatsApp ou une publication.</p>
      </div>
      <a
        href={affiche.adresse}
        download={nomFichier}
        aria-label={`Télécharger : ${libelle}`}
        className="shrink-0 p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <Download size={16} />
      </a>
      <button
        type="button"
        onClick={partager}
        className="flex shrink-0 items-center gap-1.5 bg-gray-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-black"
      >
        <Share2 size={13} />
        Partager
      </button>
    </div>
  );
}

export default function AffichesPhaseFinale({ slug, nom, version }: {
  slug: string;
  nom: string;
  /** Change avec les résultats de la phase finale : les affiches se redessinent. */
  version: string;
}) {
  const tableau = useAffiche(`/api/c/${slug}/affiche/tableau`, version);
  const champion = useAffiche(`/api/c/${slug}/affiche/champion`, version);
  if (!tableau && !champion) return null;
  const lien = avecVia(lienAbsolu(`/c/${slug}`), "partage");

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Les affiches de la phase finale</p>
      {champion && (
        <LigneAffiche
          affiche={champion}
          libelle="Le champion"
          Icone={Trophy}
          texte={`${nom} : le champion est connu.`}
          lien={lien}
          nomFichier={`champion-${slug}.png`}
        />
      )}
      {tableau && (
        <LigneAffiche
          affiche={tableau}
          libelle="Le tableau de la phase finale"
          Icone={GitBranch}
          texte={`${nom} : le tableau de la phase finale.`}
          lien={lien}
          nomFichier={`tableau-${slug}.png`}
        />
      )}
    </div>
  );
}
