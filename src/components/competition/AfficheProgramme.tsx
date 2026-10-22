"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Share2, X } from "lucide-react";
import toast from "react-hot-toast";
import { avecVia } from "@/lib/audience";
import { jourDeLome } from "@/lib/jour";
import { lienAbsolu, partagerLien } from "@/lib/partage";
import { datesDisponibles, journeesDisponibles, titreDuProgramme, type ChoixDuProgramme } from "@/lib/programme";
import type { CompMatch } from "@/types";

// ============================================
// Le bouton « Affiche » du calendrier de l'organisateur : l'affiche du
// programme, « Journée X » ou « Matchs du jour » (lib/og-programme), à
// télécharger ou partager. Voir docs/superpowers/specs/
// 2026-10-22-journees-et-affiche-du-jour-design.md.
//
// UNE JOURNÉE OU DES DATES. L'onglet « Une journée » n'existe que si des
// journées sont posées (lib/journees). Par défaut, ce qui se joue ensuite :
// la prochaine date, ou la journée qui la contient.
//
// PRÉPARÉES D'AVANCE, comme les affiches de phase finale
// (AffichesPhaseFinale) : `navigator.share` exige une activation fraîche. Au-
// delà de douze matchs, la route coupe en pages : on les demande l'une après
// l'autre jusqu'à ce qu'elle réponde qu'il n'y en a plus.
// ============================================

interface Page {
  fichier: File;
  adresse: string;
}

const PAGES_MAX = 6;

function jourCourt(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/** Les pages de l'affiche pour ce choix, ou `[]` si la route n'en a pas ; `null` pendant le chargement. */
function usePages(slug: string, requete: string | null): Page[] | null {
  const [etat, setEtat] = useState<{ requete: string | null; pages: Page[] } | null>(null);
  useEffect(() => {
    if (!requete) return;
    let vivant = true;
    const adresses: string[] = [];
    (async () => {
      const pages: Page[] = [];
      for (let n = 1; n <= PAGES_MAX; n++) {
        try {
          const reponse = await fetch(`/api/c/${slug}/affiche/programme?${requete}&page=${n}`);
          if (!reponse.ok) break;
          const image = await reponse.blob();
          const adresse = URL.createObjectURL(image);
          adresses.push(adresse);
          pages.push({ fichier: new File([image], `programme-${slug}-${n}.png`, { type: image.type }), adresse });
        } catch {
          break;
        }
      }
      if (vivant) setEtat({ requete, pages });
    })();
    return () => {
      vivant = false;
      adresses.forEach((a) => URL.revokeObjectURL(a));
    };
  }, [slug, requete]);
  return etat?.requete === requete ? etat.pages : null;
}

export default function AfficheProgramme({ slug, nom, matchs, onFermer }: {
  slug: string;
  nom: string;
  matchs: CompMatch[];
  onFermer: () => void;
}) {
  const journees = useMemo(() => journeesDisponibles(matchs), [matchs]);
  const dates = useMemo(() => datesDisponibles(matchs), [matchs]);
  const aujourdhui = jourDeLome();
  const prochaine = dates.find((d) => d >= aujourdhui) ?? dates[dates.length - 1] ?? null;

  const [mode, setMode] = useState<"journee" | "dates">(journees.length ? "journee" : "dates");
  const [journee, setJournee] = useState<number | null>(
    () => journees.find((j) => prochaine && j.dates.includes(prochaine))?.journee ?? journees[journees.length - 1]?.journee ?? null,
  );
  const [choisies, setChoisies] = useState<string[]>(prochaine ? [prochaine] : []);

  const choix: ChoixDuProgramme | null = mode === "journee"
    ? journee != null ? { journee } : null
    : choisies.length ? { dates: [...choisies].sort() } : null;
  // Les matchs dans l'adresse : une affiche d'avant le dernier score ne doit pas sortir du cache.
  const version = useMemo(() => matchs.map((m) => `${m.status}${m.scoreHome ?? ""}${m.scoreAway ?? ""}${m.journee ?? ""}`).join(""), [matchs]);
  const requete = choix
    ? `${"journee" in choix ? `journee=${choix.journee}` : `dates=${choix.dates.join(",")}`}&v=${version.length}-${hash(version)}`
    : null;
  const pages = usePages(slug, requete);

  const basculerDate = (d: string) =>
    setChoisies((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d]));

  const partager = async (page: Page) => {
    const titre = choix ? titreDuProgramme(choix).toLowerCase() : "programme";
    const resultat = await partagerLien({
      title: `${nom} : ${titre}`,
      text: `${nom} : ${titre}.`,
      url: avecVia(lienAbsolu(`/c/${slug}`), "partage"),
      fichier: page.fichier,
    });
    if (resultat === "copie") toast.success("Lien copié — télécharge l'affiche pour la joindre");
    else if (resultat === "echec") toast.error("Partage impossible, télécharge l'affiche");
  };

  const onglet = (m: "journee" | "dates", libelle: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => setMode(m)}
      className={`px-4 py-2 text-sm font-bold transition-colors ${mode === m ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
    >
      {libelle}
    </button>
  );

  return (
    <div className="fixed inset-0 modal-layer flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col modal-sheet rounded-t-3xl bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-gray-900">Affiche du programme</h2>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div role="tablist" className="flex gap-1">
          {journees.length > 0 && onglet("journee", "Une journée")}
          {onglet("dates", "Des dates")}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {mode === "journee"
            ? journees.map((j) => (
              <button
                key={j.journee}
                type="button"
                aria-pressed={journee === j.journee}
                onClick={() => setJournee(j.journee)}
                className={`border px-3 py-1.5 text-left text-xs transition-colors ${
                  journee === j.journee ? "border-primary-600 bg-primary-50 text-primary-800" : "border-gray-200/70 text-gray-600 hover:border-gray-400"
                }`}
              >
                <span className="block font-black">Journée {j.journee}</span>
                <span className="block text-[11px] text-gray-500">{j.dates.length ? j.dates.map(jourCourt).join(", ") : "Dates à fixer"}</span>
              </button>
            ))
            : dates.map((d) => (
              <label
                key={d}
                className={`flex cursor-pointer items-center gap-1.5 border px-3 py-1.5 text-xs font-bold transition-colors ${
                  choisies.includes(d) ? "border-primary-600 bg-primary-50 text-primary-800" : "border-gray-200/70 text-gray-600 hover:border-gray-400"
                }`}
              >
                <input type="checkbox" checked={choisies.includes(d)} onChange={() => basculerDate(d)} className="sr-only" />
                {jourCourt(d)}
              </label>
            ))}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {!choix ? (
            <p className="py-10 text-center text-sm text-gray-500">Choisis une journée ou au moins une date.</p>
          ) : pages === null ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : pages.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              Pas d&apos;affiche pour ce choix : aucun match, ou la compétition est encore en brouillon.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {pages.map((p, i) => (
                <div key={p.adresse} className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.adresse} alt={`Affiche${pages.length > 1 ? `, page ${i + 1} sur ${pages.length}` : ""}`} className="w-full border border-gray-200/70" />
                  <div className="flex gap-2">
                    <a
                      href={p.adresse}
                      download={p.fichier.name}
                      className="flex flex-1 items-center justify-center gap-1.5 border border-gray-200/70 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                    >
                      <Download size={14} />
                      Télécharger
                    </a>
                    <button
                      type="button"
                      onClick={() => void partager(p)}
                      className="flex flex-1 items-center justify-center gap-1.5 bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-black"
                    >
                      <Share2 size={14} />
                      Partager
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Une empreinte courte de la version, pour l'adresse. */
function hash(texte: string): string {
  let h = 0;
  for (let i = 0; i < texte.length; i++) h = (h * 31 + texte.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
