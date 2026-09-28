"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminAction, useAdminApi } from "@/hooks/useAdminApi";
import { useATraiter } from "@/components/admin/ATraiterContext";
import {
  BOUTON_CONTOUR, BOUTON_PLEIN, Carte, Chargement, EnTete, Erreur, Filtres, Vide, ilYA,
} from "@/components/admin/ui";
import type { RetourAdmin } from "@/lib/admin-types";

// ============================================
// Les retours des utilisateurs.
//
// Le formulaire « Un retour ? » les enregistrait, et aucun écran ne les
// lisait : la collection est fermée aux navigateurs, et la notification qui
// devait prévenir l'équipe cherchait les administrateurs par un type de compte
// que plus personne ne porte. Des messages d'utilisateurs s'accumulaient sans
// que personne puisse les ouvrir.
// ============================================

/** Le navigateur ou l'appareil, en deux mots plutôt qu'en chaîne technique. */
function appareil(ua: string | null): string | null {
  if (!ua) return null;
  const systeme = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : null;
  const nav = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null;
  return [systeme, nav].filter(Boolean).join(" · ") || null;
}

export default function AdminRetoursPage() {
  const { data, erreur, chargement, recharger, setData } = useAdminApi<{ retours: RetourAdmin[] }>("/api/admin/retours");
  const agir = useAdminAction();
  const { rafraichir } = useATraiter();
  const [filtre, setFiltre] = useState<"ouverts" | "traites">("ouverts");
  const retours = useMemo(() => data?.retours ?? [], [data]);
  const ouverts = retours.filter((r) => !r.traite);
  const affiches = filtre === "ouverts" ? ouverts : retours.filter((r) => r.traite);

  const marquer = async (r: RetourAdmin, traite: boolean) => {
    // L'écran bouge tout de suite ; il revient en arrière si le serveur refuse.
    setData({ retours: retours.map((x) => (x.id === r.id ? { ...x, traite } : x)) });
    try {
      await agir("/api/admin/retours", "PATCH", { id: r.id, traite });
      rafraichir();
    } catch (e) {
      setData({ retours });
      toast.error(e instanceof Error ? e.message : "L'opération a échoué");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <EnTete titre="Retours" sousTitre="Ce que les utilisateurs écrivent depuis « Un retour ? »." />
      <Filtres
        valeur={filtre}
        onChange={setFiltre}
        options={[
          { valeur: "ouverts", label: "À lire", compte: ouverts.length },
          { valeur: "traites", label: "Traités", compte: retours.length - ouverts.length },
        ]}
      />
      {erreur && <Erreur message={erreur} onReessayer={recharger} />}
      {chargement ? (
        <Chargement />
      ) : affiches.length === 0 ? (
        <Vide titre={filtre === "ouverts" ? "Aucun retour à lire" : "Aucun retour traité"} />
      ) : (
        <ul className="space-y-3">
          {affiches.map((r) => (
            <li key={r.id}>
              <Carte className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-black text-gray-900">
                    {r.auteur ? (
                      <Link href={`/admin/users/${r.auteur.uid}`} className="hover:text-emerald-700">{r.auteur.nom}</Link>
                    ) : "Un visiteur sans compte"}
                  </p>
                  <p className="text-[11px] text-gray-400">{ilYA(r.creeLe)}</p>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-800">{r.message}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-gray-400">
                    {[r.page ? `Depuis ${r.page}` : null, appareil(r.appareil)].filter(Boolean).join(" · ")}
                  </p>
                  {r.traite ? (
                    <button onClick={() => marquer(r, false)} className={BOUTON_CONTOUR}><RotateCcw size={13} /> Rouvrir</button>
                  ) : (
                    <button onClick={() => marquer(r, true)} className={BOUTON_PLEIN}><Check size={13} /> Traité</button>
                  )}
                </div>
              </Carte>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
