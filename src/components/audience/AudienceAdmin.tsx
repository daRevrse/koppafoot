"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Radio } from "lucide-react";
import { useAdminApi } from "@/hooks/useAdminApi";
import { Carte, Chargement, Chiffre, Erreur, Titre } from "@/components/admin/ui";
import {
  cibleCompetition, heureDeMinute,
  type AudienceDeCompetition, type DirectAudience, type PanoramaAudience, type Periode,
} from "@/lib/audience";
import PanneauAudienceCompetition from "@/components/audience/PanneauAudienceCompetition";
import { CeQueCaCompte, LIBELLE_VIA, Provenance } from "@/components/audience/Graphiques";

// ============================================
// La mesure d'audience dans l'administration : le direct du tableau de bord,
// le panorama des statistiques, l'audience d'une compétition. Toutes lisent
// /api/admin/audience (lib/audience-serveur).
// ============================================

const lienDuMatch = (m: { cible: string; cid: string | null }) =>
  `/admin/audience/${m.cible}${m.cid ? `?cid=${encodeURIComponent(m.cid)}` : ""}`;

/** Tableau de bord : combien de spectateurs maintenant, sur quels matchs. */
export function DirectMaintenantAdmin() {
  const { data, erreur, recharger } = useAdminApi<DirectAudience>("/api/admin/audience?vue=direct");
  useEffect(() => {
    const minuteur = setInterval(recharger, 30_000);
    return () => clearInterval(minuteur);
  }, [recharger]);
  if (erreur || !data || data.matchs.length === 0) return null;

  return (
    <section>
      <Titre compte={data.matchs.length}>En direct maintenant</Titre>
      <Carte className="divide-y divide-gray-200/70">
        <div className="flex items-center gap-3 px-4 py-3">
          <Radio size={16} className="shrink-0 text-red-600" />
          <span className="font-display text-2xl font-black tabular-nums text-gray-900">{data.total}</span>
          <span className="text-sm font-semibold text-gray-500">
            spectateur{data.total > 1 ? "s" : ""} sur {data.matchs.length} match{data.matchs.length > 1 ? "s" : ""}
          </span>
        </div>
        {data.matchs.map((m) => (
          <Link key={m.cible} href={lienDuMatch(m)} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{m.affiche}</span>
            <span className="text-sm font-black tabular-nums text-gray-900">{m.spectateurs}</span>
            <ChevronRight size={15} className="shrink-0 text-gray-300" />
          </Link>
        ))}
      </Carte>
    </section>
  );
}

/** Statistiques : l'audience de la plateforme sur la période. */
export function PanoramaAdmin() {
  const [periode, setPeriode] = useState<Periode>("30j");
  const { data, erreur, chargement, recharger } = useAdminApi<PanoramaAudience>(`/api/admin/audience?periode=${periode}`);

  return (
    <section className="space-y-3">
      <Titre
        action={
          <span className="flex gap-1">
            {(["7j", "30j", "tout"] as Periode[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriode(p)}
                className={`px-2 py-1 text-[11px] font-black uppercase tracking-widest ${periode === p ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"}`}
              >
                {p === "tout" ? "Tout" : p}
              </button>
            ))}
          </span>
        }
      >
        Audience
      </Titre>
      {chargement ? <Chargement /> : erreur || !data ? <Erreur message={erreur ?? "Lecture impossible"} onReessayer={recharger} /> : (
        <>
          <div className="grid grid-cols-2 gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-4">
            <Chiffre valeur={data.visitesCompetitions} libelle="Visites des compétitions" />
            <Chiffre valeur={data.visitesMatchs} libelle="Visites des matchs" />
            <Chiffre valeur={data.direct.total} libelle="En direct maintenant" detail={`${data.direct.matchs.length} match(s) en cours`} />
            <Chiffre
              valeur={data.matchs[0]?.pic?.spectateurs ?? 0}
              libelle="Plus haut pic"
              detail={data.matchs[0]?.pic ? data.matchs[0].affiche : undefined}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-gray-500">Compétitions les plus visitées</p>
              <Carte className="divide-y divide-gray-200/70">
                {data.competitions.length === 0 && <p className="px-4 py-4 text-sm text-gray-500">Aucune visite sur la période.</p>}
                {data.competitions.map((c) => (
                  <Link key={c.cid} href={`/admin/competitions/${c.cid}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{c.nom}</span>
                    <span className="text-xs tabular-nums text-gray-500">{c.visites} + {c.visitesMatchs} matchs</span>
                  </Link>
                ))}
              </Carte>
            </div>
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-gray-500">Matchs les plus suivis</p>
              <Carte className="divide-y divide-gray-200/70">
                {data.matchs.length === 0 && <p className="px-4 py-4 text-sm text-gray-500">Aucun direct suivi sur la période.</p>}
                {data.matchs.map((m) => (
                  <Link key={m.cible} href={lienDuMatch(m)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{m.affiche}</span>
                    <span className="text-xs tabular-nums text-gray-500">
                      pic {m.pic?.spectateurs ?? 0}{m.pic ? ` à ${heureDeMinute(m.pic.minute)}` : ""}
                    </span>
                  </Link>
                ))}
              </Carte>
            </div>
          </div>
          <Carte className="p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-gray-500">
              D&apos;où viennent les visites
            </p>
            <Provenance provenance={data.provenance} />
            <p className="mt-3 text-xs text-gray-400">
              {(Object.keys(LIBELLE_VIA) as (keyof typeof LIBELLE_VIA)[]).map((v) => `${LIBELLE_VIA[v]} ${data.provenance[v]}`).join(" · ")}
            </p>
          </Carte>
          <CeQueCaCompte depuis={data.depuis} />
        </>
      )}
    </section>
  );
}

/** Fiche d'une compétition : son audience, comme la voit son staff. */
export function AudienceAdminDeCompetition({ cid }: { cid: string }) {
  const [periode, setPeriode] = useState<Periode>("30j");
  const { data, erreur, chargement, recharger } = useAdminApi<AudienceDeCompetition>(
    `/api/admin/audience?cible=${cibleCompetition(cid)}&periode=${periode}`,
  );
  return (
    <section>
      <Titre>Audience</Titre>
      {chargement ? <Chargement /> : erreur || !data ? <Erreur message={erreur ?? "Lecture impossible"} onReessayer={recharger} /> : (
        <PanneauAudienceCompetition
          data={data}
          periode={periode}
          onPeriode={setPeriode}
          urlDuMatch={(mid) => `/api/admin/audience?cible=match-${encodeURIComponent(mid)}&cid=${encodeURIComponent(cid)}`}
        />
      )}
    </section>
  );
}
