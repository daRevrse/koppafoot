"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAdminApi } from "@/hooks/useAdminApi";
import { Carte, Chargement, Chiffre, EnTete, Erreur } from "@/components/admin/ui";
import { DEBUT_MESURE, heureDeMinute, nombreFr, type AudienceDeMatch } from "@/lib/audience";
import { CeQueCaCompte, CourbeDuDirect, Provenance } from "@/components/audience/Graphiques";

// ============================================
// L'audience d'un match : sa courbe minute par minute, ses buts posés dessus.
// Elle vaut pour un amical, qui n'a pas de fiche dans l'administration.
// ============================================

export default function AudienceDUnMatch() {
  const { cible } = useParams<{ cible: string }>();
  const cid = useSearchParams().get("cid");
  const { data, erreur, chargement, recharger } = useAdminApi<AudienceDeMatch>(
    `/api/admin/audience?cible=${encodeURIComponent(cible)}${cid ? `&cid=${encodeURIComponent(cid)}` : ""}`,
  );

  if (chargement) return <Chargement />;
  if (erreur || !data) return <Erreur message={erreur ?? "Lecture impossible"} onReessayer={recharger} />;
  const r = data.resume;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/admin/stats" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900">
        <ArrowLeft size={13} /> Statistiques
      </Link>
      <EnTete
        titre={data.affiche}
        sousTitre={[data.competition?.nom ?? "Amical", data.date, data.heure].filter(Boolean).join(" · ")}
      />
      <div className="grid grid-cols-2 gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-4">
        <Chiffre valeur={r.visites} libelle="Visites" detail={`${r.vues} vues`} />
        <Chiffre valeur={r.pic?.spectateurs ?? 0} libelle="Pic simultané" detail={r.pic ? `à ${heureDeMinute(r.pic.minute)}` : undefined} />
        <Chiffre valeur={`${nombreFr(r.tempsMoyenMin)} min`} libelle="Temps moyen en direct" />
        <Chiffre valeur={data.maintenant} libelle="Maintenant" detail={data.statut === "live" ? "en direct" : "match non commencé ou fini"} />
      </div>
      <Carte className="p-4">
        <CourbeDuDirect points={r.courbe} buts={data.buts} pic={r.pic} />
      </Carte>
      <Carte className="p-4">
        <Provenance provenance={r.provenance} />
      </Carte>
      <CeQueCaCompte depuis={DEBUT_MESURE} />
    </div>
  );
}
