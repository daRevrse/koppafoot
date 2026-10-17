"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Radio } from "lucide-react";
import { useAdminApi } from "@/hooks/useAdminApi";
import { heureDeMinute, type AudienceDeCompetition, type AudienceDeMatch, type Periode } from "@/lib/audience";
import { BarresParJour, CeQueCaCompte, CourbeDuDirect, Provenance } from "@/components/audience/Graphiques";

// ============================================
// L'audience d'une compétition, telle que la voient son staff (page
// Statistiques) et l'administration (fiche de la compétition) : les mêmes
// chiffres, calculés par lib/audience-serveur.
// ============================================

const PERIODES: { valeur: Periode; libelle: string }[] = [
  { valeur: "7j", libelle: "7 jours" },
  { valeur: "30j", libelle: "30 jours" },
  { valeur: "tout", libelle: "Depuis le début" },
];

const pourcent = (x: number) => `${Math.round(x * 100)} %`;

function Tuile({ libelle, valeur, detail }: { libelle: string; valeur: string | number; detail?: string }) {
  return (
    <div className="bg-white p-4">
      <p className="text-xs font-semibold text-gray-500">{libelle}</p>
      <p className="mt-1 font-display text-2xl font-black text-gray-900">{valeur}</p>
      {detail && <p className="mt-0.5 truncate text-xs text-gray-400">{detail}</p>}
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-black uppercase tracking-wider text-gray-900">{titre}</h2>
      <div className="border border-gray-200/70 bg-white p-4">{children}</div>
    </section>
  );
}

/** La courbe d'un match, lue à l'ouverture de sa ligne. */
function CourbeDuMatch({ url }: { url: string }) {
  const { data, erreur, chargement } = useAdminApi<AudienceDeMatch>(url);
  if (chargement) return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-300" size={20} /></div>;
  if (erreur || !data) return <p className="py-4 text-sm text-red-600">{erreur ?? "Lecture impossible"}</p>;
  return <CourbeDuDirect points={data.resume.courbe} buts={data.buts} pic={data.resume.pic} />;
}

export default function PanneauAudienceCompetition({
  data, periode, onPeriode, urlDuMatch, actions,
}: {
  data: AudienceDeCompetition;
  periode: Periode;
  onPeriode: (p: Periode) => void;
  /** L'adresse de la courbe d'un match, selon qui regarde (staff ou administration). */
  urlDuMatch: (mid: string) => string;
  /** À droite des périodes : le rapport PDF, sur la page des organisateurs. */
  actions?: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const t = data.totaux;

  return (
    <div className="space-y-6">
      {/* Les filtres d'abord, sur une ligne : ils décident de tout ce qui suit. */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODES.map((p) => (
          <button
            key={p.valeur}
            type="button"
            onClick={() => onPeriode(p.valeur)}
            className={`px-3 py-1.5 text-xs font-bold transition-colors ${
              periode === p.valeur ? "bg-gray-900 text-white" : "border border-gray-200/70 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p.libelle}
          </button>
        ))}
        {actions && <div className="ml-auto">{actions}</div>}
      </div>

      {t.maintenant > 0 && (
        <div className="flex items-center gap-3 border border-red-200 bg-red-50/60 px-4 py-3">
          <Radio size={16} className="shrink-0 text-red-600" />
          <p className="text-sm font-bold text-gray-900">
            {t.maintenant} spectateur{t.maintenant > 1 ? "s" : ""} en direct maintenant
          </p>
          <span className="ml-auto text-xs text-gray-500">mis à jour toutes les 30 s</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-3">
        <Tuile libelle="Visites des pages" valeur={t.visitesPages} />
        <Tuile libelle="Visites des matchs" valeur={t.visitesMatchs} />
        <Tuile
          libelle="Pic de spectateurs simultanés"
          valeur={t.pic?.spectateurs ?? 0}
          detail={t.pic ? `${t.pic.affiche}, à ${heureDeMinute(t.pic.minute)}` : "Aucun direct suivi"}
        />
        <Tuile libelle="Temps moyen sur un direct" valeur={`${t.tempsMoyenMin} min`} />
        <Tuile libelle="Venues de l'appli" valeur={pourcent(t.partAppli)} detail={`${pourcent(t.partConnectee)} avec un compte`} />
        <Tuile libelle="Abonnés" valeur={t.abonnes} detail="aujourd'hui" />
      </div>

      <Section titre="Visites par jour">
        <BarresParJour jours={data.parJour} />
      </Section>

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-gray-900">Ses matchs, du plus suivi au moins suivi</h2>
        {data.matchs.length === 0 ? (
          <p className="border border-dashed border-gray-200/70 bg-white px-4 py-8 text-center text-sm text-gray-400">
            Aucune fiche de match visitée sur la période.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200/70 bg-white">
            {data.matchs.map((m) => (
              <div key={m.mid}>
                <button
                  type="button"
                  onClick={() => setOuvert(ouvert === m.mid ? null : m.mid)}
                  aria-expanded={ouvert === m.mid}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{m.affiche}</p>
                    <p className="text-xs text-gray-400">
                      {m.date ?? "Date à définir"}{m.heure ? ` · ${m.heure}` : ""}
                      {m.statut === "live" && " · en direct"}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right text-xs tabular-nums text-gray-500 sm:block">
                    <p><span className="font-bold text-gray-900">{m.visites}</span> visites</p>
                    <p>{m.tempsMoyenMin} min en moyenne</p>
                  </div>
                  <div className="w-20 shrink-0 text-right">
                    <p className="text-sm font-black tabular-nums text-gray-900">{m.pic?.spectateurs ?? 0}</p>
                    <p className="text-[11px] text-gray-400">{m.pic ? `pic à ${heureDeMinute(m.pic.minute)}` : "pas de direct"}</p>
                  </div>
                  <ChevronDown size={16} className={`shrink-0 text-gray-300 transition-transform ${ouvert === m.mid ? "rotate-180" : ""}`} />
                </button>
                {ouvert === m.mid && (
                  <div className="border-t border-gray-100 px-4 py-4">
                    <CourbeDuMatch url={urlDuMatch(m.mid)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Section titre="D'où viennent les visites">
        <Provenance provenance={data.provenance} />
      </Section>

      <CeQueCaCompte depuis={data.depuis} />
    </div>
  );
}
